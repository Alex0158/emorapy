import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminJobsPage from './index';

const { mockUseQuery, mockUseMutation, mockUseQueryClient } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseQueryClient: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    listJobs: vi.fn(),
    triggerJob: vi.fn(),
  },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('AdminJobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
    mockUseQuery.mockReturnValue({
      data: {
        jobs: [{ key: 'cleanup_expired_sessions', schedule: '*/5 * * * *', running: true, latestRun: null }],
      },
      error: null,
      isLoading: false,
    });
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('應顯示任務列表', () => {
    render(<AdminJobsPage />);
    expect(screen.getByText('admin.jobs.heading')).toBeInTheDocument();
    expect(screen.getByText('cleanup_expired_sessions')).toBeInTheDocument();
  });
});

