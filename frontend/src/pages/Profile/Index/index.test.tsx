/**
 * Profile Index 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileIndex from './index';

const mockGetProfile = vi.fn();
vi.mock('@/services/api/user', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfile: vi.fn(),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', email: 'u@example.com', nickname: 'User' },
    updateUser: vi.fn(),
  }),
}));
vi.mock('@/store/psychProfileStore', () => ({
  usePsychProfileStore: () => ({
    profile: null,
    fetchProfile: vi.fn(),
    giveConsent: vi.fn(),
    consentLoading: false,
  }),
}));
vi.mock('@/store/interviewStore', () => ({
  useInterviewStore: () => ({
    startSession: vi.fn(),
    checkResume: vi.fn(),
  }),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/Interview/RichnessRing', () => ({
  default: () => <div data-testid="richness-ring" />,
}));
vi.mock('@/components/business/Interview/ConsentModal', () => ({
  default: () => null,
}));

const mockProfile = {
  id: 'u1',
  email: 'u@example.com',
  nickname: 'User',
  avatar_url: null,
};

describe('ProfileIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue(mockProfile);
  });

  it('應掛載且不崩潰', async () => {
    const { container } = render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalled();
    });
  });
});
