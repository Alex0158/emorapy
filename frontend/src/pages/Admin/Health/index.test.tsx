import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminHealthPage from './index';

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    getHealthDetailed: vi.fn(),
  },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('AdminHealthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        status: 'healthy',
        timestamp: '2026-01-01T00:00:00.000Z',
        cronStarted: true,
        activeJobCount: 3,
        adminCount: 1,
        userCount: 10,
        env: { nodeEnv: 'test', scheduledJobsEnabled: true },
        performance: { p95: 42 },
      },
      refetch: vi.fn(),
      isFetching: false,
    });
  });

  it('應渲染健康詳情資訊', () => {
    render(<AdminHealthPage />);
    expect(screen.getByText('admin.health.heading')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01T00:00:00.000Z')).toBeInTheDocument();
  });

  it('useQuery 回傳 error 時應顯示 loadFailed Alert', () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      error: new Error('fetch failed'),
      data: undefined,
      refetch: vi.fn(),
      isFetching: false,
    });
    render(<AdminHealthPage />);
    expect(screen.getByText('admin.health.loadFailed')).toBeInTheDocument();
  });

  it('retry 失敗後應仍可再次點擊 retry（F10 錯誤恢復：失敗不阻塞重試）', () => {
    const mockRefetch = vi.fn();
    mockUseQuery.mockReturnValue({
      data: undefined,
      error: new Error('load failed'),
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });
    render(<AdminHealthPage />);
    const retryBtn = screen.getByTestId('admin-health-load-retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(2);
  });

  it('useQuery 回傳 error 時應仍可點擊 retry 重新拉取（F10 錯誤恢復：失敗不阻塞重試）', () => {
    const mockRefetch = vi.fn();
    mockUseQuery.mockReturnValue({
      isLoading: false,
      error: new Error('fetch failed'),
      data: undefined,
      refetch: mockRefetch,
      isFetching: false,
    });
    render(<AdminHealthPage />);
    expect(screen.getByText('admin.health.loadFailed')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('admin-health-load-retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
