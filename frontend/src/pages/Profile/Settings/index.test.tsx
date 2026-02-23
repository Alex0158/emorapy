/**
 * Profile Settings 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileSettings from './index';

const mockGetProfile = vi.fn();
vi.mock('@/services/api/user', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
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
    mockGetProfile.mockResolvedValue({
      id: 'u1',
      notification_enabled: true,
    });
  });

  it('應掛載且不崩潰', async () => {
    const { container } = render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalled();
    });
  });
});
