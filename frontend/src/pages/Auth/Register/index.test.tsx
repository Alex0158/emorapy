/**
 * Register 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './index';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ register: mockRegister, isLoading: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/common/PublicRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/BearJudge', () => ({ default: () => <div data-testid="bear-judge" /> }));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  };
});

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應顯示加入關係修復室與開始你們的修復之旅', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    expect(screen.getByText('加入關係修復室')).toBeInTheDocument();
    expect(screen.getByText('開始你們的修復之旅')).toBeInTheDocument();
  });

  it('應有郵箱輸入框', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    const emailInput = screen.getByLabelText(/郵箱|邮箱|Email/i);
    expect(emailInput).toBeInTheDocument();
  });

  it('應有發送驗證碼或下一步按鈕', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    const submitBtn = screen.getByRole('button', { name: /發送驗證碼|下一步|註冊|注册/i });
    expect(submitBtn).toBeInTheDocument();
  });

  it('應有註冊頁面 role 與 aria-label', () => {
    const { container } = render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    const main = container.querySelector('[role="main"][aria-label="註冊頁面"]');
    expect(main).toBeInTheDocument();
  });
});
