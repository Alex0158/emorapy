import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminSettingsPage from './index';

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
    listAdminUsers: vi.fn(),
    listConfigs: vi.fn(),
    createAdminUser: vi.fn(),
    updateAdminUser: vi.fn(),
    deleteAdminUser: vi.fn(),
    upsertAlertRules: vi.fn(),
    setFeatureFlags: vi.fn(),
  },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('@/hooks/useAdminMe', () => ({
  useAdminMe: () => ({
    data: {
      admin: {
        id: 'a-self',
      },
    },
  }),
}));

describe('AdminSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [] },
        error: null,
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { items: [] },
        error: null,
        isLoading: false,
      });
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('應顯示管理員設定與敏感操作區塊', () => {
    render(<AdminSettingsPage />);
    expect(screen.getByText('admin.settings.heading')).toBeInTheDocument();
    expect(screen.getByText('admin.settings.adminUsers.title')).toBeInTheDocument();
    expect(screen.getByText('admin.settings.alerts.title')).toBeInTheDocument();
    expect(screen.getByText('admin.settings.flags.title')).toBeInTheDocument();
  });
});

