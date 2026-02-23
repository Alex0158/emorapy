/**
 * ProtectedRoute 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const mockUseAuthStore = vi.fn();
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('已認證且已 hydrated 時應渲染 children', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, _hasHydrated: true });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <span data-testid="child">Protected content</span>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('未認證時應重定向至登錄頁', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, _hasHydrated: true });
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={
            <ProtectedRoute><span>Protected content</span></ProtectedRoute>
          } />
          <Route path="/auth/login" element={<span data-testid="login">Login Page</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('未認證時應重定向至自定義路徑', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, _hasHydrated: true });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={
            <ProtectedRoute redirectTo="/custom-login"><span>Content</span></ProtectedRoute>
          } />
          <Route path="/custom-login" element={<span data-testid="custom">Custom Login</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });

  it('requireAuth 為 false 時未認證也應渲染 children', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, _hasHydrated: true });
    render(
      <MemoryRouter>
        <ProtectedRoute requireAuth={false}>
          <span data-testid="child">Public content</span>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Public content')).toBeInTheDocument();
  });

  it('未 hydrated 時應顯示 loading Spin', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, _hasHydrated: false });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <span>Content</span>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('hydration 超時後應繼續渲染（未認證則重定向）', () => {
    vi.useFakeTimers();
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false, _hasHydrated: false });
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={
            <ProtectedRoute><span>Content</span></ProtectedRoute>
          } />
          <Route path="/auth/login" element={<span data-testid="login">Login</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });
});
