/**
 * BackToTop 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackToTop from './index';

vi.mock('@/utils/helpers', () => ({
  throttle: (fn: () => void) => fn,
}));

describe('BackToTop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'pageYOffset', { value: 0, writable: true, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollTop', { value: 0, writable: true, configurable: true });
  });

  it('scrollTop <= 300 時應不渲染按鈕', () => {
    const { container } = render(<BackToTop />);
    expect(container.querySelector('.back-to-top')).not.toBeInTheDocument();
  });

  it('scrollTop > 300 時應顯示返回頂部按鈕', () => {
    Object.defineProperty(window, 'pageYOffset', { value: 400, writable: true, configurable: true });
    const { container } = render(<BackToTop />);
    window.dispatchEvent(new Event('scroll'));
    expect(container.querySelector('.back-to-top')).toBeInTheDocument();
  });

  it('點擊按鈕應調用 window.scrollTo', async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, writable: true, configurable: true });
    Object.defineProperty(window, 'pageYOffset', { value: 400, writable: true, configurable: true });
    const { container } = render(<BackToTop />);
    window.dispatchEvent(new Event('scroll'));
    const btn = container.querySelector('.back-to-top');
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn!);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('按鈕應有 aria-label 返回頂部', () => {
    Object.defineProperty(window, 'pageYOffset', { value: 400, writable: true, configurable: true });
    render(<BackToTop />);
    window.dispatchEvent(new Event('scroll'));
    expect(screen.getByRole('button', { name: '返回頂部' })).toBeInTheDocument();
  });
});
