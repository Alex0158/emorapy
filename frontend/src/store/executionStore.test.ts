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
});
