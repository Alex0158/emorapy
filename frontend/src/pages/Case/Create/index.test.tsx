/**
 * Case Create 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CaseCreate from './index';

const mockNavigate = vi.fn();
const mockGetPairingStatus = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/api/pairing', () => ({
  getPairingStatus: (...args: unknown[]) => mockGetPairingStatus(...args),
}));

vi.mock('@/services/api/case', () => ({
  createCase: vi.fn(),
  uploadEvidence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/api/psychProfile', () => ({
  psychProfileApi: { getProfile: vi.fn().mockResolvedValue({ data: { data: null } }) },
}));

vi.mock('@/hooks/useInterviewTrigger', () => ({
  useInterviewTrigger: () => ({
    triggerInterview: vi.fn(),
    consentOpen: false,
    setConsentOpen: vi.fn(),
    setProfileConsent: vi.fn(),
    handleConsent: vi.fn(),
    consentLoading: false,
  }),
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({ default: () => <div data-testid="mediator-avatar" /> }));
vi.mock('@/components/business/StatementInput', () => ({ default: () => <div data-testid="statement-input" /> }));
vi.mock('@/components/business/FileUpload', () => ({ default: () => <div data-testid="file-upload" /> }));
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
  };
});

describe('Case Create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPairingStatus.mockResolvedValue({ id: 'pairing-1', status: 'active' });
  });

  it('應顯示創建新案件標題', async () => {
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
  });

  it('應調用 getPairingStatus', async () => {
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalled();
    });
  });

  it('應有創建案件頁面 role 與 aria-label', async () => {
    const { container } = render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      const main = container.querySelector('[role="main"][aria-label="caseCreate.pageLabel"]');
      expect(main).toBeInTheDocument();
    });
  });

  it('配對 pending 時應顯示配對未就緒', async () => {
    mockGetPairingStatus.mockResolvedValue({ id: 'pairing-1', status: 'pending' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.pairingRequired')).toBeInTheDocument();
    });
  });
});
