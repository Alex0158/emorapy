/**
 * useAdminJobStats Hook 單元測試
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeAdminJobStatsQuery } from '@/utils/adminJobStatsQuery';
import { useAdminJobStats } from './useAdminJobStats';

const mockGetJobStats = vi.fn();

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    getJobStats: (...args: unknown[]) => mockGetJobStats(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAdminJobStats', () => {
  it('normalizeAdminJobStatsQuery 應正規化越界與非法值', () => {
    expect(
      normalizeAdminJobStatsQuery({
        days: -99,
        includeRunning: true,
        maxRows: 999999,
      })
    ).toEqual({
      days: 1,
      includeRunning: true,
      maxRows: 20000,
    });

    expect(
      normalizeAdminJobStatsQuery({
        days: Number.NaN,
        includeRunning: undefined,
        maxRows: Number.POSITIVE_INFINITY,
      })
    ).toEqual({});
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應在 enabled=true 時調用 API 並返回資料', async () => {
    mockGetJobStats.mockResolvedValue({
      days: 7,
      since: '2026-02-20T00:00:00.000Z',
      totals: {
        totalRuns: 1,
        successRuns: 1,
        failedRuns: 0,
        runningRuns: 0,
        completedRuns: 1,
        successRate: 1,
        failureRate: 0,
        successRateCompleted: 1,
        failureRateCompleted: 0,
        avgDurationMs: 100,
      },
      perJob: [],
      dailyBuckets: [],
      rateBase: 'total_runs',
      statsMeta: {
        maxRows: 5000,
        returnedRows: 1,
        sampled: false,
        sampleStrategy: 'latest_runs_desc',
      },
    });

    const { result } = renderHook(() => useAdminJobStats({ days: 7, includeRunning: true, maxRows: 5000 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetJobStats).toHaveBeenCalledWith({ days: 7, includeRunning: true, maxRows: 5000 });
  });

  it('應在 enabled=true 時以正規化 query 調用 API', async () => {
    mockGetJobStats.mockResolvedValue({
      days: 1,
      since: '2026-02-20T00:00:00.000Z',
      totals: {
        totalRuns: 0,
        successRuns: 0,
        failedRuns: 0,
        runningRuns: 0,
        completedRuns: 0,
        successRate: 0,
        failureRate: 0,
        successRateCompleted: 0,
        failureRateCompleted: 0,
        avgDurationMs: 0,
      },
      perJob: [],
      dailyBuckets: [],
      rateBase: 'total_runs',
      statsMeta: {
        maxRows: 20000,
        returnedRows: 0,
        sampled: false,
        sampleStrategy: 'latest_runs_desc',
      },
    });

    const { result } = renderHook(() => useAdminJobStats({ days: -10, includeRunning: true, maxRows: 999999 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetJobStats).toHaveBeenCalledWith({ days: 1, includeRunning: true, maxRows: 20000 });
  });

  it('應在 enabled=false 時不調用 API', async () => {
    renderHook(() => useAdminJobStats({ days: 7 }, false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockGetJobStats).not.toHaveBeenCalled());
  });
});

