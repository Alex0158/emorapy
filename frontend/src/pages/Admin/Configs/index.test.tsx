import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminConfigsPage from './index';

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
    listConfigs: vi.fn(),
    getInterviewRuntimeConfig: vi.fn(),
    upsertConfig: vi.fn(),
  },
}));
vi.mock('@/hooks/useAdminAccess', () => ({
  useAdminAccess: (...args: unknown[]) => mockUseAdminAccess(...args),
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

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

