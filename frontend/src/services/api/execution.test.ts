/**
 * 執行 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAllExecutionStatuses,
  getExecutionStatus,
  confirmExecution,
  checkin,
  type ExecutionStatus,
  type ExecutionRecord,
} from './execution';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('execution API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllExecutionStatuses', () => {
    it('應請求 /execution/dashboard 並返回 executions 陣列', async () => {
      const executions: ExecutionStatus[] = [
        { plan_id: 'p1', status: 'in_progress', records: [], progress: 50, plan_summary: { title: '方案 A', plan_type: 'activity', difficulty_level: 'easy' } },
      ];
      mockGet.mockResolvedValue({ data: { data: { executions } } });
      const result = await getAllExecutionStatuses();
      expect(mockGet).toHaveBeenCalledWith('/execution/dashboard');
      expect(result).toEqual(executions);
    });

    it('應返回空陣列當後端無資料', async () => {
      mockGet.mockResolvedValue({ data: { data: { executions: [] } } });
      const result = await getAllExecutionStatuses();
      expect(result).toEqual([]);
    });
  });

  describe('getExecutionStatus', () => {
    it('應請求 /execution/status?plan_id=xxx 並返回單一狀態', async () => {
      const status: ExecutionStatus = {
        plan_id: 'p1',
        status: 'completed',
        records: [],
        progress: 100,
        plan_summary: { title: '方案 B', plan_type: 'communication', difficulty_level: 'medium' },
      };
      mockGet.mockResolvedValue({ data: { data: status } });
      const result = await getExecutionStatus('p1');
      expect(mockGet).toHaveBeenCalledWith('/execution/status', { params: { plan_id: 'p1' } });
      expect(result).toEqual(status);
    });
  });

  describe('confirmExecution', () => {
    it('應 POST /execution/confirm 並返回 execution', async () => {
      const execution: ExecutionRecord = {
        id: 'e1',
        reconciliation_plan_id: 'p1',
        user_id: 'u1',
        action: 'confirm',
        status: 'pending',
        photos_urls: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockPost.mockResolvedValue({ data: { data: { execution } } });
      const result = await confirmExecution('p1');
      expect(mockPost).toHaveBeenCalledWith('/execution/confirm', { plan_id: 'p1' });
      expect(result).toEqual(execution);
    });
  });

  describe('checkin', () => {
    it('應 POST /execution/checkin 並返回 execution', async () => {
      const execution: ExecutionRecord = {
        id: 'e2',
        reconciliation_plan_id: 'p1',
        user_id: 'u1',
        action: 'checkin',
        status: 'in_progress',
        photos_urls: ['https://example.com/photo.jpg'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockPost.mockResolvedValue({ data: { data: { execution } } });
      const result = await checkin({ plan_id: 'p1', notes: '今日完成', photos: ['url'] });
      expect(mockPost).toHaveBeenCalledWith('/execution/checkin', { plan_id: 'p1', notes: '今日完成', photos: ['url'] });
      expect(result).toEqual(execution);
    });
  });
});
