/**
 * ErrorFallback 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ErrorFallback from './index';

const mockNavigate = vi.fn();
const mockResetError = vi.fn();
const mockReload = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { reload: mockReload },
    writable: true,
    configurable: true,
  });
  vi.clearAllMocks();
});

describe('ErrorFallback', () => {
  it('應顯示發生錯誤與預設 subTitle', () => {
    render(
      <MemoryRouter>
        <ErrorFallback />
      </MemoryRouter>
    );
    expect(screen.getByText('發生錯誤')).toBeInTheDocument();
    expect(screen.getByText('應用程序出現了問題，請稍後再試。')).toBeInTheDocument();
  });

  it('有 error 時仍應顯示本地化 fallback 而非 error.message', () => {
    render(
      <MemoryRouter>
        <ErrorFallback error={new Error('自定義錯誤')} />
      </MemoryRouter>
    );
    expect(screen.queryByText('自定義錯誤')).not.toBeInTheDocument();
    expect(screen.getByText('應用程序出現了問題，請稍後再試。')).toBeInTheDocument();
  });

  it('點擊返回首頁應調用 navigate 與 resetError', async () => {
    render(
      <MemoryRouter>
        <ErrorFallback resetError={mockResetError} />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /返回首頁/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(mockResetError).toHaveBeenCalled();
  });

  it('點擊重新載入應調用 window.location.reload', async () => {
    render(
      <MemoryRouter>
        <ErrorFallback />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /重新載入/ }));
    expect(mockReload).toHaveBeenCalled();
  });

  it('應渲染錯誤容器', () => {
    const { container } = render(
      <MemoryRouter>
        <ErrorFallback />
      </MemoryRouter>
    );
    expect(container.querySelector('.min-h-\\[60vh\\]')).toBeInTheDocument();
  });
});
