/**
 * ExecutionController 單元測試（mock executionService、getAuthUserId）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { ExecutionController } from '../../../src/controllers/execution.controller';
import { executionService } from '../../../src/services/execution.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockConfirmExecution: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCheckin: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetExecutionStatus: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetAllExecutionStatuses: any = jest.fn();
const mockGetAuthUserId = jest.fn();

jest.mock('../../../src/services/execution.service', () => ({
  executionService: {
    confirmExecution: (userId: string, planId: string) =>
      mockConfirmExecution(userId, planId),
    checkin: (userId: string, body: unknown) => mockCheckin(userId, body),
    getExecutionStatus: (userId: string, planId: string) =>
      mockGetExecutionStatus(userId, planId),
    getAllExecutionStatuses: (userId: string) =>
      mockGetAllExecutionStatuses(userId),
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getAuthUserId: (req: Request) => mockGetAuthUserId(req),
}));

describe('ExecutionController', () => {
  let controller: ExecutionController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ExecutionController();
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn().mockReturnThis() } as unknown as Response;
    next = jest.fn();
    mockGetAuthUserId.mockReturnValue('u1');
  });

  describe('confirmExecution', () => {
    it('成功應調用 confirmExecution 並返回 execution', async () => {
      req.body = { plan_id: 'plan-1' };
      const execution = { id: 'e1', plan_id: 'plan-1' };
      mockConfirmExecution.mockResolvedValue(execution);

      await controller.confirmExecution(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockConfirmExecution).toHaveBeenCalledWith('u1', 'plan-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { execution },
        message: '執行已確認',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('confirmExecution 拋錯時應 next(error)', async () => {
      req.body = { plan_id: 'plan-1' };
      mockConfirmExecution.mockRejectedValue(new Error('forbidden'));

      await controller.confirmExecution(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('checkin', () => {
    it('成功應調用 checkin 並返回 execution', async () => {
      req.body = { plan_id: 'plan-1', completed: true };
      const execution = { id: 'e1' };
      mockCheckin.mockResolvedValue(execution);

      await controller.checkin(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockCheckin).toHaveBeenCalledWith('u1', { plan_id: 'plan-1', completed: true });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { execution },
        message: '打卡成功',
      });
    });

    it('checkin 拋錯時應 next(error)', async () => {
      req.body = { plan_id: 'plan-1' };
      mockCheckin.mockRejectedValue(new Error('not found'));

      await controller.checkin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getExecutionStatus', () => {
    it('成功應返回 status', async () => {
      req.query = { plan_id: 'plan-1' };
      const status = { plan_id: 'plan-1', status: 'in_progress' };
      mockGetExecutionStatus.mockResolvedValue(status);

      await controller.getExecutionStatus(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockGetExecutionStatus).toHaveBeenCalledWith('u1', 'plan-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: status });
    });

    it('getExecutionStatus 拋錯時應 next(error)', async () => {
      req.query = { plan_id: 'plan-1' };
      mockGetExecutionStatus.mockRejectedValue(new Error('db error'));

      await controller.getExecutionStatus(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getAllExecutionStatuses', () => {
    it('成功應返回 executions', async () => {
      const statuses = [{ plan_id: 'plan-1' }, { plan_id: 'plan-2' }];
      mockGetAllExecutionStatuses.mockResolvedValue(statuses);

      await controller.getAllExecutionStatuses(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockGetAllExecutionStatuses).toHaveBeenCalledWith('u1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { executions: statuses },
      });
    });

    it('getAllExecutionStatuses 拋錯時應 next(error)', async () => {
      mockGetAllExecutionStatuses.mockRejectedValue(new Error('db error'));

      await controller.getAllExecutionStatuses(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('錯誤時調用 next', () => {
    it('confirmExecution 拋錯時應 next(error)', async () => {
      req.body = { plan_id: 'plan-1' };
      mockConfirmExecution.mockRejectedValue(new Error('not found'));

      await controller.confirmExecution(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
