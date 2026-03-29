/**
 * Case Review 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetCase = vi.fn();
const mockGetJudgmentByCaseId = vi.fn();
const mockGenerateJudgment = vi.fn();
const mockStartPolling = vi.fn();
const mockStopPolling = vi.fn();
const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();
const mockMessageWarning = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api/case', () => ({
  getCase: (...args: unknown[]) => mockGetCase(...args),
}));
vi.mock('@/services/api/judgment', () => ({
  getJudgmentByCaseId: (...args: unknown[]) => mockGetJudgmentByCaseId(...args),
  generateJudgment: (...args: unknown[]) => mockGenerateJudgment(...args),
}));
vi.mock('@/hooks/usePolling', () => ({
  usePolling: () => ({ startPolling: mockStartPolling, stopPolling: mockStopPolling, isPolling: false }),
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({ default: () => <div>MediatorAvatar</div> }));
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      error: (...args: unknown[]) => mockMessageError(...args),
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      warning: (...args: unknown[]) => mockMessageWarning(...args),
    },
  };
});

import CaseReview from './index';

const submittedCase = {
  id: '123',
  status: 'submitted',
  title: 'Test Case',
  plaintiff_statement: 'A',
  defendant_statement: 'B',
};

function renderPage(id = '123') {
  return render(
    <MemoryRouter initialEntries={[`/case/${id}/review`]}>
      <Routes>
        <Route path="/case/:id/review" element={<CaseReview />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CaseReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCase.mockResolvedValue(submittedCase);
    mockGetJudgmentByCaseId.mockResolvedValue(null);
    mockGenerateJudgment.mockResolvedValue({ id: 'j1' });
  });

  it('submitted 案件應掛載並顯示審理中畫面', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledWith('123');
      expect(screen.getByText('review.aiReviewing')).toBeInTheDocument();
      expect(mockStartPolling).toHaveBeenCalled();
    });
  });

  it('draft 案件進入 review 時應提示並導回 detail', async () => {
    mockGetCase.mockResolvedValueOnce({ ...submittedCase, status: 'draft' });

    renderPage();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('review.caseNotSubmitted');
      expect(mockNavigate).toHaveBeenCalledWith('/case/123', { replace: true });
    });
  });

  it('cancelled 案件進入 review 時應提示並導回案件列表（F03-BUG-005：cancelled 狀態邊界）', async () => {
    mockGetCase.mockResolvedValueOnce({ ...submittedCase, status: 'cancelled' });

    renderPage();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('review.caseCancelled');
      expect(mockNavigate).toHaveBeenCalledWith('/case/list', { replace: true });
    });
  });

  it('judgment_failed 時 generateJudgment 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'ai timeout',
    });
    let resolveGenerate: (v: unknown) => void;
    mockGenerateJudgment.mockImplementation(
      () => new Promise((resolve) => { resolveGenerate = resolve; }) as ReturnType<typeof mockGenerateJudgment>
    );
    const { unmount } = renderPage();
    fireEvent.click(await screen.findByText('review.retryJudgment'));
    await waitFor(() => {
      expect(mockGenerateJudgment).toHaveBeenCalledWith('123');
    });
    unmount();
    resolveGenerate!({ id: 'j-new', case_id: '123', judgment_content: '# 判決', plaintiff_ratio: 60, defendant_ratio: 40, ai_model: 'test', created_at: '2025-01-01', updated_at: '2025-01-01' });
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
  });

  it('judgment_failed 時點擊重試應調用 generateJudgment 並顯示成功訊息', async () => {
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'ai timeout',
    });

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    await waitFor(() => {
      expect(mockGenerateJudgment).toHaveBeenCalledWith('123');
      expect(mockMessageSuccess).toHaveBeenCalledWith('review.retrySuccess');
    });
  });

  it('getCase 回傳 FORBIDDEN 時應提示無權限並導向 /case/list', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'FORBIDDEN' });

    renderPage();

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.noPermissionViewCase');
      expect(mockNavigate).toHaveBeenCalledWith('/case/list', { replace: true });
    });
  });

  it('getCase FORBIDDEN 時若有 message 應顯示該 message（F03 權限邊界）', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'FORBIDDEN', message: '此案件已移交他方，您無權查看' });

    renderPage();

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('此案件已移交他方，您無權查看');
      expect(mockNavigate).toHaveBeenCalledWith('/case/list', { replace: true });
    });
  });

  it('getCase 失敗且非 FORBIDDEN/NOT_FOUND 且錯誤無 message 時應顯示 common.getCaseFail', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'SERVER_ERROR' });

    renderPage();

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('common.getCaseFail');
    });
  });

  it('getCase 一般失敗時應在頁內 Alert 顯示實際錯誤訊息', async () => {
    mockGetCase.mockRejectedValueOnce(new Error('審理資料載入逾時'));

    renderPage();

    expect(await screen.findByText('common.getCaseFail')).toBeInTheDocument();
    expect(screen.getByText('審理資料載入逾時')).toBeInTheDocument();
  });

  it('getCase 失敗時應仍可點擊 backList 導向 /case/list（F03 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetCase.mockRejectedValueOnce(new Error('網絡錯誤'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    const backListBtn = screen.getByText('caseDetail.backList');
    expect(backListBtn).toBeInTheDocument();
    fireEvent.click(backListBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/case/list');
  });

  it('getCase 失敗時點擊 retry 應重新呼叫 getCase（F03 重試分支）', async () => {
    mockGetCase
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockResolvedValueOnce(submittedCase);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetCase).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledTimes(2);
    });
  });

  it('getCase 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示審理中畫面（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetCase
      .mockRejectedValueOnce(new Error('第一次失敗'))
      .mockRejectedValueOnce(new Error('第二次仍失敗'))
      .mockResolvedValueOnce(submittedCase);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    const retryBtn = screen.getByRole('button', { name: 'common.retry' });
    fireEvent.click(retryBtn);
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('第二次仍失敗'));
    await waitFor(() => expect(screen.getByText('common.retry')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledTimes(3);
      expect(screen.getByText('review.aiReviewing')).toBeInTheDocument();
    });
  });

  it('getCase 失敗時 retry 再次失敗應顯示該次錯誤訊息（F03 重試錯誤反饋）', async () => {
    mockGetCase.mockRejectedValue(new Error('網絡錯誤'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetCase).toHaveBeenCalledTimes(1);
    mockGetCase.mockRejectedValueOnce(new Error('重試時服務不可用'));
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('重試時服務不可用');
    });
  });

  it('getCase 失敗時 retry 快速連點只會送出一次 getCase 請求（F03 重試節流）', async () => {
    let resolveFetch: (v: unknown) => void;
    mockGetCase
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetCase).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByRole('button', { name: 'common.retry' });
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledTimes(2);
    });
    resolveFetch!(submittedCase);
    await waitFor(() => {
      expect(screen.getByText('review.aiReviewing')).toBeInTheDocument();
    });
  });

  it('getCase 失敗時 retry 再次失敗且 message 為空字串應使用 common.getCaseFail（F10 邊界）', async () => {
    mockGetCase.mockRejectedValue(new Error('網絡錯誤'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    mockGetCase.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('common.getCaseFail');
    });
  });

  it('getCase 失敗且 message 為空字串時應使用 common.getCaseFail（F10 邊界：空 message 視為無）', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });

    renderPage();

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('common.getCaseFail');
    });
  });

  it('getCase 回傳 NOT_FOUND 時應提示案件不存在', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'NOT_FOUND' });

    renderPage();

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('common.caseNotFound');
    });
  });

  it('getCase 回傳 NOT_FOUND 時應顯示錯誤 Alert 並可點擊 backList 或 retry（F03 錯誤恢復：與其他失敗一致，失敗不阻塞導航出口）', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'NOT_FOUND' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('common.caseNotFound')).toBeInTheDocument();
      expect(screen.getByText('caseDetail.backList')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('caseDetail.backList'));
    expect(mockNavigate).toHaveBeenCalledWith('/case/list');
  });

  it('completed 且有判決時應顯示判決就緒並可導向判決頁', async () => {
    mockGetCase.mockResolvedValueOnce({ ...submittedCase, status: 'completed' });
    mockGetJudgmentByCaseId.mockResolvedValueOnce({ id: 'judgment-456', case_id: '123' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('review.judgmentReady')).toBeInTheDocument();
      expect(screen.getByText('review.viewJudgment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('review.viewJudgment'));
    expect(mockNavigate).toHaveBeenCalledWith('/judgment/judgment-456');
  });

  it('judgment_failed 重試失敗時應顯示錯誤並重新拉取案件', async () => {
    mockGetCase
      .mockResolvedValueOnce({
        ...submittedCase,
        status: 'judgment_failed',
        judgment_failure_reason: 'ai error',
      })
      .mockResolvedValueOnce({ ...submittedCase, status: 'judgment_failed' });
    mockGenerateJudgment.mockRejectedValueOnce(new Error('生成失敗'));

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('生成失敗');
      expect(mockGetCase).toHaveBeenCalledTimes(2);
    });
  });

  it('judgment_failed 重試失敗且錯誤無 message 時應顯示 review.retryFail', async () => {
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'ai error',
    });
    mockGenerateJudgment.mockRejectedValueOnce({ code: 'SERVER_ERROR' });

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('review.retryFail');
    });
  });

  it('judgment_failed 重試失敗且 message 為空字串時應顯示 review.retryFail（F10 邊界：空 message 視為無）', async () => {
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: null,
    });
    mockGenerateJudgment.mockRejectedValueOnce({ code: 'AI_SERVICE_ERROR', message: '' });

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('review.retryFail');
    });
  });

  it('judgment_failed 重試 generateJudgment FORBIDDEN 且無 message 時應使用 review.retryFail（F03 權限邊界 fallback）', async () => {
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'ai error',
    });
    mockGenerateJudgment.mockRejectedValueOnce({ code: 'FORBIDDEN' });

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('review.retryFail');
    });
  });

  it('judgment_failed 重試時若 generateJudgment 回傳 JUDGMENT_EXISTS 應改呼叫 getJudgmentByCaseId 並顯示判決', async () => {
    const existingJudgment = { id: 'j-existing', case_id: '123', judgment_content: '判決書' };
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'ai error',
    });
    mockGenerateJudgment.mockRejectedValueOnce({ code: 'JUDGMENT_EXISTS' });
    mockGetJudgmentByCaseId
      .mockResolvedValueOnce(null) // useEffect 初次 fetch 用
      .mockResolvedValueOnce(existingJudgment); // 點擊 retry 後 JUDGMENT_EXISTS 分支用

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('123');
    });
    await waitFor(() => {
      expect(screen.getByText('review.judgmentReady')).toBeInTheDocument();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('judgment_failed 重試時 JUDGMENT_EXISTS 但 getJudgmentByCaseId 失敗且有 message 應顯示該 message 並重拉案件', async () => {
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'ai error',
    });
    mockGenerateJudgment.mockRejectedValueOnce({ code: 'JUDGMENT_EXISTS' });
    mockGetJudgmentByCaseId
      .mockResolvedValueOnce(null) // useEffect 初次 fetch 用
      .mockRejectedValueOnce(new Error('fetch judgment failed')); // 點擊 retry 後 JUDGMENT_EXISTS 分支用

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('fetch judgment failed');
    });
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledTimes(2);
    });
  });

  it('judgment_failed 重試時 JUDGMENT_EXISTS 但 getJudgmentByCaseId 失敗且無 message 應顯示 review.retryFail', async () => {
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'ai error',
    });
    mockGenerateJudgment.mockRejectedValueOnce({ code: 'JUDGMENT_EXISTS' });
    mockGetJudgmentByCaseId
      .mockResolvedValueOnce(null) // useEffect 初次 fetch 用
      .mockRejectedValueOnce({ code: 'SERVER_ERROR' }); // 點擊 retry 後 JUDGMENT_EXISTS 分支用

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('review.retryFail');
    });
  });

  it('judgment_failed 重試時 JUDGMENT_EXISTS 但 getJudgmentByCaseId 失敗且 message 為空字串應使用 review.retryFail（F10 邊界）', async () => {
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'ai error',
    });
    mockGenerateJudgment.mockRejectedValueOnce({ code: 'JUDGMENT_EXISTS' });
    mockGetJudgmentByCaseId
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('review.retryFail');
    });
  });

  it('judgment_failed 重試快速連點只會送出一次 generateJudgment 請求', async () => {
    let resolveGen: (v: unknown) => void;
    const genPromise = new Promise<{ id: string; case_id: string }>((resolve) => { resolveGen = resolve; });
    mockGetCase.mockResolvedValueOnce({
      ...submittedCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'ai error',
    });
    mockGenerateJudgment.mockReturnValue(genPromise);

    renderPage();

    const retryBtn = await screen.findByText('review.retryJudgment');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(mockGenerateJudgment).toHaveBeenCalledTimes(1);
    });
    // 連點防護驗證：僅呼叫一次即足夠；resolve 後續流程不影響本測試目標
    resolveGen!({ id: 'j1', case_id: '123' });
  });
});
