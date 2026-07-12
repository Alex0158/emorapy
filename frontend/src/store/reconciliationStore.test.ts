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
  plan_content: '方案一內容',
  plan_type: 'activity' as const,
  difficulty_level: 'easy' as const,
  time_cost: 2,
  money_cost: 1,
  emotion_cost: 3,
  skill_requirement: 2,
  user1_selected: false,
  user2_selected: false,
  created_at: '2025-01-01T00:00:00Z',
};

const mockPlanBundle = (plans = [mockPlan]) => ({
  plans,
  recommended_plan_id: plans[0]?.id ?? null,
  intent: 'repair' as const,
  applied_preferences: null,
  journey_entry: {
    status: 'none',
    track_id: null,
    active_plan_id: null,
    recommended_action: 'generate_bundle',
    last_pulse: null,
    has_superseded_versions: false,
  },
  version_summary: {
    version_group_id: null,
    has_superseded_versions: false,
    superseded_versions_count: 0,
  },
});

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
    mockGetPlans.mockResolvedValue(mockPlanBundle([mockPlan]));
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

  it('getPlans 競態：後發請求先回傳時，先發請求 reject 應直接拋出、不覆蓋 state', async () => {
    let rejectSlow!: (reason?: unknown) => void;
    mockGetPlans
      .mockImplementationOnce(() => new Promise((_, reject) => {
        rejectSlow = reject;
      }))
      .mockResolvedValueOnce(mockPlanBundle([{ ...mockPlan, id: 'p2' }]));
    const slowPromise = useReconciliationStore.getState().getPlans('j1');
    const slowRejection = expect(slowPromise).rejects.toThrow('慢請求失敗');
    const fastResult = await useReconciliationStore.getState().getPlans('j1');
    expect(fastResult).toHaveLength(1);
    expect(fastResult[0].id).toBe('p2');
    expect(useReconciliationStore.getState().plans).toHaveLength(1);
    expect(useReconciliationStore.getState().plans[0].id).toBe('p2');
    rejectSlow(new Error('慢請求失敗'));
    await slowRejection;
    expect(useReconciliationStore.getState().plans[0].id).toBe('p2');
  });

  it('generatePlans 成功應設 plans', async () => {
    mockGeneratePlans.mockResolvedValue(mockPlanBundle([mockPlan]));
    const result = await useReconciliationStore.getState().generatePlans('j1');
    expect(result).toEqual([mockPlan]);
    expect(useReconciliationStore.getState().plans).toEqual([mockPlan]);
  });

  it('selectPlan 成功應設 selectedPlan', async () => {
    mockSelectPlan.mockResolvedValue(mockPlan);
    await useReconciliationStore.getState().selectPlan('p1');
    expect(useReconciliationStore.getState().selectedPlan).toEqual(mockPlan);
  });

  it('selectPlan 失敗應設 error 並拋出', async () => {
    mockSelectPlan.mockRejectedValue(new Error('選擇方案失敗'));
    await expect(
      useReconciliationStore.getState().selectPlan('p1')
    ).rejects.toThrow('選擇方案失敗');
    expect(useReconciliationStore.getState().error).toBe('選擇方案失敗');
    expect(useReconciliationStore.getState().isLoading).toBe(false);
  });

  it('generatePlans 失敗應顯示目錄 fallback 並拋出原始錯誤', async () => {
    mockGeneratePlans.mockRejectedValue(new Error('生成方案失敗'));
    await expect(
      useReconciliationStore.getState().generatePlans('j1')
    ).rejects.toThrow('生成方案失敗');
    expect(useReconciliationStore.getState().error).toBe('生成和好方案失敗');
    expect(useReconciliationStore.getState().isLoading).toBe(false);
  });

  it('getPlans 競態：後發請求先回傳時，先發請求 reject 應直接拋出、不覆蓋 state', async () => {
    let rejectSlow!: (reason?: unknown) => void;
    mockGetPlans
      .mockImplementationOnce(() => new Promise((_, reject) => {
        rejectSlow = reject;
      }))
      .mockResolvedValueOnce(mockPlanBundle([{ ...mockPlan, id: 'p2' }]));
    const slowPromise = useReconciliationStore.getState().getPlans('j1');
    const slowRejection = expect(slowPromise).rejects.toThrow('慢請求失敗');
    const fastResult = await useReconciliationStore.getState().getPlans('j1');
    expect(fastResult).toHaveLength(1);
    expect(useReconciliationStore.getState().plans).toHaveLength(1);
    rejectSlow(new Error('慢請求失敗'));
    await slowRejection;
    expect(useReconciliationStore.getState().plans).toHaveLength(1);
  });

  it('連續調用 generatePlans 時只有最後一次生效（競態保護）', async () => {
    let resolveFirst: (v: unknown) => void;
    const firstCall = new Promise((r) => { resolveFirst = r; });
    const secondPlan = { ...mockPlan, id: 'p2' };

    mockGeneratePlans
      .mockImplementationOnce(() => firstCall)
      .mockResolvedValueOnce(mockPlanBundle([secondPlan]));

    const p1 = useReconciliationStore.getState().generatePlans('j1');
    const p2 = useReconciliationStore.getState().generatePlans('j1');

    resolveFirst!(mockPlanBundle([mockPlan]));
    await p1;
    await p2;

    expect(useReconciliationStore.getState().plans).toEqual([secondPlan]);
  });

  it('連續調用 selectPlan 時只有最後一次生效（競態保護）', async () => {
    let resolveFirst: (v: unknown) => void;
    const firstCall = new Promise((r) => { resolveFirst = r; });
    const secondPlan = { ...mockPlan, id: 'p2' };

    mockSelectPlan
      .mockImplementationOnce(() => firstCall)
      .mockResolvedValueOnce(secondPlan);

    const p1 = useReconciliationStore.getState().selectPlan('p1');
    const p2 = useReconciliationStore.getState().selectPlan('p2');

    resolveFirst!(mockPlan);
    await p1;
    await p2;

    expect(useReconciliationStore.getState().selectedPlan).toEqual(secondPlan);
  });

  it('getPlans 競態：後發請求先 reject 時，先發請求 reject 應直接拋出、不覆蓋 state', async () => {
    let rejectSlow!: (reason?: unknown) => void;
    mockGetPlans
      .mockImplementationOnce(() => new Promise((_, reject) => {
        rejectSlow = reject;
      }))
      .mockRejectedValueOnce(new Error('快請求失敗'));
    const slowPromise = useReconciliationStore.getState().getPlans('j1');
    const slowRejection = expect(slowPromise).rejects.toThrow('慢請求失敗');
    await expect(useReconciliationStore.getState().getPlans('j2')).rejects.toThrow('快請求失敗');
    expect(useReconciliationStore.getState().error).toBe('獲取和好方案失敗');
    rejectSlow(new Error('慢請求失敗'));
    await slowRejection;
    expect(useReconciliationStore.getState().error).toBe('獲取和好方案失敗');
  });

  it('selectPlan 競態：後發請求先回傳時，先發請求 reject 應直接拋出、不覆蓋 state', async () => {
    let rejectSlow!: (reason?: unknown) => void;
    mockSelectPlan
      .mockImplementationOnce(() => new Promise((_, reject) => {
        rejectSlow = reject;
      }))
      .mockResolvedValueOnce({ ...mockPlan, id: 'p2' });
    const slowPromise = useReconciliationStore.getState().selectPlan('p1');
    const slowRejection = expect(slowPromise).rejects.toThrow('慢請求失敗');
    await useReconciliationStore.getState().selectPlan('p2');
    expect(useReconciliationStore.getState().selectedPlan?.id).toBe('p2');
    rejectSlow(new Error('慢請求失敗'));
    await slowRejection;
    expect(useReconciliationStore.getState().selectedPlan?.id).toBe('p2');
  });
});
