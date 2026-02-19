/**
 * Home 頁面單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from './index';

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

vi.mock('@/components/business/BearJudge', () => ({
  default: () => <div data-testid="bear-judge">BearJudge</div>,
}));

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByText('輸入雙方陳述')).toBeInTheDocument();
    expect(screen.getByText('你會得到的幫助')).toBeInTheDocument();
    expect(screen.getByText('四步走出惡性循環')).toBeInTheDocument();
  });

  it('應顯示跳過到主要內容連結', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('跳過到主要內容')).toBeInTheDocument();
  });
});
