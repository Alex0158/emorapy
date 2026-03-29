import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminAuditLogsPage from './index';

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    listAuditLogs: vi.fn(),
    downloadAuditLogsCsv: vi.fn(),
  },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('AdminAuditLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: {
        items: [{ id: 'log1', created_at: '2026-01-01T00:00:00.000Z', actor_id: 'admin-1', entity_type: 'user', action: 'user_activate', detail: {} }],
      },
      error: null,
      isLoading: false,
    });
  });

  it('應顯示審計日誌列表', () => {
    render(<AdminAuditLogsPage />);
    expect(screen.getByText('admin.audit.heading')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
  });
});

describe('AdminAuditLogsPage when query fails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: undefined,
      error: new Error('load failed'),
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('應顯示 admin.audit.loadFailed Alert', () => {
    render(<AdminAuditLogsPage />);
    expect(screen.getByText('admin.audit.loadFailed')).toBeInTheDocument();
  });

  it('應仍可點擊 retry 重新拉取（F10 錯誤恢復：失敗不阻塞重試）', () => {
    const mockRefetch = vi.fn();
    mockUseQuery.mockReturnValue({
      data: undefined,
      error: new Error('load failed'),
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });
    render(<AdminAuditLogsPage />);
    screen.getByTestId('admin-audit-load-retry').click();
    expect(mockRefetch).toHaveBeenCalled();
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
    render(<AdminAuditLogsPage />);
    const retryBtn = screen.getByTestId('admin-audit-load-retry');
    retryBtn.click();
    retryBtn.click();
    expect(mockRefetch).toHaveBeenCalledTimes(2);
  });
});

