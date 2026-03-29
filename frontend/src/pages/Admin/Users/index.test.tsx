import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminUsersPage from './index';

const { mockUseQuery, mockUseMutation, mockUseQueryClient } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseQueryClient: vi.fn(),
}));
const mockUseAdminAccess = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    listUsers: vi.fn(),
    getUserDetail: vi.fn(),
    updateUserStatus: vi.fn(),
  },
}));
vi.mock('@/hooks/useAdminAccess', () => ({
  useAdminAccess: (...args: unknown[]) => mockUseAdminAccess(...args),
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminAccess.mockReturnValue({ hasPermission: true });
    mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
    mockUseQuery
      .mockReturnValueOnce({
        data: {
          items: [
            {
              id: 'u1',
              email: 'u1@test.com',
              nickname: 'u1',
              is_active: true,
              locked_until: '2000-01-01T00:00:00.000Z',
            },
            {
              id: 'u2',
              email: 'u2@test.com',
              nickname: 'u2',
              is_active: true,
              locked_until: '2999-01-01T00:00:00.000Z',
            },
          ],
        },
        error: null,
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { user: {} },
        error: null,
      });
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('應顯示用戶清單', () => {
    render(<AdminUsersPage />);
    expect(screen.getByText('admin.users.heading')).toBeInTheDocument();
    expect(screen.getByText('u1@test.com')).toBeInTheDocument();
  });

  it('locked_until 過期時應顯示鎖定而非解除', () => {
    render(<AdminUsersPage />);
    const texts = screen.getAllByRole('button').map((b) => b.textContent || '');
    expect(texts.some((t) => /lock30m|鎖定30分鐘/i.test(t))).toBe(true);
    expect(texts.some((t) => /unlock|解除鎖定/i.test(t))).toBe(true);
  });

  it('缺少 users:write 時應禁用狀態操作按鈕', () => {
    mockUseAdminAccess.mockReturnValue({ hasPermission: false });
    render(<AdminUsersPage />);
    expect(screen.getByText('admin.users.writeDenied')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'admin.users.lock30m' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'admin.users.deactivate' })[0]).toBeDisabled();
  });
});

describe('AdminUsersPage when usersQuery fails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminAccess.mockReturnValue({ hasPermission: true });
    mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
    mockUseQuery.mockReturnValue({
      data: undefined,
      error: new Error('load failed'),
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('應顯示 admin.users.loadFailed Alert', () => {
    render(<AdminUsersPage />);
    expect(screen.getByText('admin.users.loadFailed')).toBeInTheDocument();
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
    render(<AdminUsersPage />);
    screen.getByTestId('admin-users-load-retry').click();
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
    render(<AdminUsersPage />);
    const retryBtn = screen.getByTestId('admin-users-load-retry');
    retryBtn.click();
    retryBtn.click();
    expect(mockRefetch).toHaveBeenCalledTimes(2);
  });
});

describe('AdminUsersPage when detailQuery fails', () => {
  const mockDetailRefetch = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminAccess.mockReturnValue({ hasPermission: true });
    mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
    mockUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [{ id: 'u1', email: 'u1@test.com', nickname: 'u1', is_active: true, locked_until: null }] },
        error: null,
        isLoading: false,
      })
      .mockReturnValueOnce({ data: undefined, error: null, isLoading: false })
      .mockReturnValueOnce({
        data: { items: [{ id: 'u1', email: 'u1@test.com', nickname: 'u1', is_active: true, locked_until: null }] },
        error: null,
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: undefined,
        error: new Error('detail load failed'),
        isLoading: false,
        isFetching: false,
        refetch: mockDetailRefetch,
      });
  });

  it('detailQuery 失敗時應顯示 detailLoadFailed 與 retry，點擊 retry 應重新拉取（F10 錯誤恢復）', async () => {
    const user = userEvent.setup();
    render(<AdminUsersPage />);
    await user.click(screen.getByText('admin.users.detail'));
    await waitFor(() => {
      expect(screen.getByText('admin.users.detailLoadFailed')).toBeInTheDocument();
    });
    screen.getByTestId('admin-users-detail-retry').click();
    expect(mockDetailRefetch).toHaveBeenCalled();
  });
});
