/**
 * Login 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();
const mockMessageSuccess = vi.fn();
const mockMessageError = vi.fn();
const mockMessageWarning = vi.fn();

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ login: mockLogin, isLoading: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({ default: () => <div data-testid="mediator-avatar" /> }));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      error: (...args: unknown[]) => mockMessageError(...args),
      warning: (...args: unknown[]) => mockMessageWarning(...args),
    },
  };
});
vi.mock('@/services/api/auth', () => ({
  sendVerificationCode: vi.fn(),
}));

import Login from './index';

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應顯示歡迎標題與副標題', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText('auth.login.welcome')).toBeInTheDocument();
    expect(screen.getByText('auth.login.subtitle')).toBeInTheDocument();
  });

  it('應有郵箱與密碼輸入框', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText('auth.login.email')).toBeInTheDocument();
    expect(screen.getByText('auth.login.password')).toBeInTheDocument();
  });

  it('應有登錄按鈕', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText('auth.login.submit')).toBeInTheDocument();
  });

  it('應有登錄頁面 role 與 aria-label', () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const main = container.querySelector('[role="main"][aria-label="auth.login.pageLabel"]');
    expect(main).toBeInTheDocument();
  });

  it('登入成功應顯示成功訊息並導航', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const emailInput = screen.getByPlaceholderText('auth.login.emailRequired');
    const passwordInput = screen.getByPlaceholderText('auth.login.passwordRequired');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', false);
    });
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.loginSuccess');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/case/list', { replace: true });
  });

  it('登入失敗應顯示錯誤訊息', async () => {
    mockLogin.mockRejectedValue({ message: '帳號或密碼錯誤' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const emailInput = screen.getByPlaceholderText('auth.login.emailRequired');
    const passwordInput = screen.getByPlaceholderText('auth.login.passwordRequired');
    fireEvent.change(emailInput, { target: { value: 'bad@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('帳號或密碼錯誤');
    });
  });

  it('登入成功後應重導到 location.state.from 指定路徑', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/auth/login', state: { from: { pathname: '/judgment/123' } } }]}>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.emailRequired'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.passwordRequired'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/judgment/123', { replace: true });
    });
  });

  it('EMAIL_NOT_VERIFIED 時應顯示 warning 並嘗試重發驗證碼', async () => {
    const mockSendVerificationCode = vi.fn().mockResolvedValue(undefined);
    const authModule = await import('@/services/api/auth');
    (authModule.sendVerificationCode as ReturnType<typeof vi.fn>).mockImplementation(mockSendVerificationCode);
    mockLogin.mockRejectedValue({ code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.emailRequired'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.passwordRequired'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.emailNotVerified');
    });
    expect(mockSendVerificationCode).toHaveBeenCalledWith('test@example.com', 'verify_email');
  });

  it('忘記密碼連結應導航至 /auth/forgot-password', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('auth.login.forgotPassword'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/forgot-password');
  });

  it('註冊連結應導航至 /auth/register', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('auth.login.registerNow'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register');
  });
});
