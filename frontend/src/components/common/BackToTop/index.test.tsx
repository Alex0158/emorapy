/**
 * BackToTop 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackToTop from './index';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => (key === 'common.backToTop' ? '返回頂部' : key),
}));

describe('BackToTop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  it('scrollY <= 300 時應不渲染按鈕', () => {
    render(<BackToTop />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('scrollY > 300 時應顯示返回頂部按鈕', async () => {
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true, configurable: true });
    render(<BackToTop />);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    // requestAnimationFrame callback
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('scrollY 為 0 時按鈕不顯示', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    render(<BackToTop />);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('點擊按鈕應調用 window.scrollTo', async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, writable: true, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true, configurable: true });
    render(<BackToTop />);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const btn = await waitFor(() => screen.getByRole('button'));
    await userEvent.click(btn);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('按鈕應有 aria-label 返回頂部', async () => {
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true, configurable: true });
    render(<BackToTop />);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '返回頂部' })).toBeInTheDocument();
    });
  });
});
