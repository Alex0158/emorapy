/**
 * ReconciliationController 單元測試（mock reconciliationService、getAuthUserId）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { ReconciliationController } from '../../../src/controllers/reconciliation.controller';
import { reconciliationService } from '../../../src/services/reconciliation.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGeneratePlans: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetPlansByJudgmentId: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetPlanById: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSelectPlan: any = jest.fn();
const mockGetAuthUserId = jest.fn();
const mockGetAuthUserIdOptional = jest.fn();

jest.mock('../../../src/services/reconciliation.service', () => ({
  reconciliationService: {
    generatePlans: (id: string, prefs: unknown, userId: string) =>
      mockGeneratePlans(id, prefs, userId),
    getPlansByJudgmentId: (id: string, userId: string, filters: unknown) =>
      mockGetPlansByJudgmentId(id, userId, filters),
    getPlanById: (id: string, userId?: string) => mockGetPlanById(id, userId),
    selectPlan: (id: string, userId: string) => mockSelectPlan(id, userId),
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getAuthUserId: (req: Request) => mockGetAuthUserId(req),
  getAuthUserIdOptional: (req: Request) => mockGetAuthUserIdOptional(req),
}));

describe('ReconciliationController', () => {
  let controller: ReconciliationController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReconciliationController();
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn().mockReturnThis() } as unknown as Response;
    next = jest.fn();
    mockGetAuthUserId.mockReturnValue('u1');
    mockGetAuthUserIdOptional.mockReturnValue('u1');
  });

  describe('generatePlans', () => {
    it('成功應調用 generatePlans 並返回 plans', async () => {
      req.params = { id: 'judge-1' };
      req.body = { preferences: { difficulty: 'easy' } };
      const plans = [{ id: 'plan-1', plan_type: 'activity' }];
      mockGeneratePlans.mockResolvedValue(plans);

      await controller.generatePlans(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockGeneratePlans).toHaveBeenCalledWith('judge-1', { difficulty: 'easy' }, 'u1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { plans },
        message: '和好方案已生成',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('generatePlans 拋錯時應 next(error)', async () => {
      req.params = { id: 'judge-1' };
      req.body = { preferences: {} };
      mockGeneratePlans.mockRejectedValue(new Error('service error'));

      await controller.generatePlans(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getPlans', () => {
    it('成功應按 filters 查詢並返回', async () => {
      req.params = { id: 'judge-1' };
      req.query = { difficulty: 'easy', type: 'activity' };
      const plans = [{ id: 'plan-1' }];
      mockGetPlansByJudgmentId.mockResolvedValue(plans);

      await controller.getPlans(req as Request, res as Response, next);

      expect(mockGetPlansByJudgmentId).toHaveBeenCalledWith('judge-1', 'u1', {
        difficulty: 'easy',
        type: 'activity',
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { plans } });
    });

    it('getPlans 拋錯時應 next(error)', async () => {
      req.params = { id: 'judge-1' };
      mockGetPlansByJudgmentId.mockRejectedValue(new Error('db error'));

      await controller.getPlans(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getPlanById', () => {
    it('成功應返回 plan', async () => {
      req.params = { id: 'plan-1' };
      const plan = { id: 'plan-1', plan_type: 'activity' };
      mockGetPlanById.mockResolvedValue(plan);

      await controller.getPlanById(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockGetPlanById).toHaveBeenCalledWith('plan-1', 'u1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { plan } });
    });

    it('getPlanById 拋錯時應 next(error)', async () => {
      req.params = { id: 'plan-1' };
      mockGetPlanById.mockRejectedValue(new Error('not found'));

      await controller.getPlanById(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('selectPlan', () => {
    it('成功應返回 plan 並 message', async () => {
      req.params = { id: 'plan-1' };
      const plan = { id: 'plan-1', user1_selected: true };
      mockSelectPlan.mockResolvedValue(plan);

      await controller.selectPlan(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockSelectPlan).toHaveBeenCalledWith('plan-1', 'u1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { plan },
        message: '方案已選擇',
      });
    });

    it('selectPlan 拋錯時應 next(error)', async () => {
      req.params = { id: 'plan-1' };
      mockSelectPlan.mockRejectedValue(new Error('service error'));

      await controller.selectPlan(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
