import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminLoginPage from './index';

const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn();
const mockMessageSuccess = vi.fn();
const mockMessageError = vi.fn();
const mockUseAdminToken = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/useAdminSession', () => ({
  useAdminSession: () => ({
    loginMutation: {
      mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
      isPending: false,
    },
  }),
}));

vi.mock('@/hooks/useAdminToken', () => ({
  useAdminToken: () => mockUseAdminToken(),
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      error: (...args: unknown[]) => mockMessageError(...args),
    },
  };
});

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminToken.mockReturnValue('');
  });

  it('應顯示管理員登入表單', () => {
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );
    expect(screen.getByText('admin.login.heading')).toBeInTheDocument();
    expect(screen.getByText('admin.login.email')).toBeInTheDocument();
    expect(screen.getByText('admin.login.password')).toBeInTheDocument();
  });

  it('登入成功應導向 admin ops 首頁', async () => {
    mockMutateAsync.mockResolvedValue({});
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('admin.login.email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('admin.login.password'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('admin.login.submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'Password123',
      });
    });
    expect(mockMessageSuccess).toHaveBeenCalledWith('admin.login.success');
    expect(mockNavigate).toHaveBeenCalledWith('/admin/ops/jobs', { replace: true });
  });
});
