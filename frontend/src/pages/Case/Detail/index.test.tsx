/**
 * Case Detail 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetCase = vi.fn();
const mockSubmitCase = vi.fn();
const mockUpdateCase = vi.fn();
const mockNavigate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastWarning = vi.fn();
const mockToastInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api/case', () => ({
  getCase: (...args: unknown[]) => mockGetCase(...args),
  submitCase: (...args: unknown[]) => mockSubmitCase(...args),
  updateCase: (...args: unknown[]) => mockUpdateCase(...args),
}));
const mockGetJudgmentByCaseId = vi.fn();
vi.mock('@/services/api/judgment', () => ({
  getJudgmentByCaseId: (...args: unknown[]) => mockGetJudgmentByCaseId(...args),
}));
const authUser = { id: 'u1', email: 'test@example.com' };
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: authUser }),
}));
vi.mock('@/utils/validate', () => ({
  validateStatement: vi.fn(),
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/utils/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/business/StatementInput', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      data-testid="defendant-statement-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="defendant-statement"
    />
  ),
}));
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

import CaseDetail from './index';
import { validateStatement } from '@/utils/validate';

const mockCase = {
  id: 'c1',
  pairing_id: 'p1',
  title: 'Test',
  type: '生活習慣衝突',
  status: 'draft' as const,
  mode: 'quick' as const,
  plaintiff_id: 'u1',
  plaintiff_statement: '原告陳述',
  defendant_statement: '',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

function renderPage(id = 'c1') {
  return render(
    <MemoryRouter initialEntries={[`/case/${id}`]}>
      <Routes>
        <Route path="/case/:id" element={<CaseDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CaseDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser.id = 'u1';
    mockGetCase.mockResolvedValue(mockCase);
    vi.mocked(validateStatement).mockReturnValue({ valid: false });
  });

  it('掛載時應呼叫 getCase 並顯示案件資訊', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledWith('c1');
    });
  });

  it('loading 時應顯示 loading spinner', () => {
    mockGetCase.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('getCase NOT_FOUND 時應顯示錯誤並排程導航', async () => {
    mockGetCase.mockRejectedValue({ code: 'NOT_FOUND', message: 'Not found' });
    renderPage();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.caseNotFound');
    });
  });

  it('getCase NOT_FOUND 時應顯示錯誤 Alert 並可點擊 backList 或 retry（F03 錯誤恢復：與其他失敗一致，失敗不阻塞導航出口）', async () => {
    mockGetCase.mockRejectedValue({ code: 'NOT_FOUND' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('common.caseNotFound')).toBeInTheDocument();
      expect(screen.getByText('caseDetail.backList')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('caseDetail.backList'));
    expect(mockNavigate).toHaveBeenCalledWith('/case/list');
  });

  it('getCase FORBIDDEN 且無 message 時應顯示 noPermissionViewCase', async () => {
    mockGetCase.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.noPermissionViewCase');
    });
  });

  it('getCase FORBIDDEN 時若有 message 應顯示該 message（F03 權限邊界）', async () => {
    mockGetCase.mockRejectedValue({ code: 'FORBIDDEN', message: '此案件已移交他方，您無權查看' });
    renderPage();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('此案件已移交他方，您無權查看');
    });
  });

  it('getCase UNAUTHORIZED 時應顯示需登入錯誤', async () => {
    mockGetCase.mockRejectedValue({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    renderPage();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.pleaseLogin');
    });
  });

  it('getCase HTTP_403 時應顯示無權限錯誤（與 FORBIDDEN 同處理）', async () => {
    mockGetCase.mockRejectedValue({ code: 'HTTP_403' });
    renderPage();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.noPermissionViewCase');
    });
  });

  it('getCase HTTP_401 時應顯示需登入錯誤（與 UNAUTHORIZED 同處理）', async () => {
    mockGetCase.mockRejectedValue({ code: 'HTTP_401' });
    renderPage();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.pleaseLogin');
    });
  });

  it('getCase 失敗且無 message（非 NOT_FOUND/FORBIDDEN/UNAUTHORIZED）時應使用 common.getCaseFail', async () => {
    mockGetCase.mockRejectedValue({ code: 'SERVER_ERROR' });
    renderPage();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.getCaseFail');
    });
  });

  it('getCase 失敗且 message 為空字串時應使用 common.getCaseFail（F10 邊界）', async () => {
    mockGetCase.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.getCaseFail');
    });
  });

  it('getCase 失敗且有 message（非特殊 code）時應顯示該 message（F10 錯誤處理約定）', async () => {
    mockGetCase.mockRejectedValue(new Error('資料庫連線逾時，請稍後再試'));
    renderPage();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('資料庫連線逾時，請稍後再試');
    });
  });

  it('getCase 一般失敗時應在頁內 Alert 顯示實際錯誤訊息', async () => {
    mockGetCase.mockRejectedValue(new Error('資料庫連線逾時，請稍後再試'));
    renderPage();
    expect(await screen.findByText('common.getCaseFail')).toBeInTheDocument();
    expect(screen.getByText('資料庫連線逾時，請稍後再試')).toBeInTheDocument();
  });

  it('getCase 失敗時應仍可點擊 backList 導向 /case/list（F03 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetCase.mockRejectedValue(new Error('網絡錯誤'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    const backListBtn = screen.getByText('caseDetail.backList');
    expect(backListBtn).toBeInTheDocument();
    fireEvent.click(backListBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/case/list');
  });

  it('getCase 失敗時 retry 快速連點只會送出一次 getCase 請求', async () => {
    let resolveFetch: (v: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    mockGetCase
      .mockRejectedValueOnce(new Error('network error'))
      .mockImplementation(() => fetchPromise as Promise<typeof mockCase>);
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
    resolveFetch!(mockCase);
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  it('getCase 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示案件內容（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetCase
      .mockRejectedValueOnce(new Error('第一次失敗'))
      .mockRejectedValueOnce(new Error('第二次仍失敗'))
      .mockResolvedValueOnce(mockCase);
    renderPage();
    await waitFor(() => expect(screen.getByText('common.retry')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('第二次仍失敗'));
    await waitFor(() => expect(screen.getByText('common.retry')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledTimes(3);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  it('getCase 失敗時 retry 再次失敗應顯示該次錯誤訊息（F03 重試錯誤反饋）', async () => {
    mockGetCase
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockRejectedValueOnce(new Error('重試時服務不可用'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockToastError).toHaveBeenCalledWith('網絡錯誤');
    mockToastError.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('重試時服務不可用');
    });
  });

  it('getCase 失敗時 retry 再次失敗且 message 為空字串應使用 common.getCaseFail（F10 邊界）', async () => {
    mockGetCase
      .mockRejectedValueOnce(new Error('初次失敗'))
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    mockToastError.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('common.getCaseFail');
    });
  });

  it('案件載入成功後應顯示案件標題', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  it('remote draft 且尚未有被告陳述時，原告端應顯示等待提示且不可提交', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });

    renderPage();

    expect(await screen.findByText('caseDetail.waitingForDefendant')).toBeInTheDocument();
    expect(screen.queryByText('caseDetail.submitCase')).not.toBeInTheDocument();
  });

  it('可提交 draft 案件時應調用 submitCase 並跳到 review', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase.mockResolvedValue({
      ...mockCase,
      status: 'submitted',
    });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.submitCase'));

    await waitFor(() => {
      expect(mockSubmitCase).toHaveBeenCalledWith('c1');
      expect(mockToastSuccess).toHaveBeenCalledWith('message.submitCaseSuccess');
      expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
    });
  });

  it('submitCase 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    let resolveSubmit: (v: unknown) => void;
    mockSubmitCase.mockImplementation(
      () => new Promise((resolve) => { resolveSubmit = resolve; })
    );
    const { unmount } = renderPage();
    fireEvent.click(await screen.findByText('caseDetail.submitCase'));
    await waitFor(() => {
      expect(mockSubmitCase).toHaveBeenCalledWith('c1');
    });
    unmount();
    resolveSubmit!({ ...mockCase, status: 'submitted' });
    await Promise.resolve();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('submit 快速連點只會送出一次 submitCase 請求', async () => {
    let resolveSubmit: (v: unknown) => void;
    const submitPromise = new Promise((resolve) => { resolveSubmit = resolve; });
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase.mockImplementation(() => submitPromise as Promise<typeof mockCase>);

    renderPage();

    const submitBtn = await screen.findByText('caseDetail.submitCase');
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmitCase).toHaveBeenCalledTimes(1);
    });
    resolveSubmit!({ ...mockCase, status: 'submitted' });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
    });
  });

  it('draft remote 案件且被告已有陳述時應顯示提交按鈕且可提交（F03 draft 邊界）', async () => {
    authUser.id = 'u1';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      status: 'draft',
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '被告已填寫足夠長度的陳述，符合提交條件。',
    });
    mockSubmitCase.mockResolvedValue({ ...mockCase, status: 'submitted' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
    expect(screen.getByText('caseDetail.submitCase')).toBeInTheDocument();
    expect(screen.queryByText('caseDetail.waitingForDefendant')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('caseDetail.submitCase'));
    await waitFor(() => {
      expect(mockSubmitCase).toHaveBeenCalledWith('c1');
      expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
    });
  });

  it('draft remote 案件且等待被告回覆時不應顯示 submit 按鈕（F03 draft 邊界）', async () => {
    authUser.id = 'u1';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      status: 'draft',
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
    expect(screen.queryByText('caseDetail.submitCase')).not.toBeInTheDocument();
    expect(screen.getByText('caseDetail.waitingForDefendant')).toBeInTheDocument();
  });

  it('draft collaborative 案件且雙方皆有陳述時應顯示提交按鈕且可提交（F03 draft 邊界）', async () => {
    authUser.id = 'u1';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      status: 'draft',
      mode: 'collaborative',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '被告已填寫足夠長度的陳述，符合提交條件。',
    });
    mockSubmitCase.mockResolvedValue({ ...mockCase, status: 'submitted' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
    expect(screen.getByText('caseDetail.submitCase')).toBeInTheDocument();
    expect(screen.queryByText('caseDetail.waitingForDefendant')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('caseDetail.submitCase'));
    await waitFor(() => {
      expect(mockSubmitCase).toHaveBeenCalledWith('c1');
      expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
    });
  });

  it('draft collaborative 案件且僅原告有陳述時不應顯示提交按鈕（F03-BUG-004 draft 邊界）', async () => {
    authUser.id = 'u1';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      status: 'draft',
      mode: 'collaborative',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
    expect(screen.queryByText('caseDetail.submitCase')).not.toBeInTheDocument();
    expect(screen.getByText('caseDetail.waitingForDefendant')).toBeInTheDocument();
  });

  it('submitted 案件不應顯示 submit 按鈕', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      status: 'submitted',
      mode: 'remote',
      defendant_statement: '被告陳述',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
    expect(screen.queryByText('caseDetail.submitCase')).not.toBeInTheDocument();
  });

  it('submitted 案件應顯示 viewReview 按鈕且點擊應導向 review（F03 狀態轉移）', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      status: 'submitted',
      mode: 'remote',
      defendant_statement: '被告陳述',
    });

    renderPage();

    const viewReviewBtn = await screen.findByText('caseDetail.viewReview');
    expect(viewReviewBtn).toBeInTheDocument();
    fireEvent.click(viewReviewBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
  });

  it('submitCase 失敗且無 message（非 FORBIDDEN）時應使用 message.submitCaseFail', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase.mockRejectedValue({ code: 'SERVER_ERROR' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.submitCase'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.submitCaseFail');
    });
  });

  it('submitCase FORBIDDEN 且無 message 時應顯示 message.noPermissionSubmitCase', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase.mockRejectedValue({ code: 'FORBIDDEN' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.submitCase'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.noPermissionSubmitCase');
    });
  });

  it('submitCase FORBIDDEN 時若有 message 應顯示該 message（F03 權限邊界）', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase.mockRejectedValue({ code: 'FORBIDDEN', message: '此案件已超過提交期限' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.submitCase'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('此案件已超過提交期限');
    });
  });

  it('submitCase 失敗且有 message（非 FORBIDDEN）時應顯示該 message（F10 錯誤處理約定）', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase.mockRejectedValue(new Error('案件欄位驗證失敗：標題不可為空'));

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.submitCase'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('案件欄位驗證失敗：標題不可為空');
    });
  });

  it('submitCase 失敗且 message 為空字串時應使用 submitCaseFail（F10 邊界）', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase.mockRejectedValue({ code: 'VALIDATION_ERROR', message: '' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.submitCase'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.submitCaseFail');
    });
  });

  it('submitCase 回傳 CASE_NOT_EDITABLE 時應顯示 submitCaseFail（F03 draft 邊界：案已提交 race condition）', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase.mockRejectedValue({ code: 'CASE_NOT_EDITABLE', message: '' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.submitCase'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.submitCaseFail');
    });
  });

  it('submitCase 失敗後應仍可再次點擊提交，成功後應導向 review（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase
      .mockRejectedValueOnce(new Error('服務暫時不可用'))
      .mockResolvedValueOnce({ ...mockCase, status: 'submitted' });

    renderPage();

    const submitBtn = await screen.findByText('caseDetail.submitCase');
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('服務暫時不可用');
    });
    await waitFor(() => {
      const btn = screen.getByText('caseDetail.submitCase').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('caseDetail.submitCase'));
    await waitFor(() => {
      expect(mockSubmitCase).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.submitCaseSuccess');
      expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
    });
  });

  it('submitCase 提交按鈕快速連點只會送出一次 submitCase 請求（F03 提交節流）', async () => {
    let resolveSubmit: (v: unknown) => void;
    const submitPromise = new Promise((resolve) => { resolveSubmit = resolve; });
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      defendant_statement:
        '被告也已經寫了足夠長度的正式陳述內容，這樣案件就可以直接提交進入審理流程。',
    });
    mockSubmitCase.mockImplementation(() => submitPromise as Promise<typeof mockCase>);

    renderPage();

    const submitBtn = await screen.findByText('caseDetail.submitCase');
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    expect(mockSubmitCase).toHaveBeenCalledTimes(1);
    resolveSubmit!({ ...mockCase, status: 'submitted' });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
    });
  });

  it('被告陳述過短時回覆按鈕應為 disabled（防止無效提交）', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockReturnValue({ valid: false });

    renderPage();

    const submitResponseBtn = await screen.findByRole('button', { name: /caseDetail\.submitResponse|submitResponse/ });
    expect(submitResponseBtn.closest('button') ?? submitResponseBtn).toBeDisabled();
    expect(mockUpdateCase).not.toHaveBeenCalled();
  });

  it('被告陳述 exactly 29 字時回覆按鈕應 disabled（邊界：validateStatement 30 字規則）', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockImplementation((s: string) => ({
      valid: (s?.trim?.() ?? '').length >= 30,
    }));

    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByTestId('defendant-statement-input');
    await user.type(input, 'a'.repeat(29));
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /caseDetail\.submitResponse|submitResponse/ });
      expect(btn.closest('button') ?? btn).toBeDisabled();
    });
  });

  it('被告陳述 exactly 30 字時回覆按鈕應 enabled（正邊界：validateStatement 30 字規則）', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockImplementation((s: string) => ({
      valid: (s?.trim?.() ?? '').length >= 30,
    }));

    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByTestId('defendant-statement-input');
    await user.type(input, 'a'.repeat(30));
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /caseDetail\.submitResponse|submitResponse/ });
      expect(btn.closest('button') ?? btn).not.toBeDisabled();
    });
  });

  it('被告回覆 updateCase 失敗且錯誤無 message 時應顯示 caseDetail.defendantRespondFail', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    mockUpdateCase.mockRejectedValue({ code: 'SERVER_ERROR' });

    renderPage();

    const submitResponseBtn = await screen.findByText('caseDetail.submitResponse');
    fireEvent.click(submitResponseBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('caseDetail.defendantRespondFail');
    });
  });

  it('被告回覆 updateCase 失敗且 message 為空字串時應使用 caseDetail.defendantRespondFail（F10 邊界：空 message 視為無）', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    mockUpdateCase.mockRejectedValue({ code: 'VALIDATION_ERROR', message: '' });

    renderPage();

    const submitResponseBtn = await screen.findByText('caseDetail.submitResponse');
    fireEvent.click(submitResponseBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('caseDetail.defendantRespondFail');
    });
  });

  it('被告回覆 updateCase 失敗且有 message 時應顯示該 message（F10 錯誤處理約定）', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    mockUpdateCase.mockRejectedValue(new Error('陳述內容含敏感詞彙，請修正後再試'));

    renderPage();

    const submitResponseBtn = await screen.findByText('caseDetail.submitResponse');
    fireEvent.click(submitResponseBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('陳述內容含敏感詞彙，請修正後再試');
    });
  });

  it('被告回覆 updateCase 失敗後應仍可再次點擊回覆，成功後應導向 review（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    mockUpdateCase
      .mockRejectedValueOnce(new Error('網路暫時不穩'))
      .mockResolvedValueOnce({ ...mockCase, status: 'submitted', defendant_statement: '被告陳述' });

    renderPage();

    const submitResponseBtn = await screen.findByText('caseDetail.submitResponse');
    fireEvent.click(submitResponseBtn);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('網路暫時不穩');
    });
    await waitFor(() => {
      const btn = screen.getByText('caseDetail.submitResponse').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('caseDetail.submitResponse'));
    await waitFor(() => {
      expect(mockUpdateCase).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('caseDetail.defendantRespondSuccess');
      expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
    });
  });

  it('被告回覆 updateCase FORBIDDEN 時若有 message 應顯示該 message（F03 權限邊界）', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    mockUpdateCase.mockRejectedValue({ code: 'FORBIDDEN', message: '此案件已鎖定，無法回覆' });

    renderPage();

    const submitResponseBtn = await screen.findByText('caseDetail.submitResponse');
    fireEvent.click(submitResponseBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('此案件已鎖定，無法回覆');
    });
  });

  it('被告回覆 updateCase FORBIDDEN 且無 message 時應使用 defendantRespondFail（F03 權限邊界 fallback）', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    mockUpdateCase.mockRejectedValue({ code: 'FORBIDDEN' });

    renderPage();

    const submitResponseBtn = await screen.findByText('caseDetail.submitResponse');
    fireEvent.click(submitResponseBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('caseDetail.defendantRespondFail');
    });
  });

  it('被告回覆快速連點只會送出一次 updateCase 請求', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    let resolveUpdate: (v: unknown) => void;
    const updatePromise = new Promise((resolve) => { resolveUpdate = resolve; });
    mockUpdateCase.mockImplementation(() => updatePromise as Promise<typeof mockCase>);

    renderPage();

    const submitResponseBtn = await screen.findByText('caseDetail.submitResponse');
    fireEvent.click(submitResponseBtn);
    fireEvent.click(submitResponseBtn);
    fireEvent.click(submitResponseBtn);

    await waitFor(() => {
      expect(mockUpdateCase).toHaveBeenCalledTimes(1);
    });
    resolveUpdate!({ ...mockCase, status: 'submitted', defendant_statement: '被告陳述' });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
    });
  });

  it('被告回覆成功且 status 仍為 draft 時應顯示成功但不導航（F03 狀態邊界）', async () => {
    authUser.id = 'u2';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    mockUpdateCase.mockResolvedValue({ ...mockCase, status: 'draft', defendant_statement: '被告陳述' });

    renderPage();

    const submitResponseBtn = await screen.findByText('caseDetail.submitResponse');
    fireEvent.click(submitResponseBtn);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('caseDetail.defendantRespondSuccess');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('原告視角等待被告回覆時應顯示 waitingForDefendant 提示（F03 draft 邊界）', async () => {
    authUser.id = 'u1';
    mockGetCase.mockResolvedValue({
      ...mockCase,
      mode: 'remote',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      defendant_statement: '',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('caseDetail.waitingForDefendant')).toBeInTheDocument();
    });
    expect(screen.getByText('caseDetail.waitingForDefendantDesc')).toBeInTheDocument();
    expect(screen.queryByText('caseDetail.submitResponse')).not.toBeInTheDocument();
  });

  it('completed 案件點擊查看判決成功時應導向判決頁', async () => {
    mockGetCase.mockResolvedValue({ ...mockCase, status: 'completed' });
    mockGetJudgmentByCaseId.mockResolvedValue({ id: 'j1', case_id: 'c1' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.viewJudgment'));

    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('c1');
      expect(mockNavigate).toHaveBeenCalledWith('/judgment/j1');
    });
  });

  it('completed 案件點擊查看判決但判決未就緒時應顯示 warning', async () => {
    mockGetCase.mockResolvedValue({ ...mockCase, status: 'completed' });
    mockGetJudgmentByCaseId.mockResolvedValue(null);

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.viewJudgment'));

    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('c1');
      expect(mockToastWarning).toHaveBeenCalledWith('message.judgmentNotReady');
    });
  });

  it('completed 案件點擊查看判決且 API 失敗時若有 message 應顯示該 message', async () => {
    mockGetCase.mockResolvedValue({ ...mockCase, status: 'completed' });
    mockGetJudgmentByCaseId.mockRejectedValue(new Error('取得判決失敗'));

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.viewJudgment'));

    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('c1');
      expect(mockToastError).toHaveBeenCalledWith('取得判決失敗');
    });
  });

  it('completed 案件點擊查看判決且 API 失敗且無 message 時應顯示 getJudgmentFail', async () => {
    mockGetCase.mockResolvedValue({ ...mockCase, status: 'completed' });
    mockGetJudgmentByCaseId.mockRejectedValue({ code: 'SERVER_ERROR' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.viewJudgment'));

    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('c1');
      expect(mockToastError).toHaveBeenCalledWith('message.getJudgmentFail');
    });
  });

  it('completed 案件點擊查看判決且 API 失敗且 message 為空字串時應使用 getJudgmentFail（F10 邊界）', async () => {
    mockGetCase.mockResolvedValue({ ...mockCase, status: 'completed' });
    mockGetJudgmentByCaseId.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.viewJudgment'));

    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('c1');
      expect(mockToastError).toHaveBeenCalledWith('message.getJudgmentFail');
    });
  });

  it('completed 案件點擊查看判決且 FORBIDDEN 時若有 message 應顯示該 message（F03 權限邊界）', async () => {
    mockGetCase.mockResolvedValue({ ...mockCase, status: 'completed' });
    mockGetJudgmentByCaseId.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限查看此判決' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.viewJudgment'));

    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('c1');
      expect(mockToastError).toHaveBeenCalledWith('無權限查看此判決');
    });
  });

  it('completed 案件點擊查看判決 getJudgmentByCaseId FORBIDDEN 且無 message 時應使用 getJudgmentFail（F03 權限邊界 fallback）', async () => {
    mockGetCase.mockResolvedValue({ ...mockCase, status: 'completed' });
    mockGetJudgmentByCaseId.mockRejectedValue({ code: 'FORBIDDEN' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.viewJudgment'));

    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('c1');
      expect(mockToastError).toHaveBeenCalledWith('message.getJudgmentFail');
    });
  });

  it('completed 案件點擊查看判決失敗後應仍可再次點擊，成功後應導向判決頁（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetCase.mockResolvedValue({ ...mockCase, status: 'completed' });
    mockGetJudgmentByCaseId
      .mockRejectedValueOnce(new Error('網絡暫不可用'))
      .mockResolvedValueOnce({ id: 'j1', case_id: 'c1' });

    renderPage();

    fireEvent.click(await screen.findByText('caseDetail.viewJudgment'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('網絡暫不可用');
    });
    expect(mockGetJudgmentByCaseId).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByText('caseDetail.viewJudgment'));
    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith('/judgment/j1');
    });
  });

  it('completed 案件查看判決快速連點只會送出一次 getJudgmentByCaseId 請求', async () => {
    let resolveGetJudgment: (v: unknown) => void;
    mockGetCase.mockResolvedValue({ ...mockCase, status: 'completed' });
    mockGetJudgmentByCaseId.mockImplementation(() => new Promise((resolve) => { resolveGetJudgment = resolve; }));

    renderPage();

    const viewBtn = await screen.findByText('caseDetail.viewJudgment');
    fireEvent.click(viewBtn);
    fireEvent.click(viewBtn);
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledTimes(1);
    });
    resolveGetJudgment!({ id: 'j1', case_id: 'c1' });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/judgment/j1');
    });
  });

  it('judgment_failed 案件點擊重試判決應導向 /case/:id/review', async () => {
    mockGetCase.mockResolvedValue({
      ...mockCase,
      status: 'judgment_failed',
      judgment_failure_reason: 'AI 生成超時',
    });

    renderPage();

    fireEvent.click(await screen.findByText('review.retryJudgment'));

    expect(mockNavigate).toHaveBeenCalledWith('/case/c1/review');
  });
});
