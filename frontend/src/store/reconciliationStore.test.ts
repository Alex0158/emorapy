/**
 * reconciliationStore 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReconciliationStore } from './reconciliationStore';

const mockGetPlans = vi.fn();
const mockGeneratePlans = vi.fn();
const mockSelectPlan = vi.fn();

vi.mock('@/services/api/reconciliation', () => ({
  getPlans: (...args: unknown[]) => mockGetPlans(...args),
  generatePlans: (...args: unknown[]) => mockGeneratePlans(...args),
  selectPlan: (...args: unknown[]) => mockSelectPlan(...args),
}));

const mockPlan = {
  id: 'p1',
  judgment_id: 'j1',
  title: '方案一',
  difficulty: 'easy' as const,
  type: 'activity' as const,
  steps: [],
};

describe('reconciliationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReconciliationStore.setState({
      plans: [],
      selectedPlan: null,
      error: null,
      isLoading: false,
    });
  });

  it('setSelectedPlan 應更新 selectedPlan', () => {
    useReconciliationStore.getState().setSelectedPlan(mockPlan);
    expect(useReconciliationStore.getState().selectedPlan).toEqual(mockPlan);
  });

  it('clearError 應清空 error', () => {
    useReconciliationStore.setState({ error: 'err' });
    useReconciliationStore.getState().clearError();
    expect(useReconciliationStore.getState().error).toBeNull();
  });

  it('getPlans 成功應設 plans', async () => {
    mockGetPlans.mockResolvedValue([mockPlan]);
    const result = await useReconciliationStore.getState().getPlans('j1');
    expect(result).toEqual([mockPlan]);
    expect(useReconciliationStore.getState().plans).toEqual([mockPlan]);
    expect(useReconciliationStore.getState().isLoading).toBe(false);
  });

  it('getPlans 失敗應設 error 並拋出', async () => {
    mockGetPlans.mockRejectedValue(new Error('獲取和好方案失敗'));
    await expect(useReconciliationStore.getState().getPlans('j1')).rejects.toThrow(
      '獲取和好方案失敗'
    );
    expect(useReconciliationStore.getState().error).toBe('獲取和好方案失敗');
  });

  it('generatePlans 成功應設 plans', async () => {
    mockGeneratePlans.mockResolvedValue([mockPlan]);
    const result = await useReconciliationStore.getState().generatePlans('j1');
    expect(result).toEqual([mockPlan]);
    expect(useReconciliationStore.getState().plans).toEqual([mockPlan]);
  });

  it('selectPlan 成功應設 selectedPlan', async () => {
    mockSelectPlan.mockResolvedValue(mockPlan);
    await useReconciliationStore.getState().selectPlan('p1');
    expect(useReconciliationStore.getState().selectedPlan).toEqual(mockPlan);
  });
});
