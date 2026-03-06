/**
 * Home 頁面單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from './index';
import { setLocale } from '@/utils/i18n';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/common/SEO', () => ({
  default: () => null,
}));

vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/business/MediatorAvatar', () => ({
  default: () => <div data-testid="mediator-avatar">MediatorAvatar</div>,
}));
const mockUseAuthStore = vi.fn();
vi.mock('@/store/authStore', () => ({
  useAuthStore: (...args: unknown[]) => mockUseAuthStore(...args),
}));

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('zh-TW');
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false });
  });

  it('應顯示 Hero 標題', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(
      screen.getByText('把衝突變成可解的問題')
    ).toBeInTheDocument();
    expect(screen.getByText('中立梳理爭點，提供可執行的修復方案')).toBeInTheDocument();
  });

  it('應顯示快速體驗與保存紀錄按鈕', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('button', { name: /立即開始快速體驗/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /註冊保存完整紀錄/ })).toBeInTheDocument();
  });

  it('點擊立即開始應導航至 /quick-experience/create', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    const quickStartButtons = screen.getAllByRole('button', { name: /立即開始快速體驗/ });
    await userEvent.click(quickStartButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('點擊保存紀錄按鈕應導航至 /auth/register', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /註冊保存完整紀錄/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register');
  });

  it('應顯示價值與流程區塊', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('模擬實際使用流程')).toBeInTheDocument();
    expect(screen.getByText('發起溝通')).toBeInTheDocument();
    expect(screen.getByText('雙向聆聽')).toBeInTheDocument();
    expect(screen.getByText('心理師分析')).toBeInTheDocument();
    expect(screen.getByText('個別開解')).toBeInTheDocument();
  });

  it('應顯示跳過到主要內容連結', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('跳過到主要內容')).toBeInTheDocument();
  });

  it('en-US 下應顯示英文版流程模擬器', async () => {
    setLocale('en-US');
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('See the Flow in Action')).toBeInTheDocument();
    });
    expect(screen.queryByText('模擬實際使用流程')).not.toBeInTheDocument();
  });

  it('已登入時主按鈕應導航至 /case/create 且不顯示協同模式按鈕', async () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    const buttons = screen.getAllByRole('button');
    const primaryBtn = buttons.find(btn => btn.getAttribute('aria-label')?.includes('建立'));
    expect(primaryBtn).toBeDefined();
    if (primaryBtn) {
      await userEvent.click(primaryBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/case/create');
    }
  });
});
