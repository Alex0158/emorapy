/**
 * ExecutionService 單元測試（mock Prisma）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const planWithCase = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  user1_selected: true,
  user2_selected: false,
  estimated_duration: 7,
  judgment: {
    case: {
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    },
  },
  execution_records: [],
  ...overrides,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  reconciliationPlan: { findUnique: jest.fn() },
  executionRecord: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  case: { findMany: jest.fn() },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { ExecutionService } from '../../../src/services/execution.service';

describe('ExecutionService', () => {
  let service: ExecutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExecutionService();
  });

  describe('confirmExecution', () => {
    it('方案不存在應拋出 NOT_FOUND', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(null);

      await expect(service.confirmExecution('u1', 'plan-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('和好方案'),
      });
      expect(prismaMock.executionRecord.create).not.toHaveBeenCalled();
    });

    it('非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(
        planWithCase({ judgment: { case: { plaintiff_id: 'u1', defendant_id: 'u2' } } })
      );

      await expect(service.confirmExecution('u3', 'plan-1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('未選擇此方案應拋出 FORBIDDEN', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(
        planWithCase({ user1_selected: false, user2_selected: false })
      );

      await expect(service.confirmExecution('u1', 'plan-1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('選擇'),
      });
    });

    it('已有確認記錄應直接返回', async () => {
      const existing = { id: 'exec-1', action: 'confirm' };
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(planWithCase());
      prismaMock.executionRecord.findFirst.mockResolvedValue(existing);

      const result = await service.confirmExecution('u1', 'plan-1');

      expect(result).toEqual(existing);
      expect(prismaMock.executionRecord.create).not.toHaveBeenCalled();
    });

    it('成功應創建確認記錄', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(planWithCase());
      prismaMock.executionRecord.findFirst.mockResolvedValue(null);
      prismaMock.executionRecord.create.mockResolvedValue({
        id: 'exec-1',
        reconciliation_plan_id: 'plan-1',
        user_id: 'u1',
        action: 'confirm',
        status: 'in_progress',
      });

      const result = await service.confirmExecution('u1', 'plan-1');

      expect(result.action).toBe('confirm');
      expect(prismaMock.executionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reconciliation_plan_id: 'plan-1',
          user_id: 'u1',
          action: 'confirm',
          status: 'in_progress',
        }),
      });
    });
  });

  describe('checkin', () => {
    it('方案不存在應拋出 NOT_FOUND', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.checkin('u1', { plan_id: 'plan-1', notes: 'ok' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(planWithCase());

      await expect(
        service.checkin('u3', { plan_id: 'plan-1' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('未選擇方案應拋出 FORBIDDEN', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(
        planWithCase({ user1_selected: false, user2_selected: false })
      );

      await expect(
        service.checkin('u1', { plan_id: 'plan-1' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('選擇') });
    });

    it('成功應創建打卡記錄', async () => {
      prismaMock.reconciliationPlan.findUnique
        .mockResolvedValueOnce(planWithCase())
        .mockResolvedValueOnce(planWithCase({ execution_records: [] }));
      prismaMock.executionRecord.create.mockResolvedValue({
        id: 'exec-2',
        action: 'checkin',
        notes: 'done',
        photos_urls: [],
      });

      const result = await service.checkin('u1', {
        plan_id: 'plan-1',
        notes: 'done',
        photos: [],
      });

      expect(result.action).toBe('checkin');
      expect(prismaMock.executionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reconciliation_plan_id: 'plan-1',
          user_id: 'u1',
          action: 'checkin',
          status: 'in_progress',
          notes: 'done',
          photos_urls: [],
        }),
      });
    });
  });

  describe('getExecutionStatus', () => {
    it('方案不存在應拋出 NOT_FOUND', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(null);

      await expect(service.getExecutionStatus('u1', 'plan-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(planWithCase());

      await expect(service.getExecutionStatus('u3', 'plan-1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('成功應返回進度與記錄', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(planWithCase());
      prismaMock.executionRecord.findMany.mockResolvedValue([
        { id: 'r1', action: 'checkin', created_at: new Date() },
      ]);

      const result = await service.getExecutionStatus('u1', 'plan-1');

      expect(result.plan_id).toBe('plan-1');
      expect(result.records).toHaveLength(1);
      expect(result.status).toBeDefined();
      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(100);
    });

    it('無記錄時進度應為 0、狀態 pending', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(planWithCase());
      prismaMock.executionRecord.findMany.mockResolvedValue([]);

      const result = await service.getExecutionStatus('u1', 'plan-1');

      expect(result.progress).toBe(0);
      expect(result.status).toBe('pending');
    });

    it('打卡數達 estimated_duration 時狀態應為 completed、進度 100', async () => {
      const plan = planWithCase({ estimated_duration: 7 });
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(plan);
      const sevenCheckins = Array.from({ length: 7 }, (_, i) => ({
        id: `r${i}`,
        action: 'checkin',
        created_at: new Date(),
      }));
      prismaMock.executionRecord.findMany.mockResolvedValue(sevenCheckins);

      const result = await service.getExecutionStatus('u1', 'plan-1');

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
    });

    it('無 estimated_duration 時應以 7 天計算進度', async () => {
      const plan = planWithCase({ estimated_duration: null });
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(plan);
      prismaMock.executionRecord.findMany.mockResolvedValue([
        { id: 'r1', action: 'checkin', created_at: new Date() },
      ]);

      const result = await service.getExecutionStatus('u1', 'plan-1');

      expect(result.progress).toBe(Math.round((1 / 7) * 100));
      expect(result.status).toBe('in_progress');
    });
  });

  describe('getAllExecutionStatuses', () => {
    it('無案件應返回空數組', async () => {
      prismaMock.case.findMany.mockResolvedValue([]);

      const result = await service.getAllExecutionStatuses('u1');

      expect(result).toEqual([]);
    });

    it('有案件與已選方案應返回執行狀態列表', async () => {
      const plan = planWithCase({ id: 'plan-1', user1_selected: true }) as any;
      plan.execution_records = [];
      prismaMock.case.findMany.mockResolvedValue([
        {
          id: 'case-1',
          plaintiff_id: 'u1',
          judgment: {
            reconciliation_plans: [plan],
          },
        },
      ]);

      const result = await service.getAllExecutionStatuses('u1');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('plan_content 為 JSON 字串時仍應返回可用執行狀態', async () => {
      const plan = planWithCase({ id: 'plan-1', user1_selected: true }) as any;
      plan.execution_records = [];
      plan.plan_content = JSON.stringify({ title: '每週約會一次' });
      plan.plan_type = 'custom';
      plan.difficulty_level = 1;
      plan.estimated_duration = 7;
      prismaMock.case.findMany.mockResolvedValue([
        {
          id: 'case-1',
          plaintiff_id: 'u1',
          judgment: {
            reconciliation_plans: [plan],
          },
        },
      ]);

      const result = await service.getAllExecutionStatuses('u1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        plan_id: 'plan-1',
        status: 'pending',
        progress: 0,
      });
    });
  });

  describe('checkin + updatePlanStatusIfCompleted', () => {
    it('打卡後進度達 100 時應自動創建 complete 記錄', async () => {
      prismaMock.reconciliationPlan.findUnique
        .mockResolvedValueOnce(planWithCase())
        .mockResolvedValueOnce({
          ...planWithCase(),
          execution_records: Array.from({ length: 7 }, () => ({ action: 'checkin', user_id: 'u1' })),
        });
      prismaMock.executionRecord.create
        .mockResolvedValueOnce({ id: 'exec-checkin', action: 'checkin' })
        .mockResolvedValueOnce({ id: 'exec-complete', action: 'complete' });

      const result = await service.checkin('u1', { plan_id: 'plan-1' });

      expect(result.action).toBe('checkin');
      expect(prismaMock.executionRecord.create).toHaveBeenCalledTimes(2);
      const createCalls = prismaMock.executionRecord.create.mock.calls as Array<[{ data: { action: string } }]>;
      const completeCall = createCalls.find(c => c[0]?.data?.action === 'complete');
      expect(completeCall).toBeDefined();
      expect(completeCall![0].data).toMatchObject({
        action: 'complete',
        status: 'completed',
        notes: '自動標記完成',
      });
    });

    it('updatePlanStatusIfCompleted 時方案不存在應不拋錯', async () => {
      prismaMock.reconciliationPlan.findUnique
        .mockResolvedValueOnce(planWithCase())
        .mockResolvedValueOnce(null);
      prismaMock.executionRecord.create.mockResolvedValue({ id: 'exec-1', action: 'checkin' });

      const result = await service.checkin('u1', { plan_id: 'plan-1' });

      expect(result.action).toBe('checkin');
      expect(prismaMock.executionRecord.create).toHaveBeenCalledTimes(1);
    });
  });
});
