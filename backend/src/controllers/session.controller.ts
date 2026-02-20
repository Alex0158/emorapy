import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/session.service';
import { getSessionIdFromSources } from '../utils/request';
import { Errors } from '../utils/errors';

export class SessionController {
  /**
   * 創建Session（快速體驗模式）
   */
  async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await sessionService.createSession();

      res.json({
        success: true,
        data: result,
        message: 'Session創建成功',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 刷新Session（優先旋轉舊Session，無可用舊Session時創建新Session）
   */
  async refreshSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }

      const result = await sessionService.refreshSession(sessionId);

      res.json({
        success: true,
        data: result,
        message: 'Session刷新成功',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const sessionController = new SessionController();

