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
        message: '分析已完成',
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
        throw Errors.NOT_FOUND('梳理結果不存在');
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
          throw Errors.NOT_FOUND('梳理結果不存在');
        }
        throw accessErr;
      }

      if (!result) {
        res.status(202).json({
          success: false,
          error: {
            code: 'JUDGMENT_PENDING',
            message: '分析生成中，請稍後再試',
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
        message: accepted ? '已接受梳理結果' : '已拒絕梳理結果',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 修復判決回應（聯盟破裂修復）
   */
  async repairJudgment(req: Request, res: Response, next: NextFunction) {
    try {
      const judgmentId = req.params.id;
      const userId = getAuthUserIdOptional(req);
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }

      const { feedback } = req.body as { feedback: string };
      const repaired = await judgmentService.repairJudgmentResponse(
        judgmentId,
        feedback,
        { userId, sessionId }
      );

      res.json({
        success: true,
        data: repaired,
        message: '已生成修復版回應',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 提交臨床品質評分
   */
  async recordClinicalMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const judgmentId = req.params.id;
      const userId = getAuthUserIdOptional(req);
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }

      const result = await judgmentService.recordClinicalMetrics(
        judgmentId,
        req.body as { felt_understood: number; felt_blamed: number; willing_to_try: number },
        { userId, sessionId }
      );

      res.json({
        success: true,
        data: result,
        message: '已記錄臨床品質指標',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const judgmentController = new JudgmentController();
