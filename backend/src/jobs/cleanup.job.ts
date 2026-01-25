import cron from 'node-cron';
import { sessionService } from '../services/session.service';
import { aiService } from '../services/ai.service';
import prisma from '../config/database';
import logger from '../config/logger';
import { env } from '../config/env';
import fs from 'fs/promises';
import path from 'path';

/**
 * 清理過期Session（每小時執行一次）
 */
export const cleanupExpiredSessions = cron.schedule('0 * * * *', async () => {
  try {
    const count = await sessionService.cleanupExpiredSessions(1000);
    // 根據環境調整日誌級別
    if (env.NODE_ENV === 'development') {
      logger.debug('Expired sessions cleaned up', { count });
    } else {
      logger.info('Expired sessions cleaned up', { count });
    }
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', { error });
  }
});

/**
 * 清理孤兒上傳文件（每天凌晨3點）
 * 只刪除未在 evidence 表中的文件，避免佔用磁碟
 */
export const cleanupOrphanUploads = cron.schedule('0 3 * * *', async () => {
  try {
    const uploadPath = path.isAbsolute(env.UPLOAD_DIR)
      ? env.UPLOAD_DIR
      : path.join(process.cwd(), env.UPLOAD_DIR);

    const files = await fs.readdir(uploadPath).catch(() => []);
    if (files.length === 0) return;

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
    for (const file of files) {
      const full = path.join(uploadPath, file);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat || !stat.isFile()) continue;
      if (!used.has(file)) {
        await fs.unlink(full).catch(() => {});
        removed++;
      }
    }

    if (removed > 0) {
      logger.info('Orphan uploads cleaned', { removed });
    }
  } catch (error) {
    logger.error('Failed to cleanup orphan uploads', { error });
  }
});

/**
 * 清理過期臨時配對（每晚2點）
 */
export const cleanupTempPairings = cron.schedule('0 2 * * *', async () => {
  try {
    const expiredAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30天
    const result = await prisma.pairing.deleteMany({
      where: {
        pairing_type: 'quick',
        status: 'temp',
        created_at: { lt: expiredAt },
      },
    });
    if (result.count > 0) {
      logger.info('Temp pairings cleaned', { count: result.count });
    }
  } catch (error) {
    logger.error('Failed to cleanup temp pairings', { error });
  }
});

/**
 * 清理過期驗證碼（每小時執行一次）
 */
export const cleanupExpiredVerifications = cron.schedule('0 * * * *', async () => {
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
  } catch (error) {
    logger.error('Failed to cleanup expired verifications', { error });
  }
});

/**
 * 重置AI服務每日調用計數（每天0點執行）
 */
export const resetAIDailyCount = cron.schedule('0 0 * * *', () => {
  try {
    aiService.resetDailyCallCount().catch(err => logger.error('Failed to reset AI daily count', { error: err }));
    // 根據環境調整日誌級別
    if (env.NODE_ENV === 'development') {
      logger.debug('AI service daily call count reset');
    } else {
      logger.info('AI service daily call count reset');
    }
  } catch (error) {
    logger.error('Failed to reset AI daily count', { error });
  }
});

export let jobsStarted = false;

/**
 * 啟動所有定時任務
 * 根據環境變量 ENABLE_SCHEDULED_JOBS 決定是否啟動
 * 默認：生產環境啟用，開發環境可通過環境變量禁用
 */
export const startJobs = () => {
  // 檢查是否啟用定時任務
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
  cleanupExpiredVerifications.start();
  resetAIDailyCount.start();
  cleanupOrphanUploads.start();
  cleanupTempPairings.start();
  jobsStarted = true;
  logger.info('Scheduled jobs started', { env: env.NODE_ENV });
};

/**
 * 停止所有定時任務
 */
export const stopJobs = () => {
  cleanupExpiredSessions.stop();
  cleanupExpiredVerifications.stop();
  resetAIDailyCount.stop();
  cleanupTempPairings.stop();
  jobsStarted = false;
  logger.info('Scheduled jobs stopped');
};
