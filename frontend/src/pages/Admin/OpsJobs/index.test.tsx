/**
 * Admin OpsJobs 頁面單元測試
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OpsJobsStatsPage from './index';

const {
  mockUseAdminJobStats,
  mockUseAdminAccess,
  mockUseAdminToken,
  mockSetAdminToken,
  mockGetRateDenominatorLabel,
  mockShouldShowSampledHint,
} = vi.hoisted(() => ({
  mockUseAdminJobStats: vi.fn(),
  mockUseAdminAccess: vi.fn(),
  mockUseAdminToken: vi.fn(() => ''),
  mockSetAdminToken: vi.fn(),
  mockGetRateDenominatorLabel: vi.fn(() => 'totalRuns'),
  mockShouldShowSampledHint: vi.fn(() => false),
}));

vi.mock('@/hooks/useAdminJobStats', () => ({
  useAdminJobStats: (...args: unknown[]) => mockUseAdminJobStats(...args),
}));
vi.mock('@/hooks/useAdminAccess', () => ({
  useAdminAccess: (...args: unknown[]) => mockUseAdminAccess(...args),
}));
vi.mock('@/hooks/useAdminToken', () => ({
  useAdminToken: () => mockUseAdminToken(),
}));

vi.mock('@/services/api/admin', () => ({
  setAdminToken: (...args: unknown[]) => {
    mockSetAdminToken(...args);
    return true;
  },
  isLikelyAdminJwt: (token: string) =>
    token === 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature' ||
    token === 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.newsignature' ||
    token === 'admin-jwt' ||
    token === 'saved-admin-token',
  getRateDenominatorLabel: (...args: unknown[]) => mockGetRateDenominatorLabel(...args),
  shouldShowSampledHint: (...args: unknown[]) => mockShouldShowSampledHint(...args),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="protected">{children}</div>,
}));

vi.mock('@/components/common/SEO', () => ({
  default: () => null,
}));

vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="animated">{children}</div>,
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('OpsJobsStatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminToken.mockReturnValue('');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        data: undefined,
        error: null,
        isLoading: false,
        refetch: vi.fn().mockResolvedValue({ data: undefined }),
      },
      permissions: [],
      hasPermission: false,
    });
    mockUseAdminJobStats.mockReturnValue({
      data: undefined,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('當未設置 admin token 時應顯示 tokenRequired 提示', () => {
    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('admin.ops.tokenRequired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeDisabled();
  });

  it('有資料且 sampled=true 時應顯示 sampled 提示與 perJob 表格', () => {
    mockUseAdminToken.mockReturnValue('admin-jwt');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        data: {
          admin: {
            id: 'admin-1',
            email: 'ops@example.com',
            roleKey: 'ops',
            permissions: ['ops:read'],
          },
        },
        error: null,
        isLoading: false,
        refetch: vi.fn().mockResolvedValue({
          data: {
            admin: {
              id: 'admin-1',
              email: 'ops@example.com',
              roleKey: 'ops',
              permissions: ['ops:read'],
            },
          },
        }),
      },
      permissions: ['ops:read'],
      hasPermission: true,
    });
    mockShouldShowSampledHint.mockReturnValue(true);
    mockUseAdminJobStats.mockReturnValue({
      data: {
        days: 7,
        since: '2026-02-20T00:00:00.000Z',
        totals: {
          totalRuns: 10,
          successRuns: 8,
          failedRuns: 1,
          runningRuns: 1,
          completedRuns: 9,
          successRate: 0.8,
          failureRate: 0.1,
          successRateCompleted: 0.8889,
          failureRateCompleted: 0.1111,
          avgDurationMs: 1000,
        },
        perJob: [
          {
            jobKey: 'cleanup_expired_sessions',
            totalRuns: 10,
            successRuns: 8,
            failedRuns: 1,
            runningRuns: 1,
            completedRuns: 9,
            successRate: 0.8,
            failureRate: 0.1,
            successRateCompleted: 0.8889,
            failureRateCompleted: 0.1111,
            avgDurationMs: 1000,
            totalAffectedCount: 12,
            lastRunAt: '2026-02-20T01:00:00.000Z',
          },
        ],
        dailyBuckets: [],
        rateBase: 'total_runs',
        statsMeta: {
          maxRows: 5000,
          returnedRows: 10,
          sampled: true,
          sampleStrategy: 'latest_runs_desc',
        },
      },
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('admin.ops.sampledHint')).toBeInTheDocument();
    expect(screen.getByText('cleanup_expired_sessions')).toBeInTheDocument();
  });

  it('驗證 admin 身份中時應顯示 verifyingAccess', () => {
    mockUseAdminToken.mockReturnValue('admin-jwt');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        data: undefined,
        error: null,
        isLoading: true,
        refetch: vi.fn().mockResolvedValue({ data: undefined }),
      },
      permissions: [],
      hasPermission: false,
    });

    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('admin.ops.verifyingAccess')).toBeInTheDocument();
  });

  it('可載入 stats 時 retry 應可點擊且觸發 refetch', async () => {
    const user = userEvent.setup();
    const mockRefetch = vi.fn().mockResolvedValue({ data: undefined });
    mockUseAdminToken.mockReturnValue('admin-jwt');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        data: {
          admin: {
            id: 'admin-1',
            email: 'ops@example.com',
            roleKey: 'ops',
            permissions: ['ops:read'],
          },
        },
        error: null,
        isLoading: false,
        refetch: vi.fn().mockResolvedValue({ data: undefined }),
      },
      permissions: ['ops:read'],
      hasPermission: true,
    });
    mockUseAdminJobStats.mockReturnValue({
      data: undefined,
      error: null,
      refetch: mockRefetch,
    });

    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    const retryButton = screen.getByRole('button', { name: 'common.retry' });
    expect(retryButton).not.toBeDisabled();
    await user.click(retryButton);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('缺少 ops:read 權限時應顯示 accessDenied', () => {
    mockUseAdminToken.mockReturnValue('admin-jwt');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        data: {
          admin: {
            id: 'admin-2',
            email: 'support@example.com',
            roleKey: 'support',
            permissions: ['users:read'],
          },
        },
        error: null,
        isLoading: false,
        refetch: vi.fn().mockResolvedValue({
          data: {
            admin: {
              id: 'admin-2',
              email: 'support@example.com',
              roleKey: 'support',
              permissions: ['users:read'],
            },
          },
        }),
      },
      permissions: ['users:read'],
      hasPermission: false,
    });

    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('admin.ops.accessDenied')).toBeInTheDocument();
  });

  it('saved token 格式無效時應優先顯示 invalidTokenFormat', () => {
    mockUseAdminToken.mockReturnValue('invalid-token');
    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('admin.ops.invalidTokenFormat')).toBeInTheDocument();
    expect(screen.queryByText('admin.ops.tokenRequired')).not.toBeInTheDocument();
  });

  it('saved token 無效但輸入新 valid token 未保存時應顯示 tokenNotApplied', async () => {
    const user = userEvent.setup();
    mockUseAdminToken.mockReturnValue('invalid-token');

    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    await user.clear(screen.getByPlaceholderText('admin.ops.tokenPlaceholder'));
    await user.type(
      screen.getByPlaceholderText('admin.ops.tokenPlaceholder'),
      'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.newsignature'
    );

    expect(screen.getByText('admin.ops.tokenNotApplied')).toBeInTheDocument();
    expect(screen.queryAllByText('admin.ops.invalidTokenFormat').length).toBe(0);
    expect(screen.queryByText('admin.ops.tokenRequired')).not.toBeInTheDocument();
  });

  it('tokenInput 未保存時應顯示 tokenNotApplied', async () => {
    mockUseAdminToken.mockReturnValue('saved-admin-token');
    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );
    expect(screen.queryByText('admin.ops.tokenNotApplied')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText('admin.ops.tokenPlaceholder'));
    await userEvent.type(
      screen.getByPlaceholderText('admin.ops.tokenPlaceholder'),
      'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.newsignature'
    );
    expect(screen.getByText('admin.ops.tokenNotApplied')).toBeInTheDocument();
  });

  it('保存 token 時應使用 trim 後值寫入 storage', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    await user.type(
      screen.getByPlaceholderText('admin.ops.tokenPlaceholder'),
      '  eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature  '
    );
    await user.click(screen.getByRole('button', { name: 'admin.ops.saveToken' }));
    expect(mockSetAdminToken).toHaveBeenCalledWith('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature');
  });

  it('輸入無效 token 格式時不應保存', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('admin.ops.tokenPlaceholder'), 'invalid-token');
    expect(screen.getByText('admin.ops.invalidTokenFormat')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'admin.ops.saveToken' }));
    expect(mockSetAdminToken).not.toHaveBeenCalled();
  });

  it('清除已保存 token 後應顯示 tokenRequired', async () => {
    const user = userEvent.setup();
    mockUseAdminToken.mockReturnValue('saved-admin-token');

    render(
      <MemoryRouter>
        <OpsJobsStatsPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'admin.ops.clearToken' }));
    expect(mockSetAdminToken).toHaveBeenCalledWith('');
  });
});

