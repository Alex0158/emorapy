import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetJudgment = vi.fn();
const mockAcceptJudgment = vi.fn();
const mockNavigate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api/judgment', () => ({
  getJudgment: (...args: unknown[]) => mockGetJudgment(...args),
  acceptJudgment: (...args: unknown[]) => mockAcceptJudgment(...args),
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
vi.mock('@/components/business/Interview/ConsentModal', () => ({ default: () => null }));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import JudgmentDetail from './index';

const mockJudgment = {
  id: 'j1',
  case_id: 'c1',
  judgment_content: '# 判決書',
  plaintiff_ratio: 60,
  defendant_ratio: 40,
  ai_model: 'test',
  created_at: '2026-04-05T00:00:00Z',
  updated_at: '2026-04-05T00:00:00Z',
};

function renderPage(id = 'j1') {
  return render(
    <MemoryRouter initialEntries={[`/judgment/${id}`]}>
      <Routes>
        <Route path="/judgment/:id" element={<JudgmentDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('JudgmentDetail', () => {
  beforeEach(() => {
    mockGetJudgment.mockReset();
    mockAcceptJudgment.mockReset();
    mockNavigate.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
  });

  it('載入判決後顯示四個下一步方向入口', async () => {
    mockGetJudgment.mockResolvedValue(mockJudgment);

    renderPage();

    await waitFor(() => {
      expect(mockGetJudgment).toHaveBeenCalledWith('j1');
    });

    expect(screen.getByText('judgmentDetail.nextDirectionTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'judgmentDetail.intentRepairCta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'judgmentDetail.intentCoolDownCta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'judgmentDetail.intentGracefulExitCta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'judgmentDetail.intentSafetyCta' })).toBeInTheDocument();
  });

  it('點擊方向入口會帶著 intent 進入修復旅程', async () => {
    mockGetJudgment.mockResolvedValue(mockJudgment);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'judgmentDetail.intentRepairCta' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'judgmentDetail.intentRepairCta' }));
    await userEvent.click(screen.getByRole('button', { name: 'judgmentDetail.intentCoolDownCta' }));

    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/reconciliation/j1?intent=repair');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/reconciliation/j1?intent=cool_down');
  });

  it('接受判決後會顯示已接受狀態', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    mockGetJudgment.mockResolvedValue(mockJudgment);
    mockAcceptJudgment.mockResolvedValue(undefined);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /judgmentDetail.accept/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /judgmentDetail.accept/ }));
    await user.click(screen.getByRole('button', { name: /judgmentDetail.confirmAccept/ }));

    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledWith('j1', { accepted: true, rating: undefined });
      expect(mockToastSuccess).toHaveBeenCalledWith('message.acceptJudgmentSuccess');
    });
  });

  it('載入失敗時顯示錯誤並允許 retry 或返回', async () => {
    mockGetJudgment
      .mockRejectedValueOnce(new Error('判決載入失敗'))
      .mockResolvedValueOnce(mockJudgment);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('判決載入失敗')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'judgmentDetail.back' }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);

    await userEvent.click(screen.getByRole('button', { name: 'common.retry' }));

    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
  });
});
