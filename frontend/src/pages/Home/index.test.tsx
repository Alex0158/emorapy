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
      screen.getByText('即使在法庭，我也會保護和呵護你們兩位')
    ).toBeInTheDocument();
    expect(screen.getByText('溫暖、公正、專業的情侶衝突解決平台')).toBeInTheDocument();
  });

  it('應顯示立即開始與了解更多按鈕', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /立即開始/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /了解更多/ })).toBeInTheDocument();
  });

  it('點擊立即開始應導航至 /quick-experience/create', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /立即開始/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('點擊了解更多應導航至 /auth/register', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /了解更多/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register');
  });

  it('應顯示核心功能與使用流程區塊', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('核心功能')).toBeInTheDocument();
    expect(screen.getByText('使用流程')).toBeInTheDocument();
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
