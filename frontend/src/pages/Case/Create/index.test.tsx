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

vi.mock('@/store/caseStore', () => ({
  useCaseStore: () => ({ isLoading: false }),
}));

vi.mock('@/services/api/pairing', () => ({
  getPairingStatus: (...args: unknown[]) => mockGetPairingStatus(...args),
}));

vi.mock('@/services/api/case', () => ({
  createCase: vi.fn(),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/BearJudge', () => ({ default: () => <div data-testid="bear-judge" /> }));
vi.mock('@/components/business/StatementInput', () => ({ default: () => <div data-testid="statement-input" /> }));
vi.mock('@/components/business/FileUpload', () => ({ default: () => <div data-testid="file-upload" /> }));
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
    mockGetPairingStatus.mockResolvedValue(null);
  });

  it('應顯示創建新案件標題', async () => {
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('創建新案件')).toBeInTheDocument();
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
      const main = container.querySelector('[role="main"][aria-label="創建案件頁面"]');
      expect(main).toBeInTheDocument();
    });
  });
});
