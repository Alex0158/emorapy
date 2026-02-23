import { Request, Response, NextFunction } from 'express';
import { judgmentService } from '../services/judgment.service';
import { Errors } from '../utils/errors';
import { getAuthUserId, getAuthUserIdOptional, getSessionIdFromSources } from '../utils/request';

export class JudgmentController {
  /**
   * 生成判決
   */
  async generateJudgment(req: Request, res: Response, next: NextFunction) {
    try {
      const caseId = req.params.id;
      const userId = getAuthUserIdOptional(req);
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }
      const judgment = await judgmentService.generateJudgment(caseId, { userId, sessionId });

      res.json({
        success: true,
        data: { judgment },
        message: '判決已生成',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 獲取判決詳情
   */
  async getJudgmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const judgmentId = req.params.id;
      
      const prisma = (await import('../config/database')).default;
      const judgment = await prisma.judgment.findUnique({
        where: { id: judgmentId },
        include: { case: true },
      });

      if (!judgment) {
        throw Errors.NOT_FOUND('判決不存在');
      }

      const userId = getAuthUserIdOptional(req);
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }

      let result;
      try {
        result = await judgmentService.getJudgmentByCaseId(
          judgment.case_id,
          userId,
          sessionId
        );
      } catch (accessErr: unknown) {
        const code = (accessErr as { code?: string })?.code;
        if (code === 'FORBIDDEN') {
          throw Errors.NOT_FOUND('判決不存在');
        }
        throw accessErr;
      }

      if (!result) {
        res.status(202).json({
          success: false,
          error: {
            code: 'JUDGMENT_PENDING',
            message: '判決生成中，請稍後再試',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: { judgment: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 接受/拒絕判決
   */
  async acceptJudgment(req: Request, res: Response, next: NextFunction) {
    try {
      const judgmentId = req.params.id;
      const userId = getAuthUserId(req);
      const { accepted, rating } = req.body;

      const judgment = await judgmentService.acceptJudgment(
        judgmentId,
        userId,
        accepted,
        rating
      );

      res.json({
        success: true,
        data: { judgment },
        message: accepted ? '判決已接受' : '判決已拒絕',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const judgmentController = new JudgmentController();
