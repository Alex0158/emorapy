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

    it('應返回空陣列當 data 或 executions 缺失', async () => {
      mockGet.mockResolvedValue({ data: {} });
      const result = await getAllExecutionStatuses();
      expect(result).toEqual([]);

      mockGet.mockResolvedValue({ data: { data: {} } });
      const result2 = await getAllExecutionStatuses();
      expect(result2).toEqual([]);
    });

    it('後端回傳 executions 為非陣列時應返回空陣列（F05 邊界：API 回傳不完整時防禦）', async () => {
      mockGet.mockResolvedValue({ data: { data: { executions: { items: [] } } } });
      const result = await getAllExecutionStatuses();
      expect(result).toEqual([]);
    });

    it('後端回傳 executions 內項目 records 為 null 或非陣列時應正規化為空陣列（F05 邊界：與 getExecutionStatus 防禦一致）', async () => {
      mockGet.mockResolvedValue({
        data: {
          data: {
            executions: [
              { plan_id: 'p1', status: 'in_progress', records: null, progress: 50 },
              { plan_id: 'p2', status: 'completed', records: 'invalid' as unknown as ExecutionRecord[], progress: 100 },
            ],
          },
        },
      });
      const result = await getAllExecutionStatuses();
      expect(result).toHaveLength(2);
      expect(result[0].records).toEqual([]);
      expect(result[1].records).toEqual([]);
      expect(result[0].plan_id).toBe('p1');
      expect(result[1].plan_id).toBe('p2');
    });
  });

  describe('getExecutionStatus', () => {
    it('回應缺少 data 時應拋錯', async () => {
      mockGet.mockResolvedValue({ data: {} });
      await expect(getExecutionStatus('p1')).rejects.toThrow('Invalid execution status response from server');
    });

    it('回應 data 為 null 時應拋錯（F05 邊界：API 回傳不完整時防禦）', async () => {
      mockGet.mockResolvedValue({ data: { data: null } });
      await expect(getExecutionStatus('p1')).rejects.toThrow('Invalid execution status response from server');
    });

    it('後端回傳 records 為 null 或非陣列時應返回空陣列（F05 邊界：API 回傳不完整時防禦，避免 CheckIn 崩潰）', async () => {
      mockGet.mockResolvedValue({
        data: {
          data: { plan_id: 'p1', status: 'in_progress', records: null, progress: 50 },
        },
      });
      const result = await getExecutionStatus('p1');
      expect(result.records).toEqual([]);
      expect(result.plan_id).toBe('p1');
    });

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
    it('回應缺少 execution 時應拋錯', async () => {
      mockPost.mockResolvedValue({ data: { data: {} } });
      await expect(confirmExecution('p1')).rejects.toThrow('Invalid execution response from server');
    });

    it('後端回傳 execution 為 null 時應拋錯（F05 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: { execution: null } } });
      await expect(confirmExecution('p1')).rejects.toThrow('Invalid execution response from server');
    });

    it('後端回傳 execution 為 undefined 時應拋錯（F05 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: { execution: undefined } } });
      await expect(confirmExecution('p1')).rejects.toThrow('Invalid execution response from server');
    });

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
    it('回應缺少 execution 時應拋錯', async () => {
      mockPost.mockResolvedValue({ data: { data: {} } });
      await expect(checkin({ plan_id: 'p1' })).rejects.toThrow('Invalid execution response from server');
    });

    it('後端回傳 execution 為 null 時應拋錯（F05 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: { execution: null } } });
      await expect(checkin({ plan_id: 'p1' })).rejects.toThrow('Invalid execution response from server');
    });

    it('後端回傳 execution 為 undefined 時應拋錯（F05 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: { execution: undefined } } });
      await expect(checkin({ plan_id: 'p1' })).rejects.toThrow('Invalid execution response from server');
    });

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
