import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { generateSessionId, validateSessionId } from '../utils/session';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import crypto from 'crypto';
import { SESSION_EXPIRY } from '../utils/constants';
import { buildClaimableSessionCaseWhere } from '../utils/case-classifier';
import { buildSessionBoundQuickPairingWhere } from '../utils/pairing-invariant';

const maskSessionId = (sessionId: string): string =>
  crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 12);

export class SessionService {
  /**
   * 創建快速體驗模式的Session
   */
  async createSession(): Promise<{ session_id: string; expires_at: Date }> {
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY.DEFAULT_MS);

    try {
      await prisma.quickSession.create({
        data: {
          id: sessionId,
          expires_at: expiresAt,
        },
      });

      logger.info('Session created', { sessionId: maskSessionId(sessionId) });
      return { session_id: sessionId, expires_at: expiresAt };
    } catch (error) {
      logger.error('Failed to create session', { error });
      throw Errors.INTERNAL_ERROR('Session創建失敗');
    }
  }

  /**
   * 刷新Session：
   * - 若提供有效舊Session，原子旋轉（新建->遷移關聯->刪除舊）
   * - 若舊Session缺失/過期，創建新Session
   */
  async refreshSession(currentSessionId?: string): Promise<{ session_id: string; expires_at: Date }> {
    if (!currentSessionId || !validateSessionId(currentSessionId)) {
      return this.createSession();
    }

    const currentSession = await prisma.quickSession.findUnique({
      where: { id: currentSessionId },
    });

    if (!currentSession) {
      return this.createSession();
    }

    const newSessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY.DEFAULT_MS);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.quickSession.create({
          data: {
            id: newSessionId,
            expires_at: expiresAt,
            pairing_id: currentSession.pairing_id,
            case_id: currentSession.case_id,
            ...(currentSession.session_data !== null
              ? { session_data: currentSession.session_data as Prisma.InputJsonValue }
              : {}),
          },
        });

        if (currentSession.case_id) {
          await tx.case.updateMany({
            where: {
              id: currentSession.case_id,
              ...buildClaimableSessionCaseWhere(currentSessionId),
            },
            data: { session_id: newSessionId },
          });
        }

        if (currentSession.pairing_id) {
          await tx.pairing.updateMany({
            where: buildSessionBoundQuickPairingWhere(currentSessionId, currentSession.pairing_id),
            data: { session_id: newSessionId },
          });
        }

        await tx.quickSession.deleteMany({
          where: { id: currentSessionId },
        });
      });

      logger.info('Session rotated', {
        oldSessionId: maskSessionId(currentSessionId),
        newSessionId: maskSessionId(newSessionId),
        hadCase: !!currentSession.case_id,
        wasExpired: currentSession.expires_at < new Date(),
      });

      return { session_id: newSessionId, expires_at: expiresAt };
    } catch (error) {
      logger.error('Failed to rotate session', {
        oldSessionId: maskSessionId(currentSessionId),
        error,
      });
      throw Errors.INTERNAL_ERROR('Session刷新失敗');
    }
  }

  /**
   * 獲取Session（帶自動清理）
   */
  async getSession(sessionId: string) {
    if (!validateSessionId(sessionId)) {
      throw Errors.INVALID_SESSION_ID();
    }

    const session = await prisma.quickSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    // 檢查是否過期
    if (session.expires_at < new Date()) {
      // 異步刪除過期Session
      prisma.quickSession.delete({ where: { id: sessionId } }).catch((e) => {
        logger.debug('Failed to delete expired session', { sessionId, error: e });
      });
      return null;
    }

    return session;
  }

  /**
   * 將案件ID關聯到Session
   */
  async addCaseToSession(sessionId: string, caseId: string): Promise<void> {
    const session = await prisma.quickSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      throw Errors.SESSION_EXPIRED('Session已過期或不存在');
    }
    try {
      await prisma.quickSession.update({
        where: { id: sessionId },
        data: { case_id: caseId },
      });
    } catch (error) {
      logger.error('Failed to add case to session', { sessionId: maskSessionId(sessionId), caseId, error });
      throw Errors.INTERNAL_ERROR('Session更新失敗');
    }
  }

  /**
   * 將配對ID關聯到Session
   */
  async addPairingToSession(sessionId: string, pairingId: string): Promise<void> {
    const session = await prisma.quickSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      throw Errors.SESSION_EXPIRED('Session已過期或不存在');
    }
    try {
      await prisma.quickSession.update({
        where: { id: sessionId },
        data: { pairing_id: pairingId },
      });
    } catch (error) {
      logger.error('Failed to add pairing to session', { sessionId: maskSessionId(sessionId), pairingId, error });
      throw Errors.INTERNAL_ERROR('Session更新失敗');
    }
  }

  /**
   * 標記Session為已完成
   */
  async markSessionCompleted(sessionId: string): Promise<void> {
    try {
      // 已完成案件的Session延長到7天
      const expiresAt = new Date(Date.now() + SESSION_EXPIRY.COMPLETED_MS);
      await prisma.quickSession.update({
        where: { id: sessionId },
        data: { expires_at: expiresAt },
      });
    } catch (error) {
      logger.error('Failed to mark session completed', { sessionId: maskSessionId(sessionId), error });
      // 不拋出錯誤，因為這不是關鍵操作
    }
  }

  /**
   * 清理過期Session（定時任務，優化版）
   */
  async cleanupExpiredSessions(limit: number = SESSION_EXPIRY.CLEANUP_BATCH): Promise<number> {
    try {
      // Prisma deleteMany 不支持 take；採用「先查後刪」的限額批次策略
      const expiredIds = await prisma.quickSession.findMany({
        where: { expires_at: { lt: new Date() } },
        select: { id: true },
        take: limit,
      });

      if (expiredIds.length === 0) {
        return 0;
      }

      const result = await prisma.quickSession.deleteMany({
        where: { id: { in: expiredIds.map((s: { id: string }) => s.id) } },
      });

      if (result.count > 0) {
        logger.info('Expired sessions cleaned up', { count: result.count });
        
        // 如果清理數量較大，記錄警告（可能需要優化清理頻率）
        if (result.count >= limit) {
          logger.warn('Large number of sessions cleaned up (hit batch limit)', {
            count: result.count,
            limit,
          });
        }
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error });
      return 0;
    }
  }
}

export const sessionService = new SessionService();
