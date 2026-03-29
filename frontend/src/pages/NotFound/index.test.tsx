/**
 * NotFound 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setLocale } from '@/utils/i18n';
import NotFound from './index';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('NotFound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('zh-TW');
  });

  it('應顯示 404 與說明文字', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('抱歉，您訪問的頁面不存在。')).toBeInTheDocument();
  });

  it('點擊返回首頁應調用 navigate("/")', async () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const btn = screen.getByRole('button', { name: /返回首頁/ });
    await userEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('點擊返回上一頁應調用 navigate(-1)', async () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const btn = screen.getByRole('button', { name: /返回上一頁/ });
    await userEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('點擊前往快速體驗應調用 navigate("/quick-experience/create")', async () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const btn = screen.getByRole('button', { name: /前往快速體驗/ });
    await userEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });
});
