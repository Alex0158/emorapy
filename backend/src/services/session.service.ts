import prisma from '../config/database';
import { generateSessionId, validateSessionId } from '../utils/session';
import { Errors } from '../utils/errors';
import logger from '../config/logger';

export class SessionService {
  /**
   * 創建快速體驗模式的Session
   */
  async createSession(): Promise<{ session_id: string; expires_at: Date }> {
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小時

    try {
      await prisma.quickSession.create({
        data: {
          id: sessionId,
          expires_at: expiresAt,
        },
      });

      logger.info('Session created', { sessionId });
      return { session_id: sessionId, expires_at: expiresAt };
    } catch (error) {
      logger.error('Failed to create session', { error });
      throw Errors.INTERNAL_ERROR('Session創建失敗');
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
      prisma.quickSession.delete({ where: { id: sessionId } }).catch(() => {
        // 忽略刪除錯誤
      });
      return null;
    }

    return session;
  }

  /**
   * 將案件ID關聯到Session
   */
  async addCaseToSession(sessionId: string, caseId: string): Promise<void> {
    try {
      await prisma.quickSession.update({
        where: { id: sessionId },
        data: { case_id: caseId },
      });
    } catch (error) {
      logger.error('Failed to add case to session', { sessionId, caseId, error });
      throw Errors.INTERNAL_ERROR('Session更新失敗');
    }
  }

  /**
   * 將配對ID關聯到Session
   */
  async addPairingToSession(sessionId: string, pairingId: string): Promise<void> {
    try {
      await prisma.quickSession.update({
        where: { id: sessionId },
        data: { pairing_id: pairingId },
      });
    } catch (error) {
      logger.error('Failed to add pairing to session', { sessionId, pairingId, error });
      throw Errors.INTERNAL_ERROR('Session更新失敗');
    }
  }

  /**
   * 標記Session為已完成
   */
  async markSessionCompleted(sessionId: string): Promise<void> {
    try {
      // 已完成案件的Session延長到7天
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.quickSession.update({
        where: { id: sessionId },
        data: { expires_at: expiresAt },
      });
    } catch (error) {
      logger.error('Failed to mark session completed', { sessionId, error });
      // 不拋出錯誤，因為這不是關鍵操作
    }
  }

  /**
   * 清理過期Session（定時任務，優化版）
   */
  async cleanupExpiredSessions(limit: number = 1000): Promise<number> {
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

