/**
 * ForgotPassword 頁面單元測試
 *
 * 遷移: legacy message API → sonner toast
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockResetPassword = vi.fn();
const mockConfirmResetPassword = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();
const setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation(
  (() => 1 as unknown as ReturnType<typeof setInterval>) as typeof setInterval
);
const clearIntervalSpy = vi.spyOn(global, 'clearInterval').mockImplementation(
  (() => undefined) as typeof clearInterval
);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/services/api/auth', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  confirmResetPassword: (...args: unknown[]) => mockConfirmResetPassword(...args),
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

import ForgotPassword from './index';

function renderPage(initialEntry: string | { pathname: string; state?: unknown } = '/auth/forgot-password') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ForgotPassword />
    </MemoryRouter>
  );
}

async function advanceToStep1() {
  mockResetPassword.mockResolvedValue(undefined);
  renderPage();
  fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
    target: { value: 'test@example.com' },
  });
  fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
  await waitFor(() => {
    expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
  });
}

async function advanceToStep2() {
  await advanceToStep1();
  for (let i = 0; i < 6; i++) {
    fireEvent.change(screen.getByLabelText(`auth.forgot.stepVerify ${i + 1}`), {
      target: { value: String(i + 1) },
    });
  }
  fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
  await waitFor(() => {
    expect(
      screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'),
    ).toBeInTheDocument();
  });
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('Step 0: 應顯示忘記密碼標題與郵箱表單', () => {
    renderPage();
    expect(screen.getByText('auth.forgot.heading')).toBeInTheDocument();
    expect(screen.getByText('auth.forgot.subtitle')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('auth.forgot.emailPlaceholder'),
    ).toBeInTheDocument();
    expect(screen.getByText('auth.forgot.sendResetEmail')).toBeInTheDocument();
  });

  it('應有忘記密碼頁面 role 與 aria-label', () => {
    const { container } = renderPage();
    expect(container.querySelector('[role="main"][aria-label="auth.forgot.pageLabel"]')).toBeInTheDocument();
  });

  it('Step 0 → 1: sendResetEmail 成功應轉到驗證步驟', async () => {
    await advanceToStep1();
    expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
    expect(mockToastSuccess).toHaveBeenCalledWith('message.resetEmailSent');
  });

  it('Step 0: sendResetEmail 失敗應顯示錯誤', async () => {
    mockResetPassword.mockRejectedValue(new Error('發送失敗'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('發送失敗');
    });
    expect(screen.getByText('auth.forgot.sendResetEmail')).toBeInTheDocument();
  });

  it('Step 0: sendResetEmail 失敗後應仍可再次點擊發送，成功後應轉到驗證步驟（F09 錯誤恢復：失敗不阻塞重試）', async () => {
    mockResetPassword
      .mockRejectedValueOnce(new Error('暫時無法發送'))
      .mockResolvedValueOnce(undefined);
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('暫時無法發送');
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.resetEmailSent');
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });
  });

  it('Step 0: sendResetEmail 失敗時應仍可點擊返回登入並導向 /auth/login（F09 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockResetPassword.mockRejectedValue(new Error('發送失敗'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('發送失敗');
    });
    const backBtn = screen.getByText('auth.forgot.backToLogin');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/case/list' } } });
  });

  it('Step 0: sendResetEmail 失敗且無 message 時應使用 sendResetFail', async () => {
    mockResetPassword.mockRejectedValue({ code: 'UNKNOWN' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.sendResetFail');
    });
  });

  it('Step 0: sendResetEmail 失敗且 message 為空字串時應使用 sendResetFail（F10 邊界：空 message 視為無）', async () => {
    mockResetPassword.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.sendResetFail');
    });
  });

  it('Step 0: sendResetEmail FORBIDDEN 時若有 message 應顯示該 message（F09 權限邊界）', async () => {
    mockResetPassword.mockRejectedValue({ code: 'FORBIDDEN', message: '此郵箱無法接收重置信件' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('此郵箱無法接收重置信件');
    });
  });

  it('Step 0: sendResetEmail FORBIDDEN 且無 message 時應使用 sendResetFail（F09 權限邊界 fallback）', async () => {
    mockResetPassword.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.sendResetFail');
    });
  });

  it('Step 0: sendResetEmail 快速連點只會送出一次請求', async () => {
    let resolveReset: (v: unknown) => void;
    mockResetPassword.mockImplementation(() => new Promise((resolve) => { resolveReset = resolve; }));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    const sendBtn = screen.getByText('auth.forgot.sendResetEmail');
    fireEvent.click(sendBtn);
    fireEvent.click(sendBtn);
    fireEvent.click(sendBtn);
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledTimes(1);
    });
    resolveReset!(undefined);
    await waitFor(() => {
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });
  });

  it('Step 1 → 2: 填寫驗證碼後應轉到密碼步驟', async () => {
    await advanceToStep2();
    expect(
      screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'),
    ).toBeInTheDocument();
    expect(screen.getByText('auth.forgot.resetButton')).toBeInTheDocument();
  });

  it('confirmResetPassword 成功但組件已卸載時不應呼叫 toast.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockResetPassword.mockResolvedValue(undefined);
    let resolveConfirm: () => void;
    mockConfirmResetPassword.mockImplementation(
      () => new Promise<void>((resolve) => { resolveConfirm = resolve; })
    );
    const { unmount } = renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.forgot.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockConfirmResetPassword).toHaveBeenCalledWith('test@example.com', '123456', 'NewPassword123');
    });
    mockToastSuccess.mockClear();
    mockNavigate.mockClear();
    unmount();
    resolveConfirm!();
    await Promise.resolve();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('Step 2: 重設密碼成功應顯示成功頁面', async () => {
    mockConfirmResetPassword.mockResolvedValue(undefined);
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockConfirmResetPassword).toHaveBeenCalledWith('test@example.com', '123456', 'NewPassword123');
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('message.resetSuccess');
    expect(screen.getByText('auth.forgot.successTitle')).toBeInTheDocument();
    expect(screen.getByText('auth.forgot.redirecting')).toBeInTheDocument();
  });

  it('Step 2: 重設密碼成功後自動返回登入時應保留合法來源（跨入口回跳）', async () => {
    let resolveConfirm: () => void;
    mockConfirmResetPassword.mockImplementation(
      () => new Promise<void>((resolve) => { resolveConfirm = resolve; })
    );
    renderPage({ pathname: '/auth/forgot-password', state: { from: { pathname: '/judgment/123' } } });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(screen.getByText('auth.register.codeSentTo')).toBeInTheDocument();
    });
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByLabelText(`auth.forgot.stepVerify ${i + 1}`), {
        target: { value: String(i + 1) },
      });
    }
    fireEvent.click(screen.getByText('auth.register.verifyAndContinue'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockConfirmResetPassword).toHaveBeenCalledWith('test@example.com', '123456', 'NewPassword123');
    });

    let timeoutCallback: TimerHandler | undefined;
    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((callback: TimerHandler) => {
        timeoutCallback = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    try {
      resolveConfirm!();
      await Promise.resolve();
      await Promise.resolve();
      expect(timeoutCallback).toBeTruthy();
      if (typeof timeoutCallback === 'function') {
        timeoutCallback();
      }
      expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/judgment/123' } } });
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('Step 2: 重設密碼失敗應顯示錯誤', async () => {
    mockConfirmResetPassword.mockRejectedValue(new Error('重設失敗'));
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('重設失敗');
    });
  });

  it('Step 2: 重設密碼失敗且無 message 時應使用 resetFail', async () => {
    mockConfirmResetPassword.mockRejectedValue({ code: 'UNKNOWN' });
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.resetFail');
    });
  });

  it('Step 2: 重設密碼失敗且 message 為空字串時應使用 resetFail（F10 邊界：空 message 視為無）', async () => {
    mockConfirmResetPassword.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.resetFail');
    });
  });

  it('Step 2: confirmResetPassword FORBIDDEN 時若有 message 應顯示該 message（F09 權限邊界）', async () => {
    mockConfirmResetPassword.mockRejectedValue({ code: 'FORBIDDEN', message: '驗證碼已過期' });
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('驗證碼已過期');
    });
  });

  it('Step 2: confirmResetPassword FORBIDDEN 且無 message 時應使用 resetFail（F09 權限邊界 fallback）', async () => {
    mockConfirmResetPassword.mockRejectedValue({ code: 'FORBIDDEN' });
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.resetFail');
    });
  });

  it('Step 2: confirmResetPassword 失敗時應仍可點擊返回登入並導向 /auth/login（F09 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockConfirmResetPassword.mockRejectedValue(new Error('驗證碼無效'));
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    const backBtn = screen.getByText('auth.forgot.backToLogin');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/case/list' } } });
  });

  it('Step 2: confirmResetPassword 失敗後應仍可再次點擊確認，成功後應顯示成功畫面（F09 錯誤恢復：失敗不阻塞重試）', async () => {
    mockConfirmResetPassword
      .mockRejectedValueOnce(new Error('網路暫時不可用'))
      .mockResolvedValueOnce(undefined);
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('網路暫時不可用');
    });
    fireEvent.click(screen.getByText('auth.forgot.resetButton'));
    await waitFor(() => {
      expect(mockConfirmResetPassword).toHaveBeenCalledTimes(2);
      expect(screen.getByText('auth.forgot.successTitle')).toBeInTheDocument();
    });
  });

  it('Step 2: confirmResetPassword 快速連點只會送出一次請求', async () => {
    let resolveConfirm: (v: unknown) => void;
    mockConfirmResetPassword.mockImplementation(() => new Promise((resolve) => { resolveConfirm = resolve; }));
    await advanceToStep2();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.newPasswordPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.confirmNewPlaceholder'), {
      target: { value: 'NewPassword123' },
    });
    const resetBtn = screen.getByText('auth.forgot.resetButton');
    fireEvent.click(resetBtn);
    fireEvent.click(resetBtn);
    fireEvent.click(resetBtn);
    await waitFor(() => {
      expect(mockConfirmResetPassword).toHaveBeenCalledTimes(1);
    });
    resolveConfirm!(undefined);
    await waitFor(() => {
      expect(screen.getByText('auth.forgot.successTitle')).toBeInTheDocument();
    });
  });

  it('返回登入連結應導航至 /auth/login', () => {
    renderPage();
    fireEvent.click(screen.getByText('auth.forgot.backToLogin'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/case/list' } } });
  });

  it('返回登入連結應帶著合法來源導航至 /auth/login', () => {
    renderPage({ pathname: '/auth/forgot-password', state: { from: { pathname: '/quick-experience/result/case-1' } } });
    fireEvent.click(screen.getByText('auth.forgot.backToLogin'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { state: { from: { pathname: '/quick-experience/result/case-1' } } });
  });
});
