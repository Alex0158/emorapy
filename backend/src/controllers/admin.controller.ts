import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { env } from '../config/env';
import { getPerformanceStats } from '../middleware/performance';
import { adminJobs, getRuntimeJobsEnabled, jobsStarted, reconcileJobsRuntimeConfig, runAdminJobNow } from '../jobs/cleanup.job';
import { adminService } from '../services/admin.service';
import { costMonitoringService } from '../services/cost-monitoring.service';
import { systemConfigService } from '../services/system-config.service';
import {
  ADMIN_MANAGED_CONFIG_KEYS,
  normalizeManagedConfigValue,
  validateCrossManagedConfigRules,
} from '../services/admin-config-rules';
import { Errors } from '../utils/errors';

function parsePagination(req: Request) {
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  return { limit, offset };
}

function parseDaysRange(req: Request) {
  const days = Number(req.query.days || 7);
  return Math.min(Math.max(Number.isFinite(days) ? days : 7, 1), 90);
}

function parseDateRange(req: Request) {
  const fromRaw = req.query.from ? String(req.query.from) : '';
  const toRaw = req.query.to ? String(req.query.to) : '';
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;
  if (fromRaw && Number.isNaN(from?.getTime())) {
    throw Errors.VALIDATION_ERROR('from 必須為合法 ISO 日期');
  }
  if (toRaw && Number.isNaN(to?.getTime())) {
    throw Errors.VALIDATION_ERROR('to 必須為合法 ISO 日期');
  }
  if (from && to && from > to) {
    throw Errors.VALIDATION_ERROR('from 不可晚於 to');
  }
  return { from, to };
}

function parseMaxRows(req: Request) {
  const provided = req.query.maxRows;
  if (provided === undefined) return 5000;
  const raw = Number(provided);
  if (!Number.isFinite(raw)) {
    throw Errors.VALIDATION_ERROR('maxRows 必須為數字');
  }
  const normalized = raw;
  return Math.min(Math.max(Math.floor(normalized), 100), 20000);
}

function getRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function parseIncludeRunning(req: Request) {
  const raw = req.query.includeRunning;
  if (raw === undefined) return true;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  throw Errors.VALIDATION_ERROR('includeRunning 必須為 boolean');
}

class AdminController {
  async bootstrap(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, roleKey } = req.body || {};
      if (!email || !password || !name) {
        throw Errors.VALIDATION_ERROR('email/password/name 為必填');
      }

      const result = await adminService.bootstrap({
        email,
        password,
        name,
        roleKey,
        bootstrapToken: req.headers['x-admin-bootstrap-token'] as string | undefined,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        throw Errors.VALIDATION_ERROR('email/password 為必填');
      }
      const result = await adminService.login({ email, password });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.admin) throw Errors.UNAUTHORIZED('管理員未認證');
      res.json({ success: true, data: { admin: req.admin } });
    } catch (error) {
      next(error);
    }
  }

  async healthDetailed(_req: Request, res: Response, next: NextFunction) {
    try {
      const [dbCheck, adminCount, activeJobs, userCount] = await Promise.all([
        prisma.$queryRaw`SELECT 1`,
        prisma.adminUser.count(),
        Promise.resolve(adminJobs.length),
        prisma.user.count(),
      ]);
      void dbCheck;
      const runtimeJobsEnabled = await getRuntimeJobsEnabled();

      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          cronStarted: jobsStarted,
          activeJobCount: activeJobs,
          adminCount,
          userCount,
          performance: getPerformanceStats(),
          env: {
            nodeEnv: env.NODE_ENV,
            scheduledJobsEnabled: runtimeJobsEnabled,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async listJobs(_req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await prisma.cronRunLog.findMany({
        orderBy: { started_at: 'desc' },
        take: 50,
      });
      const latestByJob = new Map<string, typeof logs[number]>();
      for (const item of logs) {
        if (!latestByJob.has(item.job_name)) latestByJob.set(item.job_name, item);
      }

      const jobs = adminJobs.map((j) => ({
        key: j.key,
        schedule: j.schedule,
        running: jobsStarted,
        latestRun: latestByJob.get(j.key) ?? null,
      }));

      res.json({ success: true, data: { jobs } });
    } catch (error) {
      next(error);
    }
  }

  async getJobStats(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseDaysRange(req);
      const includeRunning = parseIncludeRunning(req);
      const maxRows = parseMaxRows(req);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rawLogs = await prisma.cronRunLog.findMany({
        where: { started_at: { gte: since } },
        orderBy: { started_at: 'desc' },
        take: maxRows + 1,
        select: {
          job_name: true,
          status: true,
          started_at: true,
          duration_ms: true,
          affected_count: true,
        },
      });
      const sampled = rawLogs.length > maxRows;
      const logs = sampled ? rawLogs.slice(0, maxRows) : rawLogs;

      const totals = {
        totalRuns: 0,
        successRuns: 0,
        failedRuns: 0,
        runningRuns: 0,
        completedRuns: 0,
      };
      let totalDurationSumMs = 0;
      let totalDurationCount = 0;

      const byJob = new Map<string, {
        jobKey: string;
        totalRuns: number;
        successRuns: number;
        failedRuns: number;
        runningRuns: number;
        completedRuns: number;
        durationSumMs: number;
        durationCount: number;
        totalAffectedCount: number;
        lastRunAt: string;
      }>();
      const bucketsByDate = new Map<string, {
        date: string;
        totalRuns: number;
        successRuns: number;
        failedRuns: number;
        runningRuns: number;
        completedRuns: number;
      }>();

      for (const log of logs) {
        totals.totalRuns += 1;
        if (log.status === 'success') totals.successRuns += 1;
        if (log.status === 'failed') totals.failedRuns += 1;
        if (log.status === 'running') totals.runningRuns += 1;
        totals.completedRuns = totals.successRuns + totals.failedRuns;
        if (typeof log.duration_ms === 'number') {
          totalDurationSumMs += log.duration_ms;
          totalDurationCount += 1;
        }

        const row = byJob.get(log.job_name) || {
          jobKey: log.job_name,
          totalRuns: 0,
          successRuns: 0,
          failedRuns: 0,
          runningRuns: 0,
          completedRuns: 0,
          durationSumMs: 0,
          durationCount: 0,
          totalAffectedCount: 0,
          lastRunAt: log.started_at.toISOString(),
        };
        row.totalRuns += 1;
        if (log.status === 'success') row.successRuns += 1;
        if (log.status === 'failed') row.failedRuns += 1;
        if (log.status === 'running') row.runningRuns += 1;
        row.completedRuns = row.successRuns + row.failedRuns;
        if (typeof log.duration_ms === 'number') {
          row.durationSumMs += log.duration_ms;
          row.durationCount += 1;
        }
        row.totalAffectedCount += log.affected_count || 0;
        byJob.set(log.job_name, row);

        const dateKey = log.started_at.toISOString().slice(0, 10);
        const bucket = bucketsByDate.get(dateKey) || {
          date: dateKey,
          totalRuns: 0,
          successRuns: 0,
          failedRuns: 0,
          runningRuns: 0,
          completedRuns: 0,
        };
        bucket.totalRuns += 1;
        if (log.status === 'success') bucket.successRuns += 1;
        if (log.status === 'failed') bucket.failedRuns += 1;
        if (log.status === 'running') bucket.runningRuns += 1;
        bucket.completedRuns = bucket.successRuns + bucket.failedRuns;
        bucketsByDate.set(dateKey, bucket);
      }
      const avgDurationMs = totalDurationCount > 0 ? Math.round(totalDurationSumMs / totalDurationCount) : 0;

      const perJob = Array.from(byJob.values()).map((row) => {
        return {
          jobKey: row.jobKey,
          totalRuns: row.totalRuns,
          successRuns: row.successRuns,
          failedRuns: row.failedRuns,
          runningRuns: row.runningRuns,
          completedRuns: row.completedRuns,
          successRate: getRate(row.successRuns, includeRunning ? row.totalRuns : row.completedRuns),
          failureRate: getRate(row.failedRuns, includeRunning ? row.totalRuns : row.completedRuns),
          successRateCompleted: getRate(row.successRuns, row.completedRuns),
          failureRateCompleted: getRate(row.failedRuns, row.completedRuns),
          avgDurationMs: row.durationCount > 0 ? Math.round(row.durationSumMs / row.durationCount) : 0,
          totalAffectedCount: row.totalAffectedCount,
          lastRunAt: row.lastRunAt,
        };
      }).sort((a, b) => {
        if (b.totalRuns !== a.totalRuns) return b.totalRuns - a.totalRuns;
        return a.jobKey.localeCompare(b.jobKey);
      });
      const dailyBuckets = Array.from({ length: days }, (_, index) => {
        const date = new Date(Date.now() - (days - 1 - index) * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        return bucketsByDate.get(date) || {
          date,
          totalRuns: 0,
          successRuns: 0,
          failedRuns: 0,
          runningRuns: 0,
          completedRuns: 0,
        };
      });

      res.json({
        success: true,
        data: {
          days,
          since: since.toISOString(),
          totals: {
            ...totals,
            successRate: getRate(totals.successRuns, includeRunning ? totals.totalRuns : totals.completedRuns),
            failureRate: getRate(totals.failedRuns, includeRunning ? totals.totalRuns : totals.completedRuns),
            successRateCompleted: getRate(totals.successRuns, totals.completedRuns),
            failureRateCompleted: getRate(totals.failedRuns, totals.completedRuns),
            avgDurationMs,
          },
          perJob,
          dailyBuckets: dailyBuckets.map((bucket) => ({
            ...bucket,
            successRate: getRate(bucket.successRuns, includeRunning ? bucket.totalRuns : bucket.completedRuns),
            failureRate: getRate(bucket.failedRuns, includeRunning ? bucket.totalRuns : bucket.completedRuns),
            successRateCompleted: getRate(bucket.successRuns, bucket.completedRuns),
            failureRateCompleted: getRate(bucket.failedRuns, bucket.completedRuns),
          })),
          rateBase: includeRunning ? 'total_runs' : 'completed_runs',
          statsMeta: {
            maxRows,
            returnedRows: logs.length,
            sampled,
            sampleStrategy: 'latest_runs_desc',
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async triggerJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobKey } = req.params;
      const now = new Date();
      const result = await runAdminJobNow(jobKey, req.admin?.id);

      await adminService.writeAuditLog({
        actorId: req.admin?.id,
        actorType: 'admin',
        entityType: 'job',
        entityId: jobKey,
        action: 'trigger',
        detail: { accepted: result.accepted, mode: result.mode },
      });

      if (!result.accepted) throw Errors.NOT_FOUND('任務不存在或不支援手動觸發');
      res.json({
        success: true,
        data: {
          jobKey,
          triggeredAt: now.toISOString(),
          status: 'queued',
          note: '任務已觸發，請稍後查看執行結果日誌',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async listConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, offset } = parsePagination(req);
      const [rows, total] = await Promise.all([
        prisma.systemConfig.findMany({
          orderBy: { updated_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.systemConfig.count(),
      ]);
      const items = rows.map((row) => {
        if (!row.is_sensitive) return row;
        return {
          ...row,
          value: '***MASKED***',
        };
      });

      res.json({ success: true, data: { items, total, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async upsertConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { key, value, description, isRuntime, isSensitive } = req.body || {};
      if (!key) throw Errors.VALIDATION_ERROR('config key 為必填');
      const normalizedKey = String(key).trim();
      const normalizedUpperKey = normalizedKey.toUpperCase();
      const forbiddenPrefix = ['JWT_', 'OPENAI_API_KEY', 'DATABASE_URL', 'SMTP_PASS', 'ADMIN_JWT_SECRET'];
      if (forbiddenPrefix.some((prefix) => normalizedUpperKey.startsWith(prefix))) {
        throw Errors.FORBIDDEN('敏感基礎密鑰不可由後台配置管理');
      }
      if (!ADMIN_MANAGED_CONFIG_KEYS.has(normalizedKey)) {
        throw Errors.FORBIDDEN('該配置 key 不在後台可管理白名單');
      }
      const normalizedValue = normalizeManagedConfigValue(normalizedKey, value);
      await validateCrossManagedConfigRules(
        normalizedKey,
        normalizedValue,
        (configKey, fallback) => systemConfigService.getNumberConfig(configKey, fallback),
        {
          maxTurns: env.INTERVIEW_MAX_TURNS,
          softTarget: env.INTERVIEW_SOFT_TARGET,
        }
      );

      const item = await prisma.systemConfig.upsert({
        where: { key: normalizedKey },
        create: {
          key: normalizedKey,
          value: normalizedValue,
          description: description || null,
          is_runtime: isRuntime !== false,
          is_sensitive: isSensitive === true,
          updated_by: req.admin?.id,
        },
        update: {
          value: normalizedValue,
          description: description || null,
          is_runtime: isRuntime !== false,
          is_sensitive: isSensitive === true,
          updated_by: req.admin?.id,
        },
      });

      await adminService.writeAuditLog({
        actorId: req.admin?.id,
        actorType: 'admin',
        entityType: 'system_config',
        entityId: item.id,
        action: 'upsert',
        detail: { key: item.key },
      });

      let jobsRuntimeEnabled: boolean | undefined;
      if (normalizedKey === 'jobs.enabled') {
        jobsRuntimeEnabled = await reconcileJobsRuntimeConfig();
      }

      const safeItem = item.is_sensitive ? { ...item, value: '***MASKED***' } : item;
      res.json({
        success: true,
        data: {
          item: safeItem,
          runtime: jobsRuntimeEnabled === undefined ? undefined : { jobsEnabled: jobsRuntimeEnabled },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const q = String(req.query.q || '').trim();
      const { limit, offset } = parsePagination(req);

      const where = q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              { nickname: { contains: q, mode: 'insensitive' as const } },
              { id: { contains: q } },
            ],
          }
        : {};

      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit,
          select: {
            id: true,
            email: true,
            nickname: true,
            is_active: true,
            email_verified: true,
            login_failed_attempts: true,
            locked_until: true,
            created_at: true,
            last_login_at: true,
            deleted_at: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({ success: true, data: { items, total, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async getUserDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          pairings_as_user1: {
            select: { id: true, status: true, created_at: true, confirmed_at: true, user2_id: true },
            orderBy: { created_at: 'desc' },
            take: 20,
          },
          pairings_as_user2: {
            select: { id: true, status: true, created_at: true, confirmed_at: true, user1_id: true },
            orderBy: { created_at: 'desc' },
            take: 20,
          },
          cases_as_plaintiff: {
            select: { id: true, status: true, created_at: true, title: true },
            orderBy: { created_at: 'desc' },
            take: 20,
          },
          cases_as_defendant: {
            select: { id: true, status: true, created_at: true, title: true },
            orderBy: { created_at: 'desc' },
            take: 20,
          },
        },
      });
      if (!user) throw Errors.NOT_FOUND('使用者不存在');
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { action, lockMinutes } = req.body || {};
      let data: Record<string, unknown> = {};
      if (action === 'lock') {
        const minutes = Math.max(Number(lockMinutes || 30), 1);
        data = {
          locked_until: new Date(Date.now() + minutes * 60 * 1000),
          login_failed_attempts: 5,
        };
      } else if (action === 'unlock') {
        data = { locked_until: null, login_failed_attempts: 0 };
      } else if (action === 'deactivate') {
        data = { is_active: false, deleted_at: new Date() };
      } else if (action === 'activate') {
        data = { is_active: true, deleted_at: null };
      } else {
        throw Errors.VALIDATION_ERROR('action 必須是 lock/unlock/deactivate/activate');
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true, email: true, is_active: true, locked_until: true, deleted_at: true },
      });

      await adminService.writeAuditLog({
        actorId: req.admin?.id,
        actorType: 'admin',
        entityType: 'user',
        entityId: user.id,
        action: `user_${action}`,
        detail: { lockMinutes: lockMinutes || null },
      });

      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, offset } = parsePagination(req);
      const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
      const action = req.query.action ? String(req.query.action) : undefined;
      const { from, to } = parseDateRange(req);
      const data = await adminService.listAuditLogs({ limit, offset, entityType, action, from, to });
      res.json({ success: true, data: { ...data, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async exportAuditLogsCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
      const action = req.query.action ? String(req.query.action) : undefined;
      const { from, to } = parseDateRange(req);
      const data = await adminService.listAuditLogs({
        limit: 5000,
        offset: 0,
        entityType,
        action,
        from,
        to,
      });

      const csvEscape = (value: unknown) => {
        const asText = typeof value === 'string' ? value : JSON.stringify(value ?? '');
        const escaped = asText.split('"').join('""');
        return `"${escaped}"`;
      };
      const lines = ['id,actor_id,actor_type,entity_type,entity_id,action,created_at,detail'];
      for (const row of data.items) {
        lines.push([
          row.id,
          csvEscape(row.actor_id || ''),
          csvEscape(row.actor_type || ''),
          csvEscape(row.entity_type || ''),
          csvEscape(row.entity_id || ''),
          csvEscape(row.action || ''),
          row.created_at.toISOString(),
          csvEscape(row.detail),
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="admin-audit-logs.csv"');
      res.status(200).send(lines.join('\n'));
    } catch (error) {
      next(error);
    }
  }

  async listAdminUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, offset } = parsePagination(req);
      const q = req.query.q ? String(req.query.q) : undefined;
      const data = await adminService.listAdminUsers({ limit, offset, q });
      res.json({ success: true, data: { ...data, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async createAdminUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, roleKey } = req.body || {};
      const item = await adminService.createAdminUser({
        email,
        password,
        name,
        roleKey,
        actorId: req.admin?.id,
      });
      res.status(201).json({
        success: true,
        data: {
          item: {
            id: item.id,
            email: item.email,
            name: item.name,
            is_active: item.is_active,
            role: item.role,
            created_at: item.created_at,
            updated_at: item.updated_at,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAdminUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { adminUserId } = req.params;
      const { name, roleKey, isActive, password } = req.body || {};
      const item = await adminService.updateAdminUser(adminUserId, {
        name,
        roleKey,
        isActive,
        password,
        actorId: req.admin?.id,
      });
      res.json({
        success: true,
        data: {
          item: {
            id: item.id,
            email: item.email,
            name: item.name,
            is_active: item.is_active,
            role: item.role,
            updated_at: item.updated_at,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAdminUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { adminUserId } = req.params;
      const item = await adminService.deleteAdminUser(adminUserId, req.admin?.id);
      res.json({
        success: true,
        data: {
          item: {
            id: item.id,
            email: item.email,
            name: item.name,
            is_active: item.is_active,
            deleted_at: item.deleted_at,
            role: item.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async reportOverview(_req: Request, res: Response, next: NextFunction) {
    try {
      const [
        users,
        pairings,
        casesTotal,
        casesCompleted,
        judgments,
        reconciliations,
        executionCompleted,
        interviewCompleted,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.pairing.count({ where: { status: 'active' } }),
        prisma.case.count(),
        prisma.case.count({ where: { status: 'completed' } }),
        prisma.judgment.count(),
        prisma.reconciliationPlan.count(),
        prisma.executionRecord.count({ where: { status: 'completed' } }),
        prisma.interviewSession.count({ where: { status: 'completed' } }),
      ]);

      const conversion = {
        pairingRate: users > 0 ? pairings / users : 0,
        caseCreationRate: pairings > 0 ? casesTotal / pairings : 0,
        judgmentCompletionRate: casesTotal > 0 ? judgments / casesTotal : 0,
        caseCompletionRate: casesTotal > 0 ? casesCompleted / casesTotal : 0,
      };

      res.json({
        success: true,
        data: {
          totals: {
            users,
            activePairings: pairings,
            cases: casesTotal,
            judgments,
            reconciliationPlans: reconciliations,
            executionCompleted,
            interviewCompleted,
          },
          conversion,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async reportFunnel(_req: Request, res: Response, next: NextFunction) {
    try {
      const [registerCount, pairingCount, caseCount, judgmentCount, executionCount] = await Promise.all([
        prisma.user.count(),
        prisma.pairing.count({ where: { status: 'active' } }),
        prisma.case.count(),
        prisma.judgment.count(),
        prisma.executionRecord.count({ where: { action: 'complete' } }),
      ]);

      res.json({
        success: true,
        data: {
          stages: [
            { key: 'register', count: registerCount },
            { key: 'pairing', count: pairingCount },
            { key: 'case', count: caseCount },
            { key: 'judgment', count: judgmentCount },
            { key: 'execution_complete', count: executionCount },
          ],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async exportOverviewCsv(_req: Request, res: Response, next: NextFunction) {
    try {
      const [users, cases, judgments] = await Promise.all([
        prisma.user.count(),
        prisma.case.count(),
        prisma.judgment.count(),
      ]);

      const lines = [
        'metric,value',
        `users,${users}`,
        `cases,${cases}`,
        `judgments,${judgments}`,
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="admin-overview.csv"');
      res.status(200).send(lines.join('\n'));
    } catch (error) {
      next(error);
    }
  }

  async upsertAlertRules(req: Request, res: Response, next: NextFunction) {
    try {
      const rulesInput = req.body?.rules;
      if (!Array.isArray(rulesInput)) {
        throw Errors.VALIDATION_ERROR('rules 必須為陣列');
      }
      const rules = normalizeManagedConfigValue('admin.alert.rules', rulesInput) as Prisma.JsonArray;

      const item = await prisma.systemConfig.upsert({
        where: { key: 'admin.alert.rules' },
        create: {
          key: 'admin.alert.rules',
          value: rules,
          description: 'Admin alert rules',
          is_runtime: true,
          updated_by: req.admin?.id,
        },
        update: {
          value: rules,
          updated_by: req.admin?.id,
        },
      });

      await adminService.writeAuditLog({
        actorId: req.admin?.id,
        actorType: 'admin',
        entityType: 'alert_rule',
        entityId: item.id,
        action: 'upsert',
        detail: {
          ruleCount: rules.length,
          enabledRuleCount: rules.filter((rule) => {
            return typeof rule === 'object' && !!rule && (rule as { enabled?: unknown }).enabled === true;
          }).length,
        },
      });

      res.json({ success: true, data: { item } });
    } catch (error) {
      next(error);
    }
  }

  async setFeatureFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const flagsInput = req.body?.flags;
      if (!flagsInput || typeof flagsInput !== 'object') {
        throw Errors.VALIDATION_ERROR('flags 必須為 object');
      }
      const flags = normalizeManagedConfigValue('feature.flags', flagsInput) as Prisma.JsonObject;
      const item = await prisma.systemConfig.upsert({
        where: { key: 'feature.flags' },
        create: {
          key: 'feature.flags',
          value: flags,
          description: 'Feature flags and A/B experiment toggles',
          is_runtime: true,
          updated_by: req.admin?.id,
        },
        update: {
          value: flags,
          updated_by: req.admin?.id,
        },
      });

      await adminService.writeAuditLog({
        actorId: req.admin?.id,
        actorType: 'admin',
        entityType: 'feature_flag',
        entityId: item.id,
        action: 'upsert',
        detail: {
          changedKeys: Object.keys(flags),
          totalKeys: Object.keys(flags).length,
        },
      });

      res.json({ success: true, data: { item } });
    } catch (error) {
      next(error);
    }
  }

  async customReport(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = Array.isArray(req.body?.metrics) ? req.body.metrics : [];
      const result: Record<string, number> = {};

      if (metrics.includes('dau')) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        result.dau = await prisma.user.count({ where: { last_login_at: { gte: since } } });
      }
      if (metrics.includes('mau')) {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        result.mau = await prisma.user.count({ where: { last_login_at: { gte: since } } });
      }
      if (metrics.includes('judgment_failed')) {
        result.judgment_failed = await prisma.case.count({ where: { status: 'judgment_failed' } });
      }

      res.json({ success: true, data: { metrics: result } });
    } catch (error) {
      next(error);
    }
  }

  async reportCosts(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await costMonitoringService.getAdminCostReport();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getInterviewRuntimeConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      const defaults = {
        maxTurns: env.INTERVIEW_MAX_TURNS,
        softTarget: env.INTERVIEW_SOFT_TARGET,
        turnIntervalMs: env.INTERVIEW_TURN_INTERVAL_MS,
        startRateLimit: env.INTERVIEW_START_RATE_LIMIT,
        dailySessionLimit: env.INTERVIEW_DAILY_SESSION_LIMIT,
      };
      const runtime = {
        maxTurns: await systemConfigService.getNumberConfig('interview.maxTurns', defaults.maxTurns),
        softTarget: await systemConfigService.getNumberConfig('interview.softTarget', defaults.softTarget),
        turnIntervalMs: await systemConfigService.getNumberConfig('interview.turnIntervalMs', defaults.turnIntervalMs),
        startRateLimit: await systemConfigService.getNumberConfig('interview.startRateLimit', defaults.startRateLimit),
        dailySessionLimit: await systemConfigService.getNumberConfig('interview.dailySessionLimit', defaults.dailySessionLimit),
      };

      res.json({
        success: true,
        data: {
          defaults,
          runtime,
          source: 'system_config_override_then_env_fallback',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();

