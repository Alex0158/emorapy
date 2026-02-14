/**
 * Header 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn(),
  }),
}));

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應渲染首頁與快速體驗連結', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText('首頁')).toBeInTheDocument();
    expect(screen.getByText('快速體驗')).toBeInTheDocument();
  });

  it('未登入時應顯示登入按鈕', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText('登入')).toBeInTheDocument();
  });
});
