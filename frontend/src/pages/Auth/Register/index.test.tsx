/**
 * Register 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();
const mockSendVerificationCode = vi.fn();
const mockVerifyEmail = vi.fn();
const mockMessageSuccess = vi.fn();
const mockMessageError = vi.fn();
const mockMessageWarning = vi.fn();

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ register: mockRegister, isLoading: false }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/BearJudge', () => ({ default: () => <div data-testid="bear-judge" /> }));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/services/api/auth', () => ({
  sendVerificationCode: (...args: unknown[]) => mockSendVerificationCode(...args),
  verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
}));
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

import Register from './index';

function renderPage() {
  return render(
    <MemoryRouter>
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
    expect(screen.getByText('auth.register.setPassword')).toBeInTheDocument();
  });
}

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Step 0: 應顯示歡迎標題與郵箱表單', () => {
    renderPage();
    expect(screen.getByText('auth.register.welcome')).toBeInTheDocument();
    expect(screen.getByText('auth.register.subtitle')).toBeInTheDocument();
    expect(screen.getByText('auth.register.email')).toBeInTheDocument();
    expect(screen.getByText('auth.register.sendCode')).toBeInTheDocument();
  });

  it('應有註冊頁面 role 與 aria-label', () => {
    const { container } = renderPage();
    expect(container.querySelector('[role="main"][aria-label="auth.register.pageLabel"]')).toBeInTheDocument();
  });

  it('Step 0 → 1: sendCode 成功應轉到驗證步驟', async () => {
    await advanceToStep1();
    expect(mockSendVerificationCode).toHaveBeenCalledWith('test@example.com', 'register');
    expect(mockMessageSuccess).toHaveBeenCalledWith('message.codeSent');
  });

  it('Step 0: sendCode 失敗應顯示錯誤訊息', async () => {
    mockSendVerificationCode.mockRejectedValue(new Error('發送失敗'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.register.sendCode'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('發送失敗');
    });
    expect(screen.getByText('auth.register.sendCode')).toBeInTheDocument();
  });

  it('Step 1 → 2: verifyEmail 成功應轉到密碼步驟', async () => {
    await advanceToStep2();
    expect(mockVerifyEmail).toHaveBeenCalledWith('test@example.com', '123456', 'register');
    expect(mockMessageSuccess).toHaveBeenCalledWith('message.verifySuccess');
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
      expect(mockMessageError).toHaveBeenCalledWith('message.codeError');
    });
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
    expect(mockMessageSuccess).toHaveBeenCalledWith('message.registerSuccess');
    expect(mockNavigate).toHaveBeenCalledWith('/profile/pairing', { replace: true });
  });

  it('Step 2: register 失敗應顯示錯誤', async () => {
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
      expect(mockMessageError).toHaveBeenCalledWith('註冊失敗');
    });
  });

  it('登入連結應導航至 /auth/login', () => {
    renderPage();
    fireEvent.click(screen.getByText('auth.register.loginNow'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
  });
});
