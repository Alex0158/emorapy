/**
 * usePollingJudgment Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePollingJudgment } from './usePollingJudgment';

const mockGetJudgmentByCaseId = vi.fn();
vi.mock('@/services/api/judgment', () => ({
  getJudgmentByCaseId: (...args: unknown[]) => mockGetJudgmentByCaseId(...args),
}));

const mockCreatePolling = vi.fn();
vi.mock('@/utils/polling', () => ({
  createPolling: (...args: unknown[]) => mockCreatePolling(...args),
}));

describe('usePollingJudgment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatePolling.mockImplementation((fetchFn: () => Promise<unknown>, opts: { onSuccess?: (d: unknown) => boolean; onError?: (e: Error) => boolean }) => {
      const start = () =>
        fetchFn()
          .then((data) => {
            if (opts.onSuccess?.(data)) return;
          })
          .catch((err) => {
            opts.onError?.(err as Error);
          });
      return { start, stop: vi.fn() };
    });
  });

  it('enabled=false 時不應調用 createPolling', () => {
    renderHook(() =>
      usePollingJudgment({ caseId: 'c1', enabled: false })
    );
    expect(mockCreatePolling).not.toHaveBeenCalled();
  });

  it('caseId 為空時不應調用 createPolling', () => {
    renderHook(() =>
      usePollingJudgment({ caseId: '', enabled: true })
    );
    expect(mockCreatePolling).not.toHaveBeenCalled();
  });

  it('enabled 且 caseId 存在時應調用 createPolling 並 start', async () => {
    mockGetJudgmentByCaseId.mockResolvedValue({
      id: 'j1',
      case_id: 'c1',
      judgment_content: '判決內容',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
      ai_model: 'gpt-4',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    });
    const { result } = renderHook(() =>
      usePollingJudgment({ caseId: 'c1', enabled: true })
    );
    expect(mockCreatePolling).toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.judgment?.id).toBe('j1');
    });
  });

  it('輪詢成功取得判決時應更新 judgment 並停止 loading', async () => {
    const judgment = {
      id: 'j1',
      case_id: 'c1',
      judgment_content: '判決內容',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
      ai_model: 'gpt-4',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    mockGetJudgmentByCaseId.mockResolvedValue(judgment);
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      usePollingJudgment({ caseId: 'c1', enabled: true, onSuccess })
    );
    await waitFor(
      () => {
        expect(result.current.judgment).toEqual(judgment);
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000 }
    );
    expect(onSuccess).toHaveBeenCalledWith(judgment);
  });

  it('輪詢失敗時應調用 onError 並停止 loading', async () => {
    mockGetJudgmentByCaseId.mockRejectedValue(new Error('network error'));
    const onError = vi.fn();
    const { result } = renderHook(() =>
      usePollingJudgment({ caseId: 'c1', enabled: true, onError })
    );
    await waitFor(
      () => {
        expect(onError).toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000 }
    );
  });

  it('unmount 時應調用 stop', () => {
    const stop = vi.fn();
    mockCreatePolling.mockReturnValue({
      start: () => Promise.resolve(null),
      stop,
    });
    const { unmount } = renderHook(() =>
      usePollingJudgment({ caseId: 'c1', enabled: true })
    );
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
