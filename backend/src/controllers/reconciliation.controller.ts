import { Request, Response, NextFunction } from 'express';
import { reconciliationService } from '../services/reconciliation.service';

export class ReconciliationController {
  /**
   * 生成和好方案
   */
  async generatePlans(req: Request, res: Response, next: NextFunction) {
    try {
      const judgmentId = req.params.id;
      const preferences = req.body.preferences;
      const userId = (req as any).user!.id;

      const plans = await reconciliationService.generatePlans(judgmentId, preferences, userId);

      res.json({
        success: true,
        data: { plans },
        message: '和好方案已生成',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 獲取和好方案列表
   */
  async getPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const judgmentId = req.params.id;
      const filters = {
        difficulty: req.query.difficulty as 'easy' | 'medium' | 'hard' | undefined,
        type: req.query.type as 'activity' | 'communication' | 'intimacy' | undefined,
      };

      const plans = await reconciliationService.getPlansByJudgmentId(judgmentId, filters);

      res.json({
        success: true,
        data: { plans },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 獲取和好方案詳情
   */
  async getPlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const planId = req.params.id;
      const userId = (req as any).user?.id;

      const plan = await reconciliationService.getPlanById(planId, userId);

      res.json({
        success: true,
        data: { plan },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 選擇和好方案
   */
  async selectPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const planId = req.params.id;
      const userId = (req as any).user!.id;

      const plan = await reconciliationService.selectPlan(planId, userId);

      res.json({
        success: true,
        data: { plan },
        message: '方案已選擇',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reconciliationController = new ReconciliationController();
