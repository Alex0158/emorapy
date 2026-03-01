import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminReportsPage from './index';

const { mockUseQuery, mockUseMutation, mockDownloadCsv } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockDownloadCsv: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    getReportOverview: vi.fn(),
    getReportFunnel: vi.fn(),
    getCustomReport: vi.fn(),
    downloadReportOverviewCsv: (...args: unknown[]) => mockDownloadCsv(...args),
  },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

Object.defineProperty(window, 'open', {
  writable: true,
  value: vi.fn(),
});
Object.defineProperty(window, 'location', {
  value: { assign: vi.fn() },
});

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery
      .mockReturnValueOnce({
        data: { totals: { users: 3, cases: 2, judgments: 1 }, conversion: { pairingRate: 0.5 } },
        error: null,
      })
      .mockReturnValueOnce({
        data: { stages: [] },
        error: null,
      })
      .mockReturnValueOnce({
        data: {
          partial: false,
          summary: {
            redisMemoryMb: 0,
            railwayEgressGb24h: 0,
            openaiCostUsd24h: 0,
            openaiCostUsd7d: 0,
            openaiInputTokens24h: 0,
            openaiOutputTokens24h: 0,
          },
          redis: { status: 'ok' },
          railway: { status: 'ok', dailyEgressGb: [] },
          openai: { status: 'ok', dailyCostUsd: [] },
        },
        error: null,
      });
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      data: { metrics: {} },
    });
    mockDownloadCsv.mockResolvedValue(new Blob(['metric,value\nusers,1']));
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('應顯示報表資訊並允許匯出 CSV', async () => {
    const user = userEvent.setup();
    render(<AdminReportsPage />);

    expect(screen.getByText('admin.reports.heading')).toBeInTheDocument();
    expect(screen.getByText('admin.reports.overview')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'admin.reports.exportCsv' }));
    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
  });
});
