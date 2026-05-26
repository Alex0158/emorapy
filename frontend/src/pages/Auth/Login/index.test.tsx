/**
 * Login 頁面單元測試
 *
 * 遷移: legacy message API → sonner toast
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();

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

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

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
    expect(screen.getByPlaceholderText('auth.login.email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('auth.login.password')).toBeInTheDocument();
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

  it('登入成功但組件已卸載時不應呼叫 toast.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveLogin: () => void;
    mockLogin.mockImplementation(
      () => new Promise<void>((resolve) => { resolveLogin = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const emailInput = screen.getByPlaceholderText('auth.login.email');
    const passwordInput = screen.getByPlaceholderText('auth.login.password');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', false);
    });
    unmount();
    resolveLogin!();
    await Promise.resolve();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('登入失敗且組件已卸載時不應呼叫 toast.error 或 warning（useMountedRef 回歸：避免卸載後誤提示）', async () => {
    let rejectLogin: (reason?: unknown) => void;
    mockLogin.mockImplementation(
      () => new Promise((_, reject) => { rejectLogin = reject; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const emailInput = screen.getByPlaceholderText('auth.login.email');
    const passwordInput = screen.getByPlaceholderText('auth.login.password');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', false);
    });
    unmount();
    rejectLogin!({ message: '帳號或密碼錯誤' });
    await Promise.resolve();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  it('登入成功應顯示成功訊息並導航', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const emailInput = screen.getByPlaceholderText('auth.login.email');
    const passwordInput = screen.getByPlaceholderText('auth.login.password');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', false);
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('message.loginSuccess');
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
    const emailInput = screen.getByPlaceholderText('auth.login.email');
    const passwordInput = screen.getByPlaceholderText('auth.login.password');
    fireEvent.change(emailInput, { target: { value: 'bad@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('帳號或密碼錯誤');
    });
  });

  it('登入失敗後應仍可再次點擊登入，成功後應導航（F09 錯誤恢復：失敗不阻塞重試）', async () => {
    mockLogin
      .mockRejectedValueOnce(new Error('網路暫時不穩'))
      .mockResolvedValueOnce(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('auth.login.submit')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.loginSuccess');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/case/list', { replace: true });
  });

  it('登入失敗時應仍可點擊註冊並導向 /auth/register（F09 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockLogin.mockRejectedValue({ message: '帳號或密碼錯誤' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('帳號或密碼錯誤');
    });
    const registerBtn = screen.getByText('auth.login.registerNow');
    expect(registerBtn).toBeInTheDocument();
    fireEvent.click(registerBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register', { state: { from: { pathname: '/case/list' } } });
  });

  it('登入失敗時應仍可點擊忘記密碼並導向 /auth/forgot-password（F09 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockLogin.mockRejectedValue({ message: '帳號或密碼錯誤' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('帳號或密碼錯誤');
    });
    const forgotBtn = screen.getByText('auth.login.forgotPassword');
    expect(forgotBtn).toBeInTheDocument();
    fireEvent.click(forgotBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/forgot-password', { state: { from: { pathname: '/case/list' } } });
  });

  it('登入失敗且無 message 時應使用 loginFail', async () => {
    mockLogin.mockRejectedValue({ code: 'UNAUTHORIZED' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'p' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.loginFail');
    });
  });

  it('登入失敗且 message 為空字串時應使用 loginFail（F10 邊界：空 message 視為無）', async () => {
    mockLogin.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'p' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.loginFail');
    });
  });

  it('登入 FORBIDDEN 時若有 message 應顯示該 message（F09 權限邊界）', async () => {
    mockLogin.mockRejectedValue({ code: 'FORBIDDEN', message: '此帳號已被停權' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('此帳號已被停權');
    });
  });

  it('登入 FORBIDDEN 且無 message 時應使用 loginFail（F09 權限邊界 fallback）', async () => {
    mockLogin.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.loginFail');
    });
  });

  it('登入快速連點只會送出一次 login 請求', async () => {
    let resolveLogin: (v: unknown) => void;
    mockLogin.mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    const submitBtn = screen.getByText('auth.login.submit');
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
    resolveLogin!(undefined);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/case/list', { replace: true });
    });
  });

  it('登入成功後應重導到 location.state.from 指定路徑', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/auth/login', state: { from: { pathname: '/judgment/123' } } }]}>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/judgment/123', { replace: true });
    });
  });

  it('登入成功後若 from 為合法 chat 弱入口應導向聊天室（F07 弱入口回跳）', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/auth/login', state: { from: { pathname: '/chat/room/room-1' } } }]}>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/chat/room/room-1', { replace: true });
    });
  });

  it('登入成功後若 from 為無效路徑應導向 /case/list 而非該路徑', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/auth/login', state: { from: { pathname: '/admin/settings' } } }]}>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/case/list', { replace: true });
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
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith('message.emailNotVerified');
    });
    expect(mockSendVerificationCode).toHaveBeenCalledWith('test@example.com', 'verify_email');
  });

  it('EMAIL_NOT_VERIFIED 時若 sendVerificationCode 失敗且無 message 應顯示 resendVerifyFail', async () => {
    const mockSendVerificationCode = vi.fn().mockRejectedValue({ code: 'SERVER_ERROR' });
    const authModule = await import('@/services/api/auth');
    (authModule.sendVerificationCode as ReturnType<typeof vi.fn>).mockImplementation(mockSendVerificationCode);
    mockLogin.mockRejectedValue({ code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith('message.emailNotVerified');
    });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.resendVerifyFail');
    });
  });

  it('EMAIL_NOT_VERIFIED 時若 sendVerificationCode 失敗且 message 為空字串應使用 resendVerifyFail（F10 邊界）', async () => {
    const mockSendVerificationCode = vi.fn().mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    const authModule = await import('@/services/api/auth');
    (authModule.sendVerificationCode as ReturnType<typeof vi.fn>).mockImplementation(mockSendVerificationCode);
    mockLogin.mockRejectedValue({ code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith('message.emailNotVerified');
    });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.resendVerifyFail');
    });
  });

  it('EMAIL_NOT_VERIFIED 時若 sendVerificationCode 失敗且若有 message 應顯示該 message（F09 權限邊界）', async () => {
    const mockSendVerificationCode = vi.fn().mockRejectedValue({ code: 'RATE_LIMIT', message: '已達今日發送上限' });
    const authModule = await import('@/services/api/auth');
    (authModule.sendVerificationCode as ReturnType<typeof vi.fn>).mockImplementation(mockSendVerificationCode);
    mockLogin.mockRejectedValue({ code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith('message.emailNotVerified');
    });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('已達今日發送上限');
    });
  });

  it('EMAIL_NOT_VERIFIED 且 sendVerificationCode 失敗時應仍可點擊註冊並導向 /auth/register（F09 錯誤恢復：雙失敗不阻塞導航出口）', async () => {
    const mockSendVerificationCode = vi.fn().mockRejectedValue(new Error('發送失敗'));
    const authModule = await import('@/services/api/auth');
    (authModule.sendVerificationCode as ReturnType<typeof vi.fn>).mockImplementation(mockSendVerificationCode);
    mockLogin.mockRejectedValue({ code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('auth.login.email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.login.password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('auth.login.submit'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('發送失敗');
    });
    const registerBtn = screen.getByText('auth.login.registerNow');
    expect(registerBtn).toBeInTheDocument();
    fireEvent.click(registerBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register', { state: { from: { pathname: '/case/list' } } });
  });

  it('忘記密碼連結應導航至 /auth/forgot-password', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('auth.login.forgotPassword'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/forgot-password', { state: { from: { pathname: '/case/list' } } });
  });

  it('忘記密碼連結應帶著合法來源導航至 /auth/forgot-password', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/auth/login', state: { from: { pathname: '/judgment/123' } } }]}>
        <Login />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('auth.login.forgotPassword'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/forgot-password', { state: { from: { pathname: '/judgment/123' } } });
  });

  it('忘記密碼連結應帶著合法 chat 來源導航至 /auth/forgot-password', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/auth/login', state: { from: { pathname: '/chat/room/room-1' } } }]}>
        <Login />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('auth.login.forgotPassword'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/forgot-password', { state: { from: { pathname: '/chat/room/room-1' } } });
  });

  it('註冊連結應帶著合法來源導航至 /auth/register', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/auth/login', state: { from: { pathname: '/judgment/123' } } }]}>
        <Login />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('auth.login.registerNow'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register', { state: { from: { pathname: '/judgment/123' } } });
  });
});
