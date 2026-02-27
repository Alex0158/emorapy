import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminUsersPage from './index';

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
    listUsers: vi.fn(),
    getUserDetail: vi.fn(),
    updateUserStatus: vi.fn(),
  },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getAllByText('鎖定30分鐘').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('解除鎖定').length).toBeGreaterThanOrEqual(1);
  });
});

