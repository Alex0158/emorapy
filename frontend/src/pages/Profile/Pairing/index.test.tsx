/**
 * Profile Pairing 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePairing from './index';

vi.mock('@/services/api/pairing', () => ({
  createPairing: vi.fn(),
  joinPairing: vi.fn(),
  getPairingStatus: vi.fn(),
  cancelPairing: vi.fn(),
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
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
