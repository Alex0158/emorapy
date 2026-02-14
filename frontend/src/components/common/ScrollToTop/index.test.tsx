/**
 * ScrollToTop 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScrollToTop from './index';

const MockScrollToTopWithRouter = () => (
  <MemoryRouter initialEntries={['/test']}>
    <ScrollToTop />
  </MemoryRouter>
);

describe('ScrollToTop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('應掛載且不拋錯', () => {
    const { container } = render(<MockScrollToTopWithRouter />);
    expect(container).toBeInTheDocument();
  });

  it('路徑變化時應調用 window.scrollTo', () => {
    render(<MockScrollToTopWithRouter />);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
