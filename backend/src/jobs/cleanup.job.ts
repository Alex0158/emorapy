import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import { sessionService } from '../services/session.service';
import { aiService } from '../services/ai.service';
import { asyncPipelineService } from '../services/async-pipeline.service';
import prisma from '../config/database';
import logger from '../config/logger';
import { env } from '../config/env';
import fs from 'fs/promises';
import path from 'path';
import {
  CLEANUP_THRESHOLDS,
  CASE_STATUS,
  CASE_MODE,
  INTERVIEW_STATUS,
  PAIRING_STATUS,
  PAIRING_TYPE,
  EXECUTION_ACTION,
} from '../utils/constants';
import { systemConfigService } from '../services/system-config.service';
import { runOpsAlertChecks } from '../services/ops-alerts.service';

type CronExecutionResult = {
  affectedCount?: number;
  detail?: Record<string, unknown>;
};

const manualTriggerMeta = new Map<
  string,
  { adminId?: string; at: number }
>();

const shouldBypassCronRunLog = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message || '';
  // Prisma 錯誤訊息在表不存在時通常會包含 relation/table does not exist
  return (
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('cron_run_logs')
  );
};

const withCronRunLog = async (
  jobName: string,
  handler: () => Promise<CronExecutionResult | void>
): Promise<void> => {
  const startedAt = new Date();
  const manualMeta = manualTriggerMeta.get(jobName);
  const isManual = !!manualMeta && (Date.now() - manualMeta.at < 60_000);
  if (isManual) {
    manualTriggerMeta.delete(jobName);
  }

  let logId: string | null = null;
  try {
    const log = await prisma.cronRunLog.create({
      data: {
        job_name: jobName,
        status: 'running',
        started_at: startedAt,
        triggered_by_admin_id: isManual ? manualMeta?.adminId : undefined,
        detail: { trigger: isManual ? 'manual' : 'scheduled' },
      },
    });
    logId = log.id;
  } catch (error) {
    if (shouldBypassCronRunLog(error)) {
      logger.warn('cron_run_logs unavailable, run without DB logging', { jobName });
    } else {
      logger.warn('Failed to write cron running log, continue job execution', { jobName, error });
    }
  }

  try {
    const result = await handler();
    const finishedAt = new Date();
    if (logId) {
      await prisma.cronRunLog.update({
        where: { id: logId },
        data: {
          status: 'success',
          finished_at: finishedAt,
          duration_ms: Math.max(finishedAt.getTime() - startedAt.getTime(), 1),
          affected_count: result?.affectedCount,
          detail: result?.detail ? (result.detail as Prisma.InputJsonValue) : undefined,
        },
      }).catch((error) => {
        logger.warn('Failed to finalize cron success log', { jobName, error });
      });
    }
  } catch (error) {
    const finishedAt = new Date();
    if (logId) {
      await prisma.cronRunLog.update({
        where: { id: logId },
        data: {
          status: 'failed',
          finished_at: finishedAt,
          duration_ms: Math.max(finishedAt.getTime() - startedAt.getTime(), 1),
          error_message: error instanceof Error ? error.message : 'Unknown cron error',
        },
      }).catch((updateError) => {
        logger.warn('Failed to finalize cron failure log', { jobName, error: updateError });
      });
    }
    // 保持舊語義：任務失敗應被記錄，但不向上拋出以免影響 cron scheduler
    return;
  }
};

/**
 * 清理過期Session（每小時執行一次）
 */
export const cleanupExpiredSessions = cron.schedule('0 * * * *', async () => {
  await withCronRunLog('cleanup_expired_sessions', async () => {
    try {
      const count = await sessionService.cleanupExpiredSessions(1000);
      // 根據環境調整日誌級別
      if (env.NODE_ENV === 'development') {
        logger.debug('Expired sessions cleaned up', { count });
      } else {
        logger.info('Expired sessions cleaned up', { count });
      }
      return { affectedCount: count };
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error });
      throw error;
    }
  });
});

/**
 * 清理孤兒上傳文件（每天凌晨3點）
 * 只刪除未在 evidence 表中的文件，避免佔用磁碟
 */
export const cleanupOrphanUploads = cron.schedule('0 3 * * *', async () => {
  await withCronRunLog('cleanup_orphan_uploads', async () => {
    try {
      const uploadPath = path.isAbsolute(env.UPLOAD_DIR)
        ? env.UPLOAD_DIR
        : path.join(process.cwd(), env.UPLOAD_DIR);

      const files = await fs.readdir(uploadPath).catch(() => []);
      if (files.length === 0) return { affectedCount: 0 };

      const evidenceFiles = await prisma.evidence.findMany({
        select: { file_url: true },
      });
      const used = new Set(
        evidenceFiles
          .map(e => {
            try {
              return path.basename(new URL(e.file_url).pathname);
            } catch {
              return path.basename(e.file_url);
            }
          })
          .filter(Boolean)
      );

      let removed = 0;
      const resolvedUploadPath = path.resolve(uploadPath);
      for (const file of files) {
        if (file === '.' || file === '..' || file.includes(path.sep) || file.includes('/')) continue;
        const full = path.join(uploadPath, file);
        if (!path.resolve(full).startsWith(resolvedUploadPath)) continue;
        const stat = await fs.stat(full).catch(() => null);
        if (!stat || !stat.isFile()) continue;
        if (!used.has(file)) {
          await fs.unlink(full).catch((e) => { logger.warn('Failed to remove orphan file', { file, error: e }); });
          removed++;
        }
      }

      if (removed > 0) {
        logger.info('Orphan uploads cleaned', { removed });
      }
      return { affectedCount: removed };
    } catch (error) {
      logger.error('Failed to cleanup orphan uploads', { error });
      throw error;
    }
  });
});

/**
 * 清理過期臨時配對（每晚2點）
 */
export const cleanupTempPairings = cron.schedule('0 2 * * *', async () => {
  await withCronRunLog('cleanup_temp_pairings', async () => {
    try {
      const expiredAt = new Date(Date.now() - CLEANUP_THRESHOLDS.TEMP_PAIRING_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const result = await prisma.pairing.deleteMany({
        where: {
          pairing_type: PAIRING_TYPE.QUICK,
          status: PAIRING_STATUS.TEMP,
          created_at: { lt: expiredAt },
        },
      });
      if (result.count > 0) {
        logger.info('Temp pairings cleaned', { count: result.count });
      }
      return { affectedCount: result.count };
    } catch (error) {
      logger.error('Failed to cleanup temp pairings', { error });
      throw error;
    }
  });
});

/**
 * 清理逾時未結束的訪談 session（每小時執行一次）
 * 將 in_progress 且 updated_at 超過 24 小時的 session 設為 abandoned；
 * 若輪次 ≥ MIN_TURNS_FOR_PIPELINE，則觸發 asyncPipelineService.process(sessionId)（fire and forget）
 */
export const cleanupAbandonedInterviewSessions = cron.schedule('0 * * * *', async () => {
  await withCronRunLog('cleanup_abandoned_interview_sessions', async () => {
    try {
      const cutoff = new Date(Date.now() - CLEANUP_THRESHOLDS.ABANDONED_SESSION_HOURS * 60 * 60 * 1000);
      const sessions = await prisma.interviewSession.findMany({
        where: {
          status: INTERVIEW_STATUS.IN_PROGRESS,
          updated_at: { lt: cutoff },
        },
        include: {
          _count: { select: { turns: true } },
        },
      });
      for (const s of sessions) {
        if (s._count.turns >= CLEANUP_THRESHOLDS.MIN_TURNS_FOR_PIPELINE) {
          await prisma.interviewSession.update({
            where: { id: s.id },
            data: { status: INTERVIEW_STATUS.PROCESSING, ended_at: new Date() },
          });
          asyncPipelineService.process(s.id).catch((err) => {
            logger.error('Cleanup: async pipeline after abandon failed', { sessionId: s.id, error: err });
          });
        } else {
          await prisma.interviewSession.update({
            where: { id: s.id },
            data: { status: INTERVIEW_STATUS.ABANDONED },
          });
        }
      }
      if (sessions.length > 0) {
        logger.info('Abandoned interview sessions cleaned', { count: sessions.length });
      }
      return { affectedCount: sessions.length };
    } catch (error) {
      logger.error('Failed to cleanup abandoned interview sessions', { error });
      throw error;
    }
  });
});

/**
 * 清理過期驗證碼（每小時執行一次）
 */
export const cleanupExpiredVerifications = cron.schedule('0 * * * *', async () => {
  await withCronRunLog('cleanup_expired_verifications', async () => {
    try {
      const result = await prisma.emailVerification.deleteMany({
        where: {
          OR: [
            { expires_at: { lt: new Date() } },
            { used: true, created_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          ],
        },
      });
      // 根據環境調整日誌級別
      if (env.NODE_ENV === 'development') {
        logger.debug('Expired verifications cleaned up', { count: result.count });
      } else {
        logger.info('Expired verifications cleaned up', { count: result.count });
      }
      return { affectedCount: result.count };
    } catch (error) {
      logger.error('Failed to cleanup expired verifications', { error });
      throw error;
    }
  });
});

/**
 * 重置AI服務每日調用計數（每天0點執行）
 */
export const resetAIDailyCount = cron.schedule('0 0 * * *', async () => {
  await withCronRunLog('reset_ai_daily_count', async () => {
    try {
      await aiService.resetDailyCallCount().catch(err => logger.error('Failed to reset AI daily count', { error: err }));
      // 根據環境調整日誌級別
      if (env.NODE_ENV === 'development') {
        logger.debug('AI service daily call count reset');
      } else {
        logger.info('AI service daily call count reset');
      }
      return { detail: { reset: true } };
    } catch (error) {
      logger.error('Failed to reset AI daily count', { error });
      throw error;
    }
  });
});

/**
 * 7天跟進提醒（每天上午10點）
 * 對已完成判決但尚未生成和好方案的案件，提醒用戶
 */
export const followUp7Day = cron.schedule('0 10 * * *', async () => {
  await withCronRunLog('follow_up_7_day', async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - CLEANUP_THRESHOLDS.FOLLOWUP_7_DAYS * 24 * 60 * 60 * 1000);
      const eightDaysAgo = new Date(Date.now() - CLEANUP_THRESHOLDS.FOLLOWUP_8_DAYS * 24 * 60 * 60 * 1000);

      const cases = await prisma.case.findMany({
        where: {
          status: CASE_STATUS.COMPLETED,
          mode: CASE_MODE.REMOTE,
          completed_at: { gte: eightDaysAgo, lte: sevenDaysAgo },
          judgment: {
            reconciliation_plans: { none: {} },
          },
        },
        include: {
          plaintiff: { select: { id: true, notification_enabled: true } },
          defendant: { select: { id: true, notification_enabled: true } },
          judgment: { select: { id: true } },
        },
      });

      const allDedupKeys: string[] = [];
      const dedupKeyCaseMap = new Map<string, typeof cases[number]>();
      const dedupKeyUserMap = new Map<string, string>();

      for (const c of cases) {
        const parties = [
          { id: c.plaintiff_id, enabled: c.plaintiff?.notification_enabled },
          { id: c.defendant_id, enabled: c.defendant?.notification_enabled },
        ];
        for (const party of parties) {
          if (!party.id || party.enabled === false) continue;
          const dedupKey = `followup_7d_${c.id}_${party.id}`;
          allDedupKeys.push(dedupKey);
          dedupKeyCaseMap.set(dedupKey, c);
          dedupKeyUserMap.set(dedupKey, party.id);
        }
      }

      const existingNotifs = allDedupKeys.length > 0
        ? await prisma.notification.findMany({
            where: { dedup_key: { in: allDedupKeys } },
            select: { dedup_key: true },
          })
        : [];
      const existingKeys = new Set(existingNotifs.map(n => n.dedup_key));

      const toCreate = allDedupKeys
        .filter(k => !existingKeys.has(k))
        .map(k => {
          const c = dedupKeyCaseMap.get(k)!;
          const userId = dedupKeyUserMap.get(k)!;
          return {
            user_id: userId,
            channel: 'email' as const,
            template_code: 'followup_7day',
            payload: {
              case_id: c.id,
              judgment_id: c.judgment?.id,
              case_title: c.title,
            },
            dedup_key: k,
            status: 'pending' as const,
          };
        });

      let created = 0;
      if (toCreate.length > 0) {
        const result = await prisma.notification.createMany({ data: toCreate, skipDuplicates: true });
        created = result.count;
      }

      if (created > 0) {
        logger.info('7-day follow-up notifications created', { count: created });
      }
      return { affectedCount: created };
    } catch (error) {
      logger.error('Failed to create 7-day follow-up notifications', { error });
      throw error;
    }
  });
});

/**
 * 30天跟進提醒（每天上午10點）
 * 對已選擇和好方案但執行進度不足50%的案件，提醒用戶
 */
export const followUp30Day = cron.schedule('0 10 * * *', async () => {
  await withCronRunLog('follow_up_30_day', async () => {
    try {
    const thirtyDaysAgo = new Date(Date.now() - CLEANUP_THRESHOLDS.FOLLOWUP_30_DAYS * 24 * 60 * 60 * 1000);
    const thirtyOneDaysAgo = new Date(Date.now() - CLEANUP_THRESHOLDS.FOLLOWUP_31_DAYS * 24 * 60 * 60 * 1000);

    const plans = await prisma.reconciliationPlan.findMany({
      where: {
        OR: [{ user1_selected: true }, { user2_selected: true }],
        created_at: { gte: thirtyOneDaysAgo, lte: thirtyDaysAgo },
      },
      include: {
        judgment: {
          include: {
            case: {
              select: {
                id: true, title: true, plaintiff_id: true, defendant_id: true,
                plaintiff: { select: { notification_enabled: true } },
                defendant: { select: { notification_enabled: true } },
              },
            },
          },
        },
        execution_records: true,
      },
    });

    const allDedupKeys30: string[] = [];
    const dedupKeyPlanMap = new Map<string, { plan: typeof plans[number]; userId: string; progress: number }>();

    for (const plan of plans) {
      const checkins = plan.execution_records.filter(r => r.action === EXECUTION_ACTION.CHECKIN);
      const estimatedDuration = plan.estimated_duration || CLEANUP_THRESHOLDS.DEFAULT_ESTIMATED_DURATION_DAYS;
      const progress = Math.min(100, Math.round((checkins.length / estimatedDuration) * 100));

      if (progress >= CLEANUP_THRESHOLDS.FOLLOWUP_PROGRESS_THRESHOLD) continue;

      const c = plan.judgment.case;
      const parties = [
        { id: c.plaintiff_id, enabled: c.plaintiff?.notification_enabled },
        { id: c.defendant_id, enabled: c.defendant?.notification_enabled },
      ];
      for (const party of parties) {
        if (!party.id || party.enabled === false) continue;
        const dedupKey = `followup_30d_${plan.id}_${party.id}`;
        allDedupKeys30.push(dedupKey);
        dedupKeyPlanMap.set(dedupKey, { plan, userId: party.id, progress });
      }
    }

    const existingNotifs30 = allDedupKeys30.length > 0
      ? await prisma.notification.findMany({
          where: { dedup_key: { in: allDedupKeys30 } },
          select: { dedup_key: true },
        })
      : [];
    const existingKeys30 = new Set(existingNotifs30.map(n => n.dedup_key));

    const toCreate30 = allDedupKeys30
      .filter(k => !existingKeys30.has(k))
      .map(k => {
        const { plan, userId, progress } = dedupKeyPlanMap.get(k)!;
        const c = plan.judgment.case;
        return {
          user_id: userId,
          channel: 'email' as const,
          template_code: 'followup_30day',
          payload: {
            case_id: c.id,
            plan_id: plan.id,
            case_title: c.title,
            progress,
          },
          dedup_key: k,
          status: 'pending' as const,
        };
      });

    let created = 0;
    if (toCreate30.length > 0) {
      const result = await prisma.notification.createMany({ data: toCreate30, skipDuplicates: true });
      created = result.count;
    }

      if (created > 0) {
        logger.info('30-day follow-up notifications created', { count: created });
      }
      return { affectedCount: created };
    } catch (error) {
      logger.error('Failed to create 30-day follow-up notifications', { error });
      throw error;
    }
  });
});

/**
 * 清理逾時未回應的遠程 draft 案件（每天凌晨 4 點）
 * 將 draft 狀態的遠程案件在 14 天後自動取消，避免永久懸掛
 */
export const cleanupStaleDraftCases = cron.schedule('0 4 * * *', async () => {
  await withCronRunLog('cleanup_stale_draft_cases', async () => {
    try {
      const cutoff = new Date(Date.now() - CLEANUP_THRESHOLDS.STALE_DRAFT_DAYS * 24 * 60 * 60 * 1000);
      const result = await prisma.case.updateMany({
        where: {
          status: CASE_STATUS.DRAFT,
          mode: CASE_MODE.REMOTE,
          defendant_statement: null,
          created_at: { lt: cutoff },
        },
        data: { status: CASE_STATUS.CANCELLED },
      });
      if (result.count > 0) {
        logger.info('Stale remote draft cases cancelled', { count: result.count });
      }
      return { affectedCount: result.count };
    } catch (error) {
      logger.error('Failed to cleanup stale draft cases', { error });
      throw error;
    }
  });
});

/**
 * 偵測卡住的 processing session（每 30 分鐘）
 * 將 processing 超過 10 分鐘的 session 標記為 processing_failed，允許用戶從「我的故事」重試
 */
export const cleanupStuckProcessingSessions = cron.schedule('*/30 * * * *', async () => {
  await withCronRunLog('cleanup_stuck_processing_sessions', async () => {
    try {
      const cutoff = new Date(Date.now() - CLEANUP_THRESHOLDS.STUCK_PROCESSING_MINUTES * 60 * 1000);
      const result = await prisma.interviewSession.updateMany({
        where: {
          status: INTERVIEW_STATUS.PROCESSING,
          updated_at: { lt: cutoff },
        },
        data: { status: INTERVIEW_STATUS.PROCESSING_FAILED },
      });
      if (result.count > 0) {
        logger.warn('Stuck processing sessions marked as failed', { count: result.count });
      }
      return { affectedCount: result.count };
    } catch (error) {
      logger.error('Failed to cleanup stuck processing sessions', { error });
      throw error;
    }
  });
});

/**
 * 運維告警檢查（每 5 分鐘）
 * 會檢查 lock degraded / 5xx / 409 比例，並可選擇推送 Slack。
 */
export const runOpsAlertsCheck = cron.schedule('*/5 * * * *', async () => {
  await withCronRunLog('ops_alerts_check', async () => {
    try {
      const apiBaseUrl = env.OPS_ALERTS_API_BASE_URL || `http://127.0.0.1:${env.PORT}`;
      const result = await runOpsAlertChecks({
        apiBaseUrl,
        redisUrl: env.REDIS_URL,
        healthTimeoutMs: env.OPS_ALERTS_HEALTH_TIMEOUT_MS,
        lookbackMinutes: env.OPS_ALERTS_LOOKBACK_MINUTES,
        minSamples: env.OPS_ALERTS_MIN_SAMPLES,
        max5xxRatio: env.OPS_ALERTS_MAX_5XX_RATIO,
        maxConflictRatio: env.OPS_ALERTS_MAX_CONFLICT_RATIO,
        healthOrigin: env.ALERT_HEALTH_ORIGIN,
        slackWebhookUrl: env.ALERT_SLACK_WEBHOOK_URL,
        slackDedupWindowSeconds: env.ALERT_SLACK_DEDUP_WINDOW_SECONDS,
      });

      if (result.status === 'alert') {
        logger.warn('Ops alerts check detected alerts', {
          checks: result.checks.filter((check) => check.status === 'alert').map((check) => check.name),
          slack: result.slack,
        });
      } else {
        logger.info('Ops alerts check passed', {
          slack: result.slack,
        });
      }

      return {
        affectedCount: result.checks.filter((check) => check.status === 'alert').length,
        detail: {
          status: result.status,
          slack: result.slack,
        },
      };
    } catch (error) {
      logger.error('Failed to run ops alerts check', { error });
      throw error;
    }
  });
});

export const adminJobs = [
  { key: 'cleanup_expired_sessions', schedule: '0 * * * *', task: cleanupExpiredSessions },
  { key: 'cleanup_abandoned_interview_sessions', schedule: '0 * * * *', task: cleanupAbandonedInterviewSessions },
  { key: 'cleanup_stuck_processing_sessions', schedule: '*/30 * * * *', task: cleanupStuckProcessingSessions },
  { key: 'cleanup_expired_verifications', schedule: '0 * * * *', task: cleanupExpiredVerifications },
  { key: 'reset_ai_daily_count', schedule: '0 0 * * *', task: resetAIDailyCount },
  { key: 'cleanup_orphan_uploads', schedule: '0 3 * * *', task: cleanupOrphanUploads },
  { key: 'cleanup_temp_pairings', schedule: '0 2 * * *', task: cleanupTempPairings },
  { key: 'cleanup_stale_draft_cases', schedule: '0 4 * * *', task: cleanupStaleDraftCases },
  { key: 'ops_alerts_check', schedule: '*/5 * * * *', task: runOpsAlertsCheck },
  { key: 'follow_up_7_day', schedule: '0 10 * * *', task: followUp7Day },
  { key: 'follow_up_30_day', schedule: '0 10 * * *', task: followUp30Day },
] as const;

export const runAdminJobNow = async (
  jobKey: string,
  triggeredByAdminId?: string
): Promise<{ accepted: boolean; mode: 'immediate' | 'unknown' }> => {
  const job = adminJobs.find((j) => j.key === jobKey);
  if (!job) return { accepted: false, mode: 'unknown' };
  const task = job.task as unknown as { now?: () => void };
  if (typeof task.now !== 'function') return { accepted: false, mode: 'unknown' };
  manualTriggerMeta.set(jobKey, { adminId: triggeredByAdminId, at: Date.now() });
  task.now();
  return { accepted: true, mode: 'immediate' };
};

export let jobsStarted = false;

export const getRuntimeJobsEnabled = async (): Promise<boolean> => {
  const envEnabled = process.env.ENABLE_SCHEDULED_JOBS !== 'false' &&
    (env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULED_JOBS === 'true');
  return systemConfigService.getBooleanConfig('jobs.enabled', envEnabled);
};

/**
 * 啟動所有定時任務
 * 根據環境變量 ENABLE_SCHEDULED_JOBS 決定是否啟動
 * 默認：生產環境啟用，開發環境可通過環境變量禁用
 */
export const startJobs = () => {
  // 保持同步啟動語義（供現有調用與測試使用）
  const enableJobs = process.env.ENABLE_SCHEDULED_JOBS !== 'false' &&
    (env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULED_JOBS === 'true');

  // 若 DB 初始化被跳過或不可用，則不啟動
  if (process.env.SKIP_DB_INIT !== 'false' && env.NODE_ENV === 'test') {
    logger.info('跳過定時任務：測試環境且已跳過DB初始化');
    return;
  }

  if (!enableJobs) {
    logger.info('Scheduled jobs are disabled', { 
      reason: env.NODE_ENV === 'development' ? 'development environment' : 'ENABLE_SCHEDULED_JOBS=false' 
    });
    return;
  }

  cleanupExpiredSessions.start();
  cleanupAbandonedInterviewSessions.start();
  cleanupStuckProcessingSessions.start();
  cleanupExpiredVerifications.start();
  resetAIDailyCount.start();
  cleanupOrphanUploads.start();
  cleanupTempPairings.start();
  cleanupStaleDraftCases.start();
  runOpsAlertsCheck.start();
  followUp7Day.start();
  followUp30Day.start();
  jobsStarted = true;
  logger.info('Scheduled jobs started', { env: env.NODE_ENV });
};

export const reconcileJobsRuntimeConfig = async (): Promise<boolean> => {
  const runtimeEnabled = await getRuntimeJobsEnabled();
  if (runtimeEnabled && !jobsStarted) {
    startJobs();
  } else if (!runtimeEnabled && jobsStarted) {
    stopJobs();
  }
  return runtimeEnabled;
};

/**
 * 停止所有定時任務
 */
export const stopJobs = () => {
  cleanupExpiredSessions.stop();
  cleanupAbandonedInterviewSessions.stop();
  cleanupStuckProcessingSessions.stop();
  cleanupExpiredVerifications.stop();
  resetAIDailyCount.stop();
  cleanupOrphanUploads.stop();
  cleanupTempPairings.stop();
  cleanupStaleDraftCases.stop();
  runOpsAlertsCheck.stop();
  followUp7Day.stop();
  followUp30Day.stop();
  jobsStarted = false;
  logger.info('Scheduled jobs stopped');
};
