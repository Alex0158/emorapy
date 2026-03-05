/**
 * Judgment Detail 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetJudgment = vi.fn();
const mockAcceptJudgment = vi.fn();
const mockGeneratePlans = vi.fn();
const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/services/api/judgment', () => ({
  getJudgment: (...args: unknown[]) => mockGetJudgment(...args),
  acceptJudgment: (...args: unknown[]) => mockAcceptJudgment(...args),
}));
vi.mock('@/services/api/reconciliation', () => ({
  generatePlans: (...args: unknown[]) => mockGeneratePlans(...args),
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
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({ default: () => <div data-testid="mediator-avatar" /> }));
vi.mock('@/components/business/JudgmentViewer', () => ({
  default: ({ content }: { content: string }) => <div data-testid="judgment-viewer">{content}</div>,
}));
vi.mock('@/components/business/ResponsibilityRatio', () => ({
  default: () => <div data-testid="responsibility-ratio" />,
}));
vi.mock('@/components/business/Interview/ConsentModal', () => ({
  default: () => null,
}));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      error: (...args: unknown[]) => mockMessageError(...args),
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      info: vi.fn(),
      warning: vi.fn(),
    },
  };
});

import JudgmentDetail from './index';

const mockJudgment = {
  id: 'j1',
  case_id: 'c1',
  judgment_content: '# 判決書',
  plaintiff_ratio: 60,
  defendant_ratio: 40,
  ai_model: 'test',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

function renderPage(id = 'j1') {
  return render(
    <MemoryRouter initialEntries={[`/judgment/${id}`]}>
      <Routes>
        <Route path="/judgment/:id" element={<JudgmentDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('JudgmentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJudgment.mockResolvedValue(mockJudgment);
  });

  it('掛載時應呼叫 getJudgment', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetJudgment).toHaveBeenCalledWith('j1');
    });
  });

  it('loading 時應顯示 loading', () => {
    mockGetJudgment.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('判決載入成功後應顯示判決書內容', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    expect(screen.getByTestId('responsibility-ratio')).toBeInTheDocument();
  });

  it('getJudgment 失敗時應顯示 judgmentNotFound Alert', async () => {
    mockGetJudgment.mockRejectedValue(new Error('fetch failed'));
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('fetch failed');
    });
    await waitFor(() => {
      expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument();
    });
  });

  it('generatePlans button should call mockGeneratePlans with id and navigate to reconciliation', async () => {
    mockGeneratePlans.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.generatePlans'));
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledWith('j1');
      expect(mockNavigate).toHaveBeenCalledWith('/reconciliation/j1');
    });
  });

  it('accept button opens modal and accept flow calls acceptJudgment and shows success', async () => {
    mockAcceptJudgment.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.acceptModalTitle')).toBeInTheDocument();
    });
    const modalOk = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledWith('j1', { accepted: true, rating: undefined });
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.acceptJudgmentSuccess');
    });
  });
});
