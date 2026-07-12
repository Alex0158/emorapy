/**
 * Register 頁面單元測試
 *
 * 遷移: legacy message API → sonner toast
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();
const mockSendVerificationCode = vi.fn();
const mockVerifyEmail = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ register: mockRegister, isLoading: false }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/services/api/auth', () => ({
  sendVerificationCode: (...args: unknown[]) => mockSendVerificationCode(...args),
  verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
}));
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));
vi.mock('framer-motion', () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

import Register from './index';

function renderPage(initialEntry: string | { pathname: string; state?: unknown } = '/auth/register') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Register />
    </MemoryRouter>
  );
}

async function advanceToStep1() {
  mockSendVerificationCode.mockResolvedValue(undefined);
  renderPage();
  fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
    target: { value: 'test@example.com' },
  });
  fireEvent.click(screen.getByText('auth.register.sendCode'));
  await waitFor(() => {
    expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
  });
}

async function advanceToStep2() {
  mockVerifyEmail.mockResolvedValue(true);
  await advanceToStep1();
  for (let i = 0; i < 6; i++) {
    fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
      target: { value: String(i + 1) },
    });
  }
  fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
  await waitFor(() => {
    expect(
      screen.getByPlaceholderText('auth.register.passwordPlaceholder'),
    ).toBeInTheDocument();
  });
}

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegister.mockReset();
    mockSendVerificationCode.mockReset();
    mockVerifyEmail.mockReset();
  });

  it('Step 0: 應顯示歡迎標題與郵箱表單', () => {
    renderPage();
    expect(screen.getByText('auth.register.welcome')).toBeInTheDocument();
    expect(screen.getByText('auth.register.subtitle')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('auth.register.emailPlaceholder'),
    ).toBeInTheDocument();
    expect(screen.getByText('auth.register.sendCode')).toBeInTheDocument();
  });

  it('應有註冊頁面 role 與 aria-label', () => {
    const { container } = renderPage();
    expect(container.querySelector('[role="region"][aria-label="auth.register.pageLabel"]')).toBeInTheDocument();
  });

  it('Step 0 → 1: sendCode 成功應轉到驗證步驟', async () => {
    await advanceToStep1();
    expect(mockSendVerificationCode).toHaveBeenCalledWith('test@example.com', 'register');
    expect(mockToastSuccess).toHaveBeenCalledWith('message.codeSent');
  });

  it('Step 0: sendCode 非標準錯誤應顯示安全 fallback', async () => {
    mockSendVerificationCode.mockRejectedValue(new Error('發送失敗'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.sendCodeFail');
    });
    expect(screen.getByText('auth.register.sendCode')).toBeInTheDocument();
  });

  it('Step 0: sendCode 失敗後應仍可再次點擊發送，成功後應轉到驗證步驟（F09 錯誤恢復：失敗不阻塞重試）', async () => {
    mockSendVerificationCode
      .mockRejectedValueOnce(new Error('暫時無法發送'))
      .mockResolvedValueOnce(undefined);
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.sendCodeFail');
    });
    await waitFor(() => {
      expect(screen.getByText('auth.register.sendCode')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(mockSendVerificationCode).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.codeSent');
    });
    expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
  });

  it('Step 0: sendCode 失敗時應仍可點擊登入並導向 /auth/login（F09 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockSendVerificationCode.mockRejectedValue(new Error('發送失敗'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.sendCodeFail');
    });
    const loginBtn = screen.getByText('auth.register.loginNow');
    expect(loginBtn).toBeInTheDocument();
    fireEvent.click(loginBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/profile/pairing' } } });
  });

  it('Step 0: sendCode 失敗且無 message 時應使用 sendCodeFail', async () => {
    mockSendVerificationCode.mockRejectedValue({ code: 'UNKNOWN' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.sendCodeFail');
    });
  });

  it('Step 0: sendCode SERVER_ERROR 且 message 為空字串時應使用 serverError catalog（F10 邊界）', async () => {
    mockSendVerificationCode.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.serverError');
    });
  });

  it('Step 0: sendCode FORBIDDEN 且無 message 時應使用 forbidden catalog（F09 權限邊界）', async () => {
    mockSendVerificationCode.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.forbidden');
    });
  });

  it('Step 0: sendCode 快速連點只會送出一次請求', async () => {
    let resolveSend: (v: unknown) => void;
    mockSendVerificationCode.mockImplementation(
      () => new Promise((resolve) => { resolveSend = resolve; })
    );
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    const sendBtn = screen.getByText('auth.register.sendCode');
    fireEvent.click(sendBtn);
    fireEvent.click(sendBtn);
    fireEvent.click(sendBtn);
    await waitFor(() => {
      expect(mockSendVerificationCode).toHaveBeenCalledTimes(1);
    });
    resolveSend!(undefined);
    await waitFor(() => {
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });
  });

  it('Step 1 → 2: verifyEmail 成功應轉到密碼步驟', async () => {
    await advanceToStep2();
    expect(mockVerifyEmail).toHaveBeenCalledWith('test@example.com', '123456', 'register');
    expect(mockToastSuccess).toHaveBeenCalledWith('message.verifySuccess');
  });

  it('Step 1: verifyEmail 返回 false 應顯示錯誤', async () => {
    mockVerifyEmail.mockResolvedValue(false);
    await advanceToStep1();
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.codeError');
    });
  });

  it('Step 1: verifyEmail 拋錯且無 message 時應使用 verifyFail', async () => {
    mockVerifyEmail.mockRejectedValue({ code: 'UNKNOWN' });
    await advanceToStep1();
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.verifyFail');
    });
  });

  it('Step 1: verifyEmail SERVER_ERROR 且 message 為空字串時應使用 serverError catalog（F10 邊界）', async () => {
    mockVerifyEmail.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    await advanceToStep1();
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.serverError');
    });
  });

  it('Step 1: verifyEmail FORBIDDEN 時應使用 forbidden catalog（F09 權限邊界）', async () => {
    mockVerifyEmail.mockRejectedValue({ code: 'FORBIDDEN', message: '驗證碼已過期' });
    await advanceToStep1();
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.forbidden');
    });
  });

  it('Step 1: verifyEmail FORBIDDEN 且無 message 時應使用 forbidden catalog（F09 權限邊界）', async () => {
    mockVerifyEmail.mockRejectedValue({ code: 'FORBIDDEN' });
    await advanceToStep1();
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.forbidden');
    });
  });

  it('Step 1: verifyEmail 失敗後應仍可再次點擊驗證，成功後應轉到密碼步驟（F09 錯誤恢復：失敗不阻塞重試）', async () => {
    mockVerifyEmail
      .mockRejectedValueOnce(new Error('驗證服務暫時不可用'))
      .mockResolvedValueOnce(true);
    await advanceToStep1();
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.verifyFail');
    });
    await waitFor(() => {
      expect(screen.getByText('auth.register.verifyAndContinue')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.verifySuccess');
    });
    expect(screen.getByPlaceholderText('auth.register.passwordPlaceholder')).toBeInTheDocument();
  });

  it('Step 1: verifyEmail 失敗時應仍可點擊登入並導向 /auth/login（F09 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('驗證碼無效'));
    await advanceToStep1();
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    const loginBtn = screen.getByText('auth.register.loginNow');
    expect(loginBtn).toBeInTheDocument();
    fireEvent.click(loginBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/profile/pairing' } } });
  });

  it('register 成功但組件已卸載時不應呼叫 toast.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockSendVerificationCode.mockResolvedValue(undefined);
    mockVerifyEmail.mockResolvedValue(true);
    let resolveRegister: () => void;
    mockRegister.mockImplementation(
      () => new Promise<void>((resolve) => { resolveRegister = resolve; })
    );
    const { unmount } = renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('auth.register.passwordPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@example.com', 'Password123', undefined);
    });
    mockToastSuccess.mockClear();
    mockNavigate.mockClear();
    unmount();
    resolveRegister!();
    await Promise.resolve();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('register 失敗但組件已卸載時不應呼叫 toast.error（useMountedRef 回歸：避免卸載後誤提示）', async () => {
    mockSendVerificationCode.mockResolvedValue(undefined);
    mockVerifyEmail.mockResolvedValue(true);
    let rejectRegister: (reason?: unknown) => void;
    mockRegister.mockImplementation(
      () => new Promise((_, reject) => { rejectRegister = reject; })
    );
    const { unmount } = renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('auth.register.passwordPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
    unmount();
    await act(async () => {
      rejectRegister!(new Error('註冊失敗'));
      await Promise.resolve();
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('Step 2: register 成功應導航至 /profile/pairing', async () => {
    mockRegister.mockResolvedValue(undefined);
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@example.com', 'Password123', undefined);
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('message.registerSuccess');
    expect(mockNavigate).toHaveBeenCalledWith('/profile/pairing', { replace: true });
  });

  it('Step 2: 有合法 from 時 register 成功應回跳到原頁（F01/F09 升格閉環）', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderPage({ pathname: '/auth/register', state: { from: { pathname: '/quick-experience/result/case-1' } } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });

    mockVerifyEmail.mockResolvedValue(true);
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('auth.register.passwordPlaceholder')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/case-1', { replace: true });
    });
  });

  it('Step 2: 有合法 chat from 時 register 成功應回跳聊天室弱入口（F07 弱入口回跳）', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderPage({ pathname: '/auth/register', state: { from: { pathname: '/chat/room/room-1' } } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });
    mockVerifyEmail.mockResolvedValue(true);
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('auth.register.passwordPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/chat/room/room-1', { replace: true });
    });
  });

  it('Step 2: from 為無效路徑時 register 成功仍應導航至 /profile/pairing', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderPage({ pathname: '/auth/register', state: { from: { pathname: '/admin/users' } } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });

    mockVerifyEmail.mockResolvedValue(true);
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.register.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('auth.register.passwordPlaceholder')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile/pairing', { replace: true });
    });
  });

  it('Step 2: register 非標準錯誤應顯示安全 fallback', async () => {
    mockRegister.mockRejectedValue(new Error('註冊失敗'));
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.registerFail');
    });
  });

  it('Step 2: register 失敗後應仍可再次點擊註冊，成功後應導航（F09 錯誤恢復：失敗不阻塞重試）', async () => {
    mockRegister
      .mockRejectedValueOnce(new Error('暫時無法註冊'))
      .mockResolvedValueOnce(undefined);
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('auth.register.finishRegister')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.registerSuccess');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/profile/pairing', { replace: true });
  });

  it('Step 2: register 失敗時應仍可點擊登入並導向 /auth/login（F09 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockRegister.mockRejectedValue(new Error('註冊失敗'));
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    const loginBtn = screen.getByText('auth.register.loginNow');
    expect(loginBtn).toBeInTheDocument();
    fireEvent.click(loginBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/profile/pairing' } } });
  });

  it('Step 2: register 失敗且無 message 時應使用 registerFail', async () => {
    mockRegister.mockRejectedValue({ code: 'UNKNOWN' });
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.registerFail');
    });
  });

  it('Step 2: register 失敗且 message 為空字串時應使用 registerFail（F10 邊界）', async () => {
    mockRegister.mockRejectedValue({ code: 'UNKNOWN', message: '' });
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.registerFail');
    });
  });

  it('Step 2: register FORBIDDEN 時應使用 forbidden catalog（F09 權限邊界）', async () => {
    mockRegister.mockRejectedValue({ code: 'FORBIDDEN', message: '此郵箱已被註冊' });
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.forbidden');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/profile/pairing');
  });

  it('Step 2: register FORBIDDEN 且無 message 時應使用 forbidden catalog（F09 權限邊界）', async () => {
    mockRegister.mockRejectedValue({ code: 'FORBIDDEN' });
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByText('auth.register.finishRegister'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.forbidden');
    });
  });

  it('Step 2: 註冊快速連點只會送出一次 register 請求', async () => {
    let resolveRegister: (v: unknown) => void;
    mockRegister.mockImplementation(() => new Promise((resolve) => { resolveRegister = resolve; }));
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPlaceholder'), {
      target: { value: 'Password123' },
    });
    const finishBtn = screen.getByText('auth.register.finishRegister');
    fireEvent.click(finishBtn);
    fireEvent.click(finishBtn);
    fireEvent.click(finishBtn);
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });
    resolveRegister!(undefined);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile/pairing', { replace: true });
    });
  });

  it('登入連結應導航至 /auth/login', () => {
    renderPage();
    fireEvent.click(screen.getByText('auth.register.loginNow'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/profile/pairing' } } });
  });

  it('登入連結應帶著合法來源導航至 /auth/login', () => {
    renderPage({ pathname: '/auth/register', state: { from: { pathname: '/judgment/123' } } });
    fireEvent.click(screen.getByText('auth.register.loginNow'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/judgment/123' } } });
  });

  it('登入連結應帶著合法 chat 來源導航至 /auth/login', () => {
    renderPage({ pathname: '/auth/register', state: { from: { pathname: '/chat/room/room-1' } } });
    fireEvent.click(screen.getByText('auth.register.loginNow'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/chat/room/room-1' } } });
  });
});
