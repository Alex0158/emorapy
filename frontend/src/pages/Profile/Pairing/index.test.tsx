/**
 * Profile Pairing 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePairing from './index';

const mockGetPairingStatus = vi.fn();
vi.mock('@/services/api/pairing', () => ({
  createPairing: vi.fn(),
  joinPairing: vi.fn(),
  getPairingStatus: (...args: unknown[]) => mockGetPairingStatus(...args),
  cancelPairing: vi.fn(),
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
    startSession: vi.fn().mockResolvedValue({ id: 'test-session-id' }),
    checkResume: vi.fn().mockResolvedValue({ has_pending: false }),
  }),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/ConfirmModal', () => ({
  default: () => null,
}));

describe('ProfilePairing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPairingStatus.mockResolvedValue(null);
  });

	  it('應掛載且不崩潰', async () => {
	    const { container } = render(
	      <MemoryRouter>
	        <ProfilePairing />
	      </MemoryRouter>
	    );
	    expect(container).toBeInTheDocument();
	    await waitFor(() => {
	      expect(screen.getByText('配對管理')).toBeInTheDocument();
	    });
	  });
});
