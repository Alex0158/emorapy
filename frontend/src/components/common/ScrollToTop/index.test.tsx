/**
 * ScrollToTop 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, useNavigate, Routes, Route } from 'react-router-dom';
import ScrollToTop from './index';

function NavigateButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>go</button>;
}

describe('ScrollToTop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('應掛載且不拋錯', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/a']}>
        <ScrollToTop />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });

  it('初始掛載時應調用 window.scrollTo', () => {
    render(
      <MemoryRouter initialEntries={['/a']}>
        <ScrollToTop />
      </MemoryRouter>
    );
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('路徑變化時應再次調用 window.scrollTo', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/a']}>
        <ScrollToTop />
        <Routes>
          <Route path="/a" element={<NavigateButton to="/b" />} />
          <Route path="/b" element={<span>page-b</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    act(() => {
      getByText('go').click();
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });
});
