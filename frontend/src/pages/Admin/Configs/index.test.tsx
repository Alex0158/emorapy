import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminConfigsPage from './index';

const { mockUseQuery, mockUseMutation, mockUseQueryClient, mockUpsertConfig, mockMessageError, mockMessageSuccess } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseQueryClient: vi.fn(),
  mockUpsertConfig: vi.fn(),
  mockMessageError: vi.fn(),
  mockMessageSuccess: vi.fn(),
}));
const mockUseAdminAccess = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    listConfigs: vi.fn(),
    getInterviewRuntimeConfig: vi.fn(),
    upsertConfig: (...args: unknown[]) => mockUpsertConfig(...args),
  },
}));
vi.mock('@/hooks/useAdminAccess', () => ({
  useAdminAccess: (...args: unknown[]) => mockUseAdminAccess(...args),
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      ...actual.message,
      error: (...args: unknown[]) => mockMessageError(...args),
      success: (...args: unknown[]) => mockMessageSuccess(...args),
    },
  };
});

describe('AdminConfigsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminAccess.mockReturnValue({ hasPermission: true });
    mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [{ id: 'cfg1', key: 'jobs.enabled', value: true, updated_at: '2026-01-01' }] },
        error: null,
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { runtime: { maxTurns: 30 } },
        error: null,
      });
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('應顯示配置列表與 runtime 區塊', () => {
    render(<AdminConfigsPage />);
    expect(screen.getByText('admin.configs.heading')).toBeInTheDocument();
    expect(screen.getByText('jobs.enabled')).toBeInTheDocument();
  });

  it('缺少 config:write 時應禁用保存按鈕', () => {
    mockUseAdminAccess.mockReturnValue({ hasPermission: false });
    render(<AdminConfigsPage />);
    expect(screen.getByText('admin.configs.writeDenied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'admin.configs.save' })).toBeDisabled();
  });
});

describe('AdminConfigsPage when a query fails', () => {
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

  it('應顯示 admin.configs.loadFailed Alert', () => {
    render(<AdminConfigsPage />);
    expect(screen.getByText('admin.configs.loadFailed')).toBeInTheDocument();
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
    render(<AdminConfigsPage />);
    screen.getByTestId('admin-configs-load-retry').click();
    expect(mockRefetch).toHaveBeenCalledTimes(2);
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
    render(<AdminConfigsPage />);
    const retryBtn = screen.getByTestId('admin-configs-load-retry');
    retryBtn.click();
    retryBtn.click();
    expect(mockRefetch).toHaveBeenCalledTimes(4);
  });
});

describe('AdminConfigsPage when upsert fails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminAccess.mockReturnValue({ hasPermission: true });
    mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [] },
        error: null,
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { runtime: {} },
        error: null,
      });
    mockUpsertConfig.mockRejectedValue({ code: 'SERVER_ERROR' });
    mockUseMutation.mockImplementation((opts: { mutationFn: (v: unknown) => Promise<unknown>; onError?: (e: unknown) => void }) => {
      const mutate = vi.fn((values: unknown) =>
        Promise.resolve(opts.mutationFn(values)).catch((err: unknown) => opts.onError?.(err))
      );
      return { mutate, isPending: false };
    });
  });

  it('upsertConfig 失敗且非 FORBIDDEN 時應顯示 admin.configs.saveFailed', async () => {
    render(<AdminConfigsPage />);
    await userEvent.type(screen.getByLabelText('admin.configs.key'), 'test.key');
    // value 已有 initialValue="{}"，無需再填
    await userEvent.click(screen.getByRole('button', { name: 'admin.configs.save' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('admin.configs.saveFailed');
    });
  });

  it('upsertConfig FORBIDDEN 時應顯示 admin.ops.accessDenied', async () => {
    mockUpsertConfig.mockRejectedValue({ code: 'FORBIDDEN' });
    render(<AdminConfigsPage />);
    await userEvent.type(screen.getByLabelText('admin.configs.key'), 'test.key');
    await userEvent.click(screen.getByRole('button', { name: 'admin.configs.save' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('admin.ops.accessDenied');
    });
  });
});

describe('AdminConfigsPage when upsert succeeds', () => {
  const mockInvalidateQueries = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminAccess.mockReturnValue({ hasPermission: true });
    mockUseQueryClient.mockReturnValue({ invalidateQueries: mockInvalidateQueries });
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [] },
        error: null,
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { runtime: {} },
        error: null,
      });
    mockUpsertConfig.mockResolvedValue(undefined);
    mockUseMutation.mockImplementation((opts: { mutationFn: (v: unknown) => Promise<unknown>; onSuccess?: () => void }) => {
      const mutate = vi.fn((values: unknown) =>
        Promise.resolve(opts.mutationFn(values)).then(() => opts.onSuccess?.())
      );
      return { mutate, isPending: false };
    });
  });

  it('upsertConfig 成功時應顯示 saveSuccess 並 invalidate configs（F10 配置生效）', async () => {
    render(<AdminConfigsPage />);
    await userEvent.type(screen.getByLabelText('admin.configs.key'), 'test.key');
    await userEvent.click(screen.getByRole('button', { name: 'admin.configs.save' }));
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('admin.configs.saveSuccess');
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['admin', 'configs'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['admin', 'runtime', 'interview'] });
  });
});
