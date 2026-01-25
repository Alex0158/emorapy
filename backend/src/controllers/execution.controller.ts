import { Request, Response, NextFunction } from 'express';
import { executionService } from '../services/execution.service';
import { Errors } from '../utils/errors';

export class ExecutionController {
  /**
   * 確認執行
   */
  async confirmExecution(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user!.id;
      const { plan_id } = req.body;

      const execution = await executionService.confirmExecution(userId, plan_id);

      res.json({
        success: true,
        data: { execution },
        message: '執行已確認',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 執行打卡
   */
  async checkin(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user!.id;

      const execution = await executionService.checkin(userId, req.body);

      res.json({
        success: true,
        data: { execution },
        message: '打卡成功',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 獲取執行狀態
   */
  async getExecutionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user!.id;
      const planId = req.query.plan_id as string;

      if (!planId) {
        throw Errors.VALIDATION_ERROR('plan_id是必需的');
      }

      const status = await executionService.getExecutionStatus(userId, planId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 獲取所有執行狀態（用於執行看板）
   */
  async getAllExecutionStatuses(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user!.id;

      const statuses = await executionService.getAllExecutionStatuses(userId);

      res.json({
        success: true,
        data: { executions: statuses },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const executionController = new ExecutionController();

