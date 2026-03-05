/**
 * ForgotPassword 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockResetPassword = vi.fn();
const mockConfirmResetPassword = vi.fn();
const mockMessageSuccess = vi.fn();
const mockMessageError = vi.fn();
const mockMessageWarning = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({ default: () => <div data-testid="mediator-avatar" /> }));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/services/api/auth', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  confirmResetPassword: (...args: unknown[]) => mockConfirmResetPassword(...args),
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

import ForgotPassword from './index';

function renderPage() {
  return render(
    <MemoryRouter>
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
    expect(screen.getByText('auth.forgot.newPassword')).toBeInTheDocument();
  });
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Step 0: 應顯示忘記密碼標題與郵箱表單', () => {
    renderPage();
    expect(screen.getByText('auth.forgot.heading')).toBeInTheDocument();
    expect(screen.getByText('auth.forgot.subtitle')).toBeInTheDocument();
    expect(screen.getByText('auth.login.email')).toBeInTheDocument();
    expect(screen.getByText('auth.forgot.sendResetEmail')).toBeInTheDocument();
  });

  it('應有忘記密碼頁面 role 與 aria-label', () => {
    const { container } = renderPage();
    expect(container.querySelector('[role="main"][aria-label="auth.forgot.pageLabel"]')).toBeInTheDocument();
  });

  it('Step 0 → 1: sendResetEmail 成功應轉到驗證步驟', async () => {
    await advanceToStep1();
    expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
    expect(mockMessageSuccess).toHaveBeenCalledWith('message.resetEmailSent');
  });

  it('Step 0: sendResetEmail 失敗應顯示錯誤', async () => {
    mockResetPassword.mockRejectedValue(new Error('發送失敗'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('auth.forgot.emailPlaceholder'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('auth.forgot.sendResetEmail'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('發送失敗');
    });
    expect(screen.getByText('auth.forgot.sendResetEmail')).toBeInTheDocument();
  });

  it('Step 1 → 2: 填寫驗證碼後應轉到密碼步驟', async () => {
    await advanceToStep2();
    expect(screen.getByText('auth.forgot.newPassword')).toBeInTheDocument();
    expect(screen.getByText('auth.forgot.resetButton')).toBeInTheDocument();
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
    expect(mockMessageSuccess).toHaveBeenCalledWith('message.resetSuccess');
    expect(screen.getByText('auth.forgot.successTitle')).toBeInTheDocument();
    expect(screen.getByText('auth.forgot.redirecting')).toBeInTheDocument();
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
      expect(mockMessageError).toHaveBeenCalledWith('重設失敗');
    });
  });

  it('返回登入連結應導航至 /auth/login', () => {
    renderPage();
    fireEvent.click(screen.getByText('auth.forgot.backToLogin'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
  });
});
