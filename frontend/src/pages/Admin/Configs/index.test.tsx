import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminConfigsPage from './index';

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
    listConfigs: vi.fn(),
    getInterviewRuntimeConfig: vi.fn(),
    upsertConfig: vi.fn(),
  },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('AdminConfigsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

