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

  it('應顯示價值與聆聽展示區塊', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('拖一下時間線，看 Emorapy 怎麼聽出話裡沒說完的意思。')).toBeInTheDocument();
    });
    expect(screen.getByText('Emorapy · 聽見 12:14')).toBeInTheDocument();
    expect(screen.getByText('負責，不是認錯。是願意一起把關係修回來。')).toBeInTheDocument();
    expect(screen.getByText('你可以拿到什麼')).toBeInTheDocument();
  });

  it('應顯示跳過到主要內容連結', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('跳過到主要內容')).toBeInTheDocument();
  });

  it('en-US 下應顯示英文版聆聽展示', async () => {
    setLocale('en-US');
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Drag the timeline to see how Emorapy hears what sits underneath.')).toBeInTheDocument();
    });
    expect(screen.queryByText('拖一下時間線，看 Emorapy 怎麼聽出話裡沒說完的意思。')).not.toBeInTheDocument();
  });

  it('已登入時主按鈕應導航至 /case/create 且不顯示協同模式按鈕', async () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    const buttons = screen.getAllByRole('button');
    const primaryBtn = buttons.find(btn => btn.getAttribute('aria-label')?.includes('正式處理'));
    expect(primaryBtn).toBeDefined();
    if (primaryBtn) {
      await userEvent.click(primaryBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/case/create');
    }
  });
});
