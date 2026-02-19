/**
 * Login 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './index';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ login: mockLogin, isLoading: false }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
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

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應顯示歡迎回來與登錄以繼續', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText('歡迎回來')).toBeInTheDocument();
    expect(screen.getByText('登錄以繼續')).toBeInTheDocument();
  });

  it('應有郵箱與密碼輸入框', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/郵箱|邮箱|Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/密碼|密码|Password/i)).toBeInTheDocument();
  });

  it('應有登錄按鈕', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /登\s*錄|登录/ })).toBeInTheDocument();
  });

  it('應有登錄頁面 role 與 aria-label', () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const main = container.querySelector('[role="main"][aria-label="登錄頁面"]');
    expect(main).toBeInTheDocument();
  });
});
