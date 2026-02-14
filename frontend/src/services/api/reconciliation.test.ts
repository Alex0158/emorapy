/**
 * 和好方案 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generatePlans,
  getPlans,
  getPlanById,
  selectPlan,
  type ReconciliationPlan,
} from './reconciliation';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

const mockPlan: ReconciliationPlan = {
  id: 'rp1',
  judgment_id: 'j1',
  plan_content: '方案內容',
  plan_type: 'activity',
  difficulty_level: 'easy',
  time_cost: 30,
  money_cost: 0,
  emotion_cost: 1,
  skill_requirement: 1,
  user1_selected: false,
  user2_selected: false,
  created_at: new Date().toISOString(),
};

describe('reconciliation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generatePlans', () => {
    it('應 POST /judgments/:id/reconciliation-plans 並返回 plans', async () => {
      mockPost.mockResolvedValue({ data: { data: { plans: [mockPlan] } } });
      const result = await generatePlans('j1');
      expect(mockPost).toHaveBeenCalledWith('/judgments/j1/reconciliation-plans', { preferences: undefined });
      expect(result).toEqual([mockPlan]);
    });

    it('可傳 preferences', async () => {
      mockPost.mockResolvedValue({ data: { data: { plans: [] } } });
      await generatePlans('j1', { difficulty: 'medium', types: ['activity'] });
      expect(mockPost).toHaveBeenCalledWith('/judgments/j1/reconciliation-plans', {
        preferences: { difficulty: 'medium', types: ['activity'] },
      });
    });
  });

  describe('getPlans', () => {
    it('應 GET /judgments/:id/reconciliation-plans', async () => {
      mockGet.mockResolvedValue({ data: { data: { plans: [mockPlan] } } });
      const result = await getPlans('j1');
      expect(mockGet).toHaveBeenCalledWith('/judgments/j1/reconciliation-plans');
      expect(result).toEqual([mockPlan]);
    });

    it('有 filters 時應帶查詢參數', async () => {
      mockGet.mockResolvedValue({ data: { data: { plans: [] } } });
      await getPlans('j1', { difficulty: 'easy', type: 'activity' });
      expect(mockGet).toHaveBeenCalledWith('/judgments/j1/reconciliation-plans?difficulty=easy&type=activity');
    });
  });

  describe('getPlanById', () => {
    it('應 GET /reconciliation-plans/:id 並返回 plan', async () => {
      const planWithJudgment = { ...mockPlan, judgment: { case_id: 'c1' } };
      mockGet.mockResolvedValue({ data: { data: { plan: planWithJudgment } } });
      const result = await getPlanById('rp1');
      expect(mockGet).toHaveBeenCalledWith('/reconciliation-plans/rp1');
      expect(result.judgment.case_id).toBe('c1');
    });
  });

  describe('selectPlan', () => {
    it('應 POST /reconciliation-plans/:id/select 並返回 plan', async () => {
      mockPost.mockResolvedValue({ data: { data: { plan: mockPlan } } });
      const result = await selectPlan('rp1');
      expect(mockPost).toHaveBeenCalledWith('/reconciliation-plans/rp1/select');
      expect(result).toEqual(mockPlan);
    });
  });
});
