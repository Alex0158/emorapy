/**
 * Home 頁面單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

vi.mock('./components/AdaptiveDashboard', () => ({
  default: () => <div data-testid="adaptive-dashboard">AdaptiveDashboard</div>,
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
      screen.getByText('吵到聽不見彼此時，我們先幫你聽懂。')
    ).toBeInTheDocument();
    expect(screen.getByText('先不要急著分誰對誰錯。Emorapy 會把兩邊真正想說的話整理出來，讓你們看見這次到底卡在哪。')).toBeInTheDocument();
  });

  it('應顯示快速判斷與保存紀錄按鈕', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('button', { name: /開始快速判斷/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /註冊保留完整紀錄/ })).toBeInTheDocument();
  });

  it('點擊快速判斷應導航至 /quick-experience/create', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    const quickStartButtons = screen.getAllByRole('button', { name: /開始快速判斷/ });
    await userEvent.click(quickStartButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('點擊保存紀錄按鈕應導航至 /auth/register', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /註冊保留完整紀錄/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register');
  });

  it('應顯示三段式梳理輸出與清楚的產品邊界', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('把混亂拆成三件可看懂的事')).toBeInTheDocument();
    expect(screen.getByText('事件與感受')).toBeInTheDocument();
    expect(screen.getByText('彼此的落差')).toBeInTheDocument();
    expect(screen.getByText('下一個可行動作')).toBeInTheDocument();
    expect(screen.getByText('使用前先知道')).toBeInTheDocument();
    expect(screen.queryByText('碗盤又放在水槽了')).not.toBeInTheDocument();
  });

  it('應顯示跳過到主要內容連結', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('跳過到主要內容')).toBeInTheDocument();
  });

  it('en-US 下應顯示英文版 Guided Reflection 內容', () => {
    setLocale('en-US');
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('Turn the noise into three things you can inspect')).toBeInTheDocument();
    expect(screen.getByText('Know the scope before you begin')).toBeInTheDocument();
    expect(screen.queryByText('把混亂拆成三件可看懂的事')).not.toBeInTheDocument();
  });

  it('已登入時應顯示自適應儀表板，不重複顯示公開首頁 CTA', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByTestId('adaptive-dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /開始快速判斷/ })).not.toBeInTheDocument();
  });
});
