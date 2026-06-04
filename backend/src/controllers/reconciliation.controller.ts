import { Request, Response, NextFunction } from 'express';
import { reconciliationService } from '../services/reconciliation.service';
import { executionService } from '../services/execution.service';
import { getAuthUserId } from '../utils/request';

export class ReconciliationController {
  /**
   * 生成和好方案
   */
  async generatePlans(req: Request, res: Response, next: NextFunction) {
    try {
      const judgmentId = req.params.id;
      const input = req.body;
      const userId = getAuthUserId(req);

      const result = await reconciliationService.generatePlans(judgmentId, input, userId);

      res.json({
        success: true,
        data: result,
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
      const userId = getAuthUserId(req);
      const filters = {
        difficulty: req.query.difficulty as 'easy' | 'medium' | 'hard' | undefined,
        type: req.query.type as 'activity' | 'communication' | 'intimacy' | 'gift' | 'service' | undefined,
        intent: req.query.intent as 'repair' | 'cool_down' | 'graceful_exit' | 'safety_support' | undefined,
      };

      const result = await reconciliationService.getPlansByJudgmentId(judgmentId, userId, filters);

      res.json({
        success: true,
        data: result,
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
      const userId = getAuthUserId(req);

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
      const userId = getAuthUserId(req);

      const plan = await reconciliationService.selectPlan(planId, userId);

      res.json({
        success: true,
        data: { plan },
        message: '已記下你的承諾',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCommitment(req: Request, res: Response, next: NextFunction) {
    try {
      const planId = req.params.id;
      const userId = getAuthUserId(req);
      const commitment = await reconciliationService.getCommitment(planId, userId);
      res.json({
        success: true,
        data: { commitment },
      });
    } catch (error) {
      next(error);
    }
  }

  async invitePartner(req: Request, res: Response, next: NextFunction) {
    try {
      const planId = req.params.id;
      const userId = getAuthUserId(req);
      const invitation = await reconciliationService.invitePartner(planId, userId);
      res.json({
        success: true,
        data: { invitation },
        message: '已送出一起試試看的邀請',
      });
    } catch (error) {
      next(error);
    }
  }

  async pausePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const planId = req.params.id;
      const userId = getAuthUserId(req);
      const commitment = await reconciliationService.pausePlan(planId, userId);
      res.json({
        success: true,
        data: { commitment },
        message: '已暫停這一輪修復旅程',
      });
    } catch (error) {
      next(error);
    }
  }

  async respondPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const planId = req.params.id;
      const userId = getAuthUserId(req);
      const action = req.body.action;
      const plan = await reconciliationService.respondPlan(planId, userId, action, {
        reason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
        remindInHours: typeof req.body.remind_in_hours === 'number' ? req.body.remind_in_hours : undefined,
      });
      res.json({
        success: true,
        data: { plan },
        message: action === 'declined'
          ? '已記下你暫時不加入的選擇'
          : action === 'deferred'
            ? '已記下你需要一點時間'
          : action === 'viewed'
            ? '已同步你已查看這個邀請'
            : action === 'paused'
              ? '已暫停這一輪修復旅程'
              : '已記下你的承諾',
      });
    } catch (error) {
      next(error);
    }
  }

  async replanTrack(req: Request, res: Response, next: NextFunction) {
    try {
      const trackId = req.params.id;
      const userId = getAuthUserId(req);
      const track = await executionService.replanTrack(userId, trackId, req.body, req.locale);
      res.status(202).json({
        success: true,
        data: { track },
        message: '已接受這一輪重調請求',
      });
    } catch (error) {
      next(error);
    }
  }

  async resumeTrack(req: Request, res: Response, next: NextFunction) {
    try {
      const trackId = req.params.id;
      const userId = getAuthUserId(req);
      const track = await executionService.resumeTrack(userId, trackId);
      res.json({
        success: true,
        data: { track },
        message: '已恢復這一輪修復旅程',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reconciliationController = new ReconciliationController();
