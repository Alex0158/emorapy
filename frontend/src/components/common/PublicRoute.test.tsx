/**
 * PublicRoute 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicRoute from './PublicRoute';

const mockUseAuthStore = vi.fn();
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

describe('PublicRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('未認證且已 hydrated 時應渲染 children', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, _hasHydrated: true });
    render(
      <MemoryRouter>
        <PublicRoute>
          <span data-testid="child">Login form</span>
        </PublicRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Login form')).toBeInTheDocument();
  });

  it('已認證時應重定向至預設路徑', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, _hasHydrated: true });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={
            <PublicRoute><span>Login form</span></PublicRoute>
          } />
          <Route path="/case/list" element={<span data-testid="list">Case List</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
    expect(screen.getByTestId('list')).toBeInTheDocument();
  });

  it('已認證時應支援自定義 redirectTo', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, _hasHydrated: true });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={
            <PublicRoute redirectTo="/dashboard"><span>Content</span></PublicRoute>
          } />
          <Route path="/dashboard" element={<span data-testid="dash">Dashboard</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    expect(screen.getByTestId('dash')).toBeInTheDocument();
  });

  it('未 hydrated 時應顯示 loading Spin', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, _hasHydrated: false });
    render(
      <MemoryRouter>
        <PublicRoute>
          <span>Login form</span>
        </PublicRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('hydration 超時後應繼續渲染（已認證則重定向）', () => {
    vi.useFakeTimers();
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, _hasHydrated: false });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={
            <PublicRoute><span>Login form</span></PublicRoute>
          } />
          <Route path="/case/list" element={<span data-testid="list">Case List</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('list')).toBeInTheDocument();
  });
});
