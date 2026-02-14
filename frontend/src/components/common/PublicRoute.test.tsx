/**
 * PublicRoute 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicRoute from './PublicRoute';

const mockUseAuthStore = vi.fn();
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

describe('PublicRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未認證時應渲染 children', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: false });
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

  it('已認證時不應渲染 children', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true });
    render(
      <MemoryRouter>
        <PublicRoute>
          <span>Login form</span>
        </PublicRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  it('應支援自定義 redirectTo', () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true });
    render(
      <MemoryRouter>
        <PublicRoute redirectTo="/dashboard">
          <span>Content</span>
        </PublicRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });
});
