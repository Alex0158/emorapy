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
import { aiStreamService } from '../services/ai-stream.service';

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

const createJob = (expression: string, task: () => Promise<void>) =>
  cron.createTask(expression, task);

/**
 * 清理過期Session（每小時執行一次）
 */
export const cleanupExpiredSessions = createJob('0 * * * *', async () => {
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
export const cleanupOrphanUploads = createJob('0 3 * * *', async () => {
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
export const cleanupTempPairings = createJob('0 2 * * *', async () => {
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
export const cleanupAbandonedInterviewSessions = createJob('0 * * * *', async () => {
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
export const cleanupExpiredVerifications = createJob('0 * * * *', async () => {
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
export const resetAIDailyCount = createJob('0 0 * * *', async () => {
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
 * 修復旅程早期提醒（每天上午10點）
 * - 判決完成後 48h 尚未選方向 / 尚未生成方案
 */
export const followUp7Day = createJob('0 10 * * *', async () => {
  await withCronRunLog('follow_up_7_day', async () => {
    try {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

      const cases = await prisma.case.findMany({
        where: {
          status: CASE_STATUS.COMPLETED,
          mode: CASE_MODE.REMOTE,
          completed_at: { gte: seventyTwoHoursAgo, lte: fortyEightHoursAgo },
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
          const dedupKey = `repair_choose_direction_${c.id}_${party.id}`;
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
          template_code: 'repair_journey_choose_direction',
          action_key: 'open_reconciliation_entry' as const,
          priority: 'soon' as const,
          group_key: c.judgment?.id ? `judgment_${c.judgment.id}` : `case_${c.id}`,
          payload: {
            case_id: c.id,
            judgment_id: c.judgment?.id,
            case_title: c.title,
            path: c.judgment?.id ? `/reconciliation/${c.judgment.id}` : null,
            entity_type: c.judgment?.id ? 'judgment' : 'case',
            entity_id: c.judgment?.id ?? c.id,
            cta_label: '看看最適合你們的下一步',
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
        logger.info('Repair journey choose-direction notifications created', { count: created });
      }
      return { affectedCount: created };
    } catch (error) {
      logger.error('Failed to create repair journey choose-direction notifications', { error });
      throw error;
    }
  });
});

/**
 * 修復旅程狀態提醒（每天上午10點）
 * - 已承諾但 24h 未開始
 * - partner_invited 48h 未查看
 * - partner_invited 72h 未回應
 * - replanning 24h 未處理
 * - paused 7d 未恢復
 */
export const followUp30Day = createJob('0 10 * * *', async () => {
  await withCronRunLog('follow_up_30_day', async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const tracks = await prisma.repairTrack.findMany({
        where: {
          status: {
            in: ['draft', 'partner_invited', 'replanning', 'paused'],
          },
        },
        include: {
          plan: {
            include: {
              judgment: {
                include: {
                  case: {
                    select: {
                      id: true,
                      title: true,
                      plaintiff_id: true,
                      defendant_id: true,
                      plaintiff: { select: { notification_enabled: true } },
                      defendant: { select: { notification_enabled: true } },
                    },
                  },
                },
              },
            },
          },
          participant_states: true,
        },
      });

      const pendingNotifications: Array<{
        user_id: string;
        channel: 'email';
        template_code: string;
        action_key?: string;
        priority?: string;
        group_key?: string;
        payload: Prisma.InputJsonValue;
        dedup_key: string;
        status: 'pending';
      }> = [];

      for (const track of tracks) {
        const c = track.plan.judgment.case;
        const currentParties = [
          { id: c.plaintiff_id, enabled: c.plaintiff?.notification_enabled },
          { id: c.defendant_id, enabled: c.defendant?.notification_enabled },
        ].filter((party) => Boolean(party.id) && party.enabled !== false) as Array<{ id: string; enabled?: boolean | null }>;

        if (
          track.status === 'draft'
          && track.updated_at <= twentyFourHoursAgo
          && track.participant_states.some((state) => state.commitment_status === 'committed')
          && !track.started_at
        ) {
          for (const party of currentParties) {
            const state = track.participant_states.find((item) => item.user_id === party.id);
            if (state?.commitment_status !== 'committed') continue;
            pendingNotifications.push({
              user_id: party.id,
              channel: 'email',
              template_code: 'repair_journey_start_step',
              action_key: 'continue_today_step',
              priority: 'now',
              group_key: `repair_track_${track.id}`,
              payload: {
                case_id: c.id,
                plan_id: track.plan_id,
                repair_track_id: track.id,
                case_title: c.title,
                path: `/execution/${track.plan_id}/checkin`,
                journey_status: track.status,
                entity_type: 'repair_track',
                entity_id: track.id,
                cta_label: '開始今天的一小步',
              },
              dedup_key: `repair_start_step_${track.id}_${party.id}`,
              status: 'pending',
            });
          }
        }

        if (track.status === 'partner_invited') {
          const invitee = track.participant_states.find((state) => !!state.invited_at);
          const inviter = track.participant_states.find((state) => state.commitment_status === 'committed');
          if (invitee?.user_id && invitee.invited_at && invitee.commitment_status === 'not_viewed' && invitee.invited_at <= fortyEightHoursAgo) {
            pendingNotifications.push({
              user_id: invitee.user_id,
              channel: 'email',
              template_code: 'repair_journey_partner_invited',
              action_key: 'review_invitation',
              priority: 'now',
              group_key: `repair_track_${track.id}`,
              payload: {
                case_id: c.id,
                plan_id: track.plan_id,
                repair_track_id: track.id,
                case_title: c.title,
                path: `/reconciliation/${track.plan.judgment_id}/${track.plan_id}`,
                journey_status: track.status,
                entity_type: 'repair_track',
                entity_id: track.id,
                cta_label: '查看這個邀請',
              },
              dedup_key: `repair_partner_invited_${track.id}_${invitee.user_id}`,
              status: 'pending',
            });
          }

          if (
            inviter?.user_id
            && track.partner_invited_at
            && track.partner_invited_at <= seventyTwoHoursAgo
            && !track.participant_states.some((state) => state.commitment_status === 'declined' || state.commitment_status === 'committed' && state.user_id !== inviter.user_id)
          ) {
            pendingNotifications.push({
              user_id: inviter.user_id,
              channel: 'email',
              template_code: 'repair_journey_partner_no_response',
              action_key: 'view_invitation_status',
              priority: 'soon',
              group_key: `repair_track_${track.id}`,
              payload: {
                case_id: c.id,
                plan_id: track.plan_id,
                repair_track_id: track.id,
                case_title: c.title,
                path: `/reconciliation/${track.plan.judgment_id}/${track.plan_id}`,
                journey_status: track.status,
                entity_type: 'repair_track',
                entity_id: track.id,
                cta_label: '查看目前狀態',
              },
              dedup_key: `repair_partner_no_response_${track.id}_${inviter.user_id}`,
              status: 'pending',
            });
          }
        }

        if (track.status === 'replanning' && track.updated_at <= twentyFourHoursAgo) {
          for (const party of currentParties) {
            pendingNotifications.push({
              user_id: party.id,
              channel: 'email',
              template_code: 'repair_journey_replan',
              action_key: 'replan_track',
              priority: 'now',
              group_key: `repair_track_${track.id}`,
              payload: {
                case_id: c.id,
                plan_id: track.plan_id,
                repair_track_id: track.id,
                case_title: c.title,
                path: `/execution/${track.plan_id}/replan`,
                journey_status: track.status,
                entity_type: 'repair_track',
                entity_id: track.id,
                cta_label: '重新調整這一輪',
              },
              dedup_key: `repair_replan_${track.id}_${party.id}`,
              status: 'pending',
            });
          }
        }

        if (track.status === 'paused' && track.paused_at && track.paused_at <= sevenDaysAgo) {
          for (const party of currentParties) {
            pendingNotifications.push({
              user_id: party.id,
              channel: 'email',
              template_code: 'repair_journey_resume',
              action_key: 'resume_track',
              priority: 'soon',
              group_key: `repair_track_${track.id}`,
              payload: {
                case_id: c.id,
                plan_id: track.plan_id,
                repair_track_id: track.id,
                case_title: c.title,
                path: `/reconciliation/${track.plan.judgment_id}/${track.plan_id}`,
                journey_status: track.status,
                entity_type: 'repair_track',
                entity_id: track.id,
                cta_label: '恢復這一輪',
              },
              dedup_key: `repair_resume_${track.id}_${party.id}`,
              status: 'pending',
            });
          }
        }
      }

      const dedupKeys = pendingNotifications.map((item) => item.dedup_key);
      const existing = dedupKeys.length > 0
        ? await prisma.notification.findMany({
            where: { dedup_key: { in: dedupKeys } },
            select: { dedup_key: true },
          })
        : [];
      const existingKeys = new Set(existing.map((item) => item.dedup_key));
      const toCreate = pendingNotifications.filter((item) => !existingKeys.has(item.dedup_key));

      let created = 0;
      if (toCreate.length > 0) {
        const result = await prisma.notification.createMany({ data: toCreate, skipDuplicates: true });
        created = result.count;
      }

      if (created > 0) {
        logger.info('Repair journey status notifications created', { count: created });
      }
      return { affectedCount: created };
    } catch (error) {
      logger.error('Failed to create repair journey status notifications', { error });
      throw error;
    }
  });
});

/**
 * 清理逾時未回應的遠程 draft 案件（每天凌晨 4 點）
 * 將 draft 狀態的遠程案件在 14 天後自動取消，避免永久懸掛
 */
export const cleanupStaleDraftCases = createJob('0 4 * * *', async () => {
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
 * 清理 AI Stream 持久化資料（每天凌晨 5 點）
 * - events 預設保留 14 天
 * - sessions 預設保留 30 天，且僅清理已終態 stream
 */
export const cleanupAIStreamPersistence = createJob('0 5 * * *', async () => {
  await withCronRunLog('cleanup_ai_stream_persistence', async () => {
    try {
      const result = await aiStreamService.cleanupPersistence({
        sessionRetentionDays: env.AI_STREAM_SESSION_RETENTION_DAYS,
        eventRetentionDays: env.AI_STREAM_EVENT_RETENTION_DAYS,
        archiveEnabled: env.AI_STREAM_ARCHIVE_ENABLED,
        archiveBatchSize: env.AI_STREAM_ARCHIVE_BATCH_SIZE,
      });
      if ((result.deletedEvents as number) > 0 || (result.deletedSessions as number) > 0) {
        logger.info('AI Stream persistence cleaned', result);
      }
      return {
        affectedCount: Number(result.deletedEvents || 0) + Number(result.deletedSessions || 0),
        detail: result as Record<string, unknown>,
      };
    } catch (error) {
      logger.error('Failed to cleanup AI Stream persistence', { error });
      throw error;
    }
  });
});

/**
 * 偵測卡住的 processing session（每 30 分鐘）
 * 將 processing 超過 10 分鐘的 session 標記為 processing_failed，允許用戶從「我的故事」重試
 */
export const cleanupStuckProcessingSessions = createJob('*/30 * * * *', async () => {
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
export const runOpsAlertsCheck = createJob('*/5 * * * *', async () => {
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
  { key: 'cleanup_ai_stream_persistence', schedule: '0 5 * * *', task: cleanupAIStreamPersistence },
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
  const task = job.task as unknown as {
    execute?: () => Promise<unknown> | unknown;
    now?: () => Promise<unknown> | unknown;
  };
  const runNow = typeof task.execute === 'function' ? task.execute : task.now;
  if (!runNow) return { accepted: false, mode: 'unknown' };
  manualTriggerMeta.set(jobKey, { adminId: triggeredByAdminId, at: Date.now() });
  await runNow.call(task);
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
  cleanupAIStreamPersistence.start();
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
  cleanupAIStreamPersistence.stop();
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
