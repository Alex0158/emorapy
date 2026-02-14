/**
 * Profile Index 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileIndex from './index';

vi.mock('@/services/api/user', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', email: 'u@example.com', nickname: 'User' },
    updateUser: vi.fn(),
  }),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ProfileIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
