/**
 * Judgment Detail 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

  it('getJudgment 回傳 judgment_content 為 null 時應不崩潰並顯示判決區塊（F04 邊界：API 回傳不完整時不崩潰，F04-BUG-005）', async () => {
    mockGetJudgment.mockResolvedValueOnce({ ...mockJudgment, judgment_content: null });
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
    expect(screen.getByText('fetch failed')).toBeInTheDocument();
  });

  it('getJudgment 失敗時點擊 retry 應重新呼叫 getJudgment，成功後應顯示判決內容', async () => {
    mockGetJudgment
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(mockJudgment);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument();
    });
    expect(mockGetJudgment).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetJudgment).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
  });

  it('getJudgment 失敗時點擊返回按鈕應呼叫 navigate(-1)', async () => {
    mockGetJudgment.mockRejectedValue(new Error('fetch failed'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('getJudgment NOT_FOUND 時應顯示錯誤 Alert 並可點擊 retry 或返回（F04 錯誤恢復：與其他失敗一致，失敗不阻塞導航出口）', async () => {
    mockGetJudgment.mockRejectedValue({ code: 'NOT_FOUND' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument();
      expect(screen.getByText('judgmentDetail.back')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('retry 快速連點只會送出一次 getJudgment 請求', async () => {
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    mockGetJudgment.mockRejectedValueOnce(new Error('fetch failed')).mockImplementation(() => fetchPromise);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument();
    });
    expect(mockGetJudgment).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByRole('button', { name: 'common.retry' });
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    expect(mockGetJudgment).toHaveBeenCalledTimes(2); // 僅多一次，連點被防護
    resolveFetch!(mockJudgment);
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
  });

  it('getJudgment 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示判決內容（F04 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetJudgment
      .mockRejectedValueOnce(new Error('第一次失敗'))
      .mockRejectedValueOnce(new Error('第二次仍失敗'))
      .mockResolvedValueOnce(mockJudgment);
    renderPage();
    await waitFor(() => expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('第二次仍失敗'));
    await waitFor(() => expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetJudgment).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
  });

  it('getJudgment 失敗時 retry 再次失敗應顯示該次錯誤訊息', async () => {
    mockGetJudgment
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockRejectedValueOnce(new Error('重試時服務不可用'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument();
    });
    expect(mockMessageError).toHaveBeenCalledWith('網絡錯誤');
    mockMessageError.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('重試時服務不可用');
    });
  });

  it('getJudgment 失敗時 retry 再次失敗且 message 為空字串應使用 getJudgmentDetailFail（F10 邊界）', async () => {
    mockGetJudgment
      .mockRejectedValueOnce(new Error('初次失敗'))
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument();
    });
    mockMessageError.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getJudgmentDetailFail');
    });
  });

  it('getJudgment 失敗且無 message 時應使用 getJudgmentDetailFail 文案', async () => {
    mockGetJudgment.mockRejectedValue({ code: 'UNKNOWN' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getJudgmentDetailFail');
    });
  });

  it('getJudgment 失敗且 message 為空字串時應使用 getJudgmentDetailFail（F10 邊界）', async () => {
    mockGetJudgment.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getJudgmentDetailFail');
    });
  });

  it('getJudgment FORBIDDEN 時若有 message 應顯示該 message（F04 權限邊界）', async () => {
    mockGetJudgment.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限查看此判決' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('無權限查看此判決');
    });
    expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument();
    expect(screen.getByText('無權限查看此判決')).toBeInTheDocument();
  });

  it('getJudgment FORBIDDEN 且無 message 時應使用 getJudgmentDetailFail', async () => {
    mockGetJudgment.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getJudgmentDetailFail');
    });
  });

  it('getJudgment FORBIDDEN 時應仍可點擊返回並導向上一頁（F04 錯誤恢復：權限失敗不阻塞導航出口）', async () => {
    mockGetJudgment.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('message.judgmentNotFound')).toBeInTheDocument();
      expect(screen.getByText('judgmentDetail.back')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('點擊返回按鈕應呼叫 navigate(-1)（F04 導航）', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'judgmentDetail.backAria' }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
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

  it('acceptJudgment 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveAccept: (v: unknown) => void;
    mockAcceptJudgment.mockImplementation(
      () => new Promise((resolve) => { resolveAccept = resolve; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledWith('j1', { accepted: true, rating: undefined });
    });
    unmount();
    resolveAccept!(undefined);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
  });

  it('acceptJudgment(accepted: false) 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveReject: (v: unknown) => void;
    mockAcceptJudgment.mockImplementation(
      () => new Promise((resolve) => { resolveReject = resolve; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledWith('j1', { accepted: false });
    });
    unmount();
    resolveReject!(undefined);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
  });

  it('acceptJudgment(accepted: false) 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveReject: (v: unknown) => void;
    mockAcceptJudgment.mockImplementation(
      () => new Promise((resolve) => { resolveReject = resolve; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledWith('j1', { accepted: false });
    });
    unmount();
    resolveReject!(undefined);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
  });

  it('generatePlans 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveGenerate: (v: unknown) => void;
    mockGeneratePlans.mockImplementation(
      () => new Promise((resolve) => { resolveGenerate = resolve; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.generatePlans'));
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledWith('j1');
    });
    unmount();
    resolveGenerate!(undefined);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
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

  it('acceptJudgment 成功後 fetchJudgment 失敗應保留 judgment 並顯示錯誤提示，不應顯示 judgmentNotFound（F04 刷新失敗不覆蓋成功）', async () => {
    mockGetJudgment
      .mockResolvedValueOnce(mockJudgment)
      .mockRejectedValueOnce(new Error('網絡錯誤'));
    mockAcceptJudgment.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.acceptJudgmentSuccess');
    });
    await waitFor(() => {
      expect(mockGetJudgment).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('網絡錯誤');
    });
    expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    expect(screen.queryByText('message.judgmentNotFound')).not.toBeInTheDocument();
    // F04 業務規則：accept 成功後即使 fetch 失敗，應樂觀更新使按鈕 disabled，避免重複操作
    const acceptBtn = screen.getByRole('button', { name: 'judgmentDetail.acceptAria' });
    const rejectBtn = screen.getByRole('button', { name: 'judgmentDetail.rejectAria' });
    expect(acceptBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
  });

  it('acceptJudgment(accepted: false) 成功後 fetchJudgment 失敗應保留 judgment 並顯示錯誤提示，不應顯示 judgmentNotFound（F04 刷新失敗不覆蓋成功：reject 對稱）', async () => {
    mockGetJudgment
      .mockResolvedValueOnce(mockJudgment)
      .mockRejectedValueOnce(new Error('網路中斷'));
    mockAcceptJudgment.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.rejectJudgmentSuccess');
    });
    await waitFor(() => {
      expect(mockGetJudgment).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('網路中斷');
    });
    expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    expect(screen.queryByText('message.judgmentNotFound')).not.toBeInTheDocument();
    // F04 業務規則：reject 成功後即使 fetch 失敗，應樂觀更新使按鈕 disabled
    const acceptBtn = screen.getByRole('button', { name: 'judgmentDetail.acceptAria' });
    const rejectBtn = screen.getByRole('button', { name: 'judgmentDetail.rejectAria' });
    expect(acceptBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
  });

  it('判決已拒絕（user1_acceptance: false）時接受與拒絕按鈕應 disabled 且點擊不應呼叫 acceptJudgment（F04 業務規則：已決不可重選）', async () => {
    mockGetJudgment.mockResolvedValue({ ...mockJudgment, user1_acceptance: false });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    expect(screen.getByText('judgmentDetail.rejectedAlert')).toBeInTheDocument();
    const acceptBtn = screen.getByRole('button', { name: 'judgmentDetail.acceptAria' });
    const rejectBtn = screen.getByRole('button', { name: 'judgmentDetail.rejectAria' });
    expect(acceptBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    fireEvent.click(acceptBtn);
    fireEvent.click(rejectBtn);
    expect(mockAcceptJudgment).not.toHaveBeenCalled();
  });

  it('判決已接受（user1_acceptance: true）時接受與拒絕按鈕應 disabled 且點擊不應呼叫 acceptJudgment（F04 業務規則：已決不可重選，與拒絕對稱）', async () => {
    mockGetJudgment.mockResolvedValue({ ...mockJudgment, user1_acceptance: true });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    expect(screen.getByText('judgmentDetail.acceptedAlert')).toBeInTheDocument();
    const acceptBtn = screen.getByRole('button', { name: 'judgmentDetail.acceptAria' });
    const rejectBtn = screen.getByRole('button', { name: 'judgmentDetail.rejectAria' });
    expect(acceptBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    fireEvent.click(acceptBtn);
    fireEvent.click(rejectBtn);
    expect(mockAcceptJudgment).not.toHaveBeenCalled();
  });

  it('拒絕判決流程應調用 acceptJudgment(accepted: false) 並顯示成功', async () => {
    mockAcceptJudgment.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.rejectModalTitle')).toBeInTheDocument();
    });
    const modalOk = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledWith('j1', { accepted: false });
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.rejectJudgmentSuccess');
    });
  });

  it('acceptJudgment(accepted: false) 失敗後應仍可再次點擊 modal OK，成功後應顯示成功（F04 錯誤恢復：失敗不阻塞重試）', async () => {
    mockAcceptJudgment
      .mockRejectedValueOnce(new Error('暫時無法拒絕'))
      .mockResolvedValueOnce(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法拒絕');
    });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledTimes(2);
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.rejectJudgmentSuccess');
    });
  });

  it('接受判決失敗時應顯示錯誤', async () => {
    mockAcceptJudgment.mockRejectedValue(new Error('接受失敗'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('接受失敗');
    });
  });

  it('acceptJudgment 失敗後應仍可再次點擊 modal OK，成功後應顯示成功（F04 錯誤恢復：失敗不阻塞重試）', async () => {
    mockAcceptJudgment
      .mockRejectedValueOnce(new Error('暫時無法接受'))
      .mockResolvedValueOnce(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法接受');
    });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledTimes(2);
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.acceptJudgmentSuccess');
    });
  });

  it('接受判決失敗且 message 為空字串時應使用 operationFail（F10 邊界）', async () => {
    mockAcceptJudgment.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.acceptModalTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.operationFail');
    });
  });

  it('接受判決失敗且錯誤無 message 時應使用 message.operationFail', async () => {
    mockAcceptJudgment.mockRejectedValue({ code: 'SERVER_ERROR' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.operationFail');
    });
  });

  it('接受判決 FORBIDDEN 時若有 message 應顯示該 message（F04 權限邊界）', async () => {
    mockAcceptJudgment.mockRejectedValue({ code: 'FORBIDDEN', message: '此判決已逾接受期限' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('此判決已逾接受期限');
    });
  });

  it('接受判決 FORBIDDEN 且無 message 時應使用 operationFail（F04 權限邊界 fallback）', async () => {
    mockAcceptJudgment.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.operationFail');
    });
  });

  it('拒絕判決失敗且 message 為空字串時應使用 operationFail（F10 邊界）', async () => {
    mockAcceptJudgment.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.rejectModalTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.operationFail');
    });
  });

  it('拒絕判決失敗且錯誤無 message 時應使用 message.operationFail', async () => {
    mockAcceptJudgment.mockRejectedValue({ code: 'SERVER_ERROR' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.rejectModalTitle')).toBeInTheDocument();
    });
    const modalOk = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.operationFail');
    });
  });

  it('拒絕判決 FORBIDDEN 時若有 message 應顯示該 message（F04 權限邊界）', async () => {
    mockAcceptJudgment.mockRejectedValue({ code: 'FORBIDDEN', message: '此判決已無法拒絕' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.rejectModalTitle')).toBeInTheDocument();
    });
    const modalOk = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('此判決已無法拒絕');
    });
  });

  it('拒絕判決 FORBIDDEN 且無 message 時應使用 operationFail（F04 權限邊界 fallback）', async () => {
    mockAcceptJudgment.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.rejectModalTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.operationFail');
    });
  });

  it('接受判決 modal 內快速連點 OK 只會送出一次 acceptJudgment 請求', async () => {
    let resolveAccept: (v: unknown) => void;
    mockAcceptJudgment.mockImplementation(
      () => new Promise((resolve) => { resolveAccept = resolve; })
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.accept'));
    const modalOk = await screen.findByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    fireEvent.click(modalOk);
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledTimes(1);
    });
    resolveAccept!(undefined);
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.acceptJudgmentSuccess');
    });
  });

  it('generatePlans 失敗時應顯示 generatePlansFail', async () => {
    mockGeneratePlans.mockRejectedValue(new Error('生成和好方案失敗'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('生成和好方案失敗');
    });
  });

  it('generatePlans 失敗且錯誤無 message 時應使用 message.generatePlansFail', async () => {
    mockGeneratePlans.mockRejectedValue({ code: 'SERVER_ERROR' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.generatePlansFail');
    });
  });

  it('generatePlans 失敗且 message 為空字串時應使用 message.generatePlansFail（F10 邊界：空 message 視為無）', async () => {
    mockGeneratePlans.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.generatePlansFail');
    });
  });

  it('generatePlans 失敗後應仍可再次點擊生成和好方案，成功後應導向 reconciliation（F04 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGeneratePlans
      .mockRejectedValueOnce(new Error('AI 服務暫時不可用'))
      .mockResolvedValueOnce(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.generatePlans')).toBeInTheDocument();
    });
    const btn = screen.getByText('judgmentDetail.generatePlans');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('AI 服務暫時不可用');
    });
    await waitFor(() => {
      expect(btn.closest('button')).not.toHaveClass('ant-btn-loading');
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledTimes(2);
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.generatePlansSuccess');
      expect(mockNavigate).toHaveBeenCalledWith('/reconciliation/j1');
    });
  });

  it('generatePlans FORBIDDEN 時若有 message 應顯示該 message（F04 權限邊界）', async () => {
    mockGeneratePlans.mockRejectedValue({ code: 'FORBIDDEN', message: '此判決已無法生成和好方案' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('此判決已無法生成和好方案');
    });
  });

  it('generatePlans FORBIDDEN 且無 message 時應使用 message.generatePlansFail（F04 權限邊界 fallback）', async () => {
    mockGeneratePlans.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.generatePlans'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.generatePlansFail');
    });
  });

  it('generatePlans 快速連點只會送出一次請求', async () => {
    let resolveGenerate: (v: unknown) => void;
    const generatePromise = new Promise((resolve) => { resolveGenerate = resolve; });
    mockGeneratePlans.mockImplementation(() => generatePromise as Promise<unknown>);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.generatePlans')).toBeInTheDocument();
    });
    const btn = screen.getByText('judgmentDetail.generatePlans');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      resolveGenerate!(undefined);
      await Promise.resolve();
    });
  });

  it('reject modal 內快速連點 OK 只會送出一次 acceptJudgment 請求', async () => {
    let resolveReject: (v: unknown) => void;
    const rejectPromise = new Promise((resolve) => { resolveReject = resolve; });
    mockAcceptJudgment.mockImplementation(() => rejectPromise as Promise<unknown>);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('judgmentDetail.reject'));
    await waitFor(() => {
      expect(screen.getByText('judgmentDetail.rejectModalTitle')).toBeInTheDocument();
    });
    const modalOk = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(modalOk);
    fireEvent.click(modalOk);
    fireEvent.click(modalOk);
    await waitFor(() => {
      expect(mockAcceptJudgment).toHaveBeenCalledTimes(1);
    });
    resolveReject!(undefined);
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.rejectJudgmentSuccess');
    });
  });
});
