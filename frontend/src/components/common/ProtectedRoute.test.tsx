/**
 * ProtectedRoute 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const mockUseAuthStore = vi.fn();
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('已認證時應渲染 children', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true });
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
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false });
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <ProtectedRoute>
          <span>Protected content</span>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('未認證時不應渲染 children', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute redirectTo="/auth/login">
          <span>Content</span>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('requireAuth 為 false 時未認證也應渲染 children', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false });
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
});
