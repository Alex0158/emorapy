import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    });
  });

  it('應渲染健康詳情資訊', () => {
    render(<AdminHealthPage />);
    expect(screen.getByText('admin.health.heading')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01T00:00:00.000Z')).toBeInTheDocument();
  });
});
