import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/session.service';

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
}

export const sessionController = new SessionController();

