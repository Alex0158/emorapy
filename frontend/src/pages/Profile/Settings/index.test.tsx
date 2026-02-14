/**
 * Profile Settings 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileSettings from './index';

vi.mock('@/services/api/user', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u1' },
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

describe('ProfileSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
