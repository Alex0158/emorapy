/**
 * Profile Pairing 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePairing from './index';
import type { Pairing } from '@/services/api/pairing';

const mockGetPairingStatus = vi.fn();
const mockGetRelationshipProfile = vi.fn();
const mockUpsertRelationshipProfile = vi.fn();
vi.mock('@/services/api/pairing', () => ({
  createPairing: vi.fn(),
  joinPairing: vi.fn(),
  getPairingStatus: (...args: unknown[]) => mockGetPairingStatus(...args),
  cancelPairing: vi.fn(),
}));
vi.mock('@/services/api/profile', () => ({
  getRelationshipProfile: (...args: unknown[]) => mockGetRelationshipProfile(...args),
  upsertRelationshipProfile: (...args: unknown[]) => mockUpsertRelationshipProfile(...args),
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
  const activePairing: Pairing = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    status: 'active',
    pairing_type: 'normal',
    created_at: new Date().toISOString(),
    user1: { id: 'u1', nickname: 'A' },
    user2: { id: 'u2', nickname: 'B' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPairingStatus.mockResolvedValue(null);
    mockGetRelationshipProfile.mockResolvedValue(null);
    mockUpsertRelationshipProfile.mockResolvedValue(null);
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

  it('配對成功時應讀取並可保存關係檔案', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_stage: 'stable',
      relationship_strengths: '互相信任',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_stage: 'stable',
      relationship_strengths: '建立每週回顧',
      completion_percentage: 75,
    });

    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('關係檔案')).toBeInTheDocument();
    });

    expect(mockGetRelationshipProfile).toHaveBeenCalledWith(activePairing.id);

    const strengthsInput = screen.getByPlaceholderText('可描述目前做得好的地方');
    fireEvent.change(strengthsInput, {
      target: { value: '建立每週回顧' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存關係檔案' }));

    await waitFor(() => {
      expect(mockUpsertRelationshipProfile).toHaveBeenCalledWith(
        activePairing.id,
        expect.objectContaining({
          relationship_strengths: '建立每週回顧',
        })
      );
    });
  });
});
