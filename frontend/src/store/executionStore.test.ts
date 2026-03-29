/**
 * executionStore 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExecutionStore } from './executionStore';

const mockConfirmExecution = vi.fn();
const mockCheckin = vi.fn();
const mockGetExecutionStatus = vi.fn();

vi.mock('@/services/api/execution', () => ({
  confirmExecution: (...args: unknown[]) => mockConfirmExecution(...args),
  checkin: (...args: unknown[]) => mockCheckin(...args),
  getExecutionStatus: (...args: unknown[]) => mockGetExecutionStatus(...args),
}));

const mockStatus = {
  plan_id: 'p1',
  status: 'in_progress' as const,
  records: [],
  progress: 50,
  plan_summary: {
    title: '方案',
    plan_type: 'activity' as const,
    difficulty_level: 'easy' as const,
  },
};

describe('executionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExecutionStore.setState({
      executions: [],
      currentExecution: null,
      error: null,
      isLoading: false,
    });
  });

  it('setCurrentExecution 應更新 currentExecution', () => {
    useExecutionStore.getState().setCurrentExecution(mockStatus);
    expect(useExecutionStore.getState().currentExecution).toEqual(mockStatus);
  });

  it('clearError 應清空 error', () => {
    useExecutionStore.setState({ error: 'some error' });
    useExecutionStore.getState().clearError();
    expect(useExecutionStore.getState().error).toBeNull();
  });

  it('confirmExecution 成功應不設 error', async () => {
    mockConfirmExecution.mockResolvedValue(undefined);
    await useExecutionStore.getState().confirmExecution('p1');
    expect(useExecutionStore.getState().error).toBeNull();
    expect(useExecutionStore.getState().isLoading).toBe(false);
  });

  it('confirmExecution 失敗應設 error 並拋出', async () => {
    mockConfirmExecution.mockRejectedValue(new Error('確認失敗'));
    await expect(
      useExecutionStore.getState().confirmExecution('p1')
    ).rejects.toThrow('確認失敗');
    expect(useExecutionStore.getState().error).toBe('確認失敗');
  });

  it('getExecutionStatus 成功應設 currentExecution', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockStatus);
    const result = await useExecutionStore.getState().getExecutionStatus('p1');
    expect(result).toEqual(mockStatus);
    expect(useExecutionStore.getState().currentExecution).toEqual(mockStatus);
  });

  it('getExecutionStatus 失敗應設 error 並拋出', async () => {
    mockGetExecutionStatus.mockRejectedValue(new Error('取得狀態失敗'));
    await expect(
      useExecutionStore.getState().getExecutionStatus('p1')
    ).rejects.toThrow('取得狀態失敗');
    expect(useExecutionStore.getState().error).toBe('取得狀態失敗');
    expect(useExecutionStore.getState().isLoading).toBe(false);
  });

  it('getExecutionStatus 競態：後發請求先回傳時，先發請求回傳應忽略不覆蓋 state', async () => {
    const status1 = { ...mockStatus, plan_id: 'p1' };
    const status2 = { ...mockStatus, plan_id: 'p2' };
    mockGetExecutionStatus
      .mockImplementationOnce(() => new Promise((r) => setTimeout(() => r(status1), 50)))
      .mockResolvedValueOnce(status2);
    const slowPromise = useExecutionStore.getState().getExecutionStatus('p1');
    const fastResult = await useExecutionStore.getState().getExecutionStatus('p2');
    expect(fastResult).toEqual(status2);
    expect(useExecutionStore.getState().currentExecution).toEqual(status2);
    await slowPromise;
    expect(useExecutionStore.getState().currentExecution).toEqual(status2);
  });

  it('getExecutionStatus 競態：後發請求先 reject 時，先發請求 reject 應直接拋出、不設 error', async () => {
    mockGetExecutionStatus
      .mockImplementationOnce(() => new Promise((_, r) => setTimeout(() => r(new Error('慢請求失敗')), 50)))
      .mockRejectedValueOnce(new Error('快請求失敗'));
    const slowPromise = useExecutionStore.getState().getExecutionStatus('p1');
    await expect(useExecutionStore.getState().getExecutionStatus('p2')).rejects.toThrow('快請求失敗');
    expect(useExecutionStore.getState().error).toBe('快請求失敗');
    await expect(slowPromise).rejects.toThrow('慢請求失敗');
    expect(useExecutionStore.getState().error).toBe('快請求失敗');
  });

  it('checkin 成功應清除 loading', async () => {
    mockCheckin.mockResolvedValue(undefined);
    const data = { plan_id: 'p1', notes: '已完成' };
    await useExecutionStore.getState().checkin(data);
    expect(mockCheckin).toHaveBeenCalledWith(data);
    expect(useExecutionStore.getState().isLoading).toBe(false);
    expect(useExecutionStore.getState().error).toBeNull();
  });

  it('checkin 失敗應設 error 並拋出', async () => {
    mockCheckin.mockRejectedValue(new Error('打卡失敗'));
    await expect(
      useExecutionStore.getState().checkin({ plan_id: 'p1' })
    ).rejects.toThrow('打卡失敗');
    expect(useExecutionStore.getState().error).toBe('打卡失敗');
    expect(useExecutionStore.getState().isLoading).toBe(false);
  });

  it('confirmExecution 在 isLoading=true 時應 reject 不呼叫 API，避免呼叫方誤判成功', async () => {
    useExecutionStore.setState({ isLoading: true });
    await expect(useExecutionStore.getState().confirmExecution('p1')).rejects.toThrow();
    expect(mockConfirmExecution).not.toHaveBeenCalled();
  });

  it('checkin 在 isLoading=true 時應 reject 不呼叫 API，避免呼叫方誤判成功', async () => {
    useExecutionStore.setState({ isLoading: true });
    await expect(useExecutionStore.getState().checkin({ plan_id: 'p1' })).rejects.toThrow();
    expect(mockCheckin).not.toHaveBeenCalled();
  });
});
