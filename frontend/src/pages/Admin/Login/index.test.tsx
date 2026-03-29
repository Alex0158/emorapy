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

  it('登入失敗且有 message 應顯示該 message（F10 錯誤處理約定）', async () => {
    mockMutateAsync.mockRejectedValue(new Error('帳號或密碼錯誤'));
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('admin.login.email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('admin.login.password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByText('admin.login.submit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('帳號或密碼錯誤');
    });
  });

  it('登入失敗且 message 為空字串時應使用 admin.login.failed（F10 邊界：空 message 視為無）', async () => {
    mockMutateAsync.mockRejectedValue({ code: 'UNAUTHORIZED', message: '' });
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('admin.login.email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('admin.login.password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByText('admin.login.submit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('admin.login.failed');
    });
  });

  it('登入失敗且無 message 應顯示 admin.login.failed', async () => {
    mockMutateAsync.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('admin.login.email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('admin.login.password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByText('admin.login.submit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('admin.login.failed');
    });
  });

  it('登入 FORBIDDEN 且無 message 時應使用 admin.login.failed（F10 權限邊界 fallback）', async () => {
    mockMutateAsync.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('admin.login.email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('admin.login.password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByText('admin.login.submit'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('admin.login.failed');
    });
  });

  it('登入失敗後應仍可再次點擊登入，成功後應導向 admin ops（F10 錯誤恢復：失敗不阻塞重試）', async () => {
    mockMutateAsync
      .mockRejectedValueOnce(new Error('服務暫時不可用'))
      .mockResolvedValueOnce({});
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
      expect(mockMessageError).toHaveBeenCalledWith('服務暫時不可用');
    });
    fireEvent.click(screen.getByText('admin.login.submit'));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(2);
      expect(mockMessageSuccess).toHaveBeenCalledWith('admin.login.success');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/admin/ops/jobs', { replace: true });
  });

  it('登入成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveLogin: (v: unknown) => void;
    mockMutateAsync.mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );
    const { unmount } = render(
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
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    unmount();
    resolveLogin!({});
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
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
