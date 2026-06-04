/**
 * QuickExperience Result 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuickExperienceResult from './index';

const {
  mockNavigate,
  mockToast,
  mockStartPolling,
  mockStopPolling,
  mockGetJudgmentByCaseId,
  mockGenerateJudgment,
  mockGetCase,
  mockUploadEvidence,
  mockCaseSessionMapGet,
  mockCaseSessionMapRemove,
  mockSessionStorageGet,
  mockConnectAIStream,
  mockUseJudgmentStore,
  mockUseSessionStore,
  usePollingTestHelper,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  mockStartPolling: vi.fn(),
  mockStopPolling: vi.fn(),
  mockGetJudgmentByCaseId: vi.fn(),
  mockGenerateJudgment: vi.fn(),
  mockGetCase: vi.fn(),
  mockUploadEvidence: vi.fn(),
  mockCaseSessionMapGet: vi.fn().mockReturnValue('session-case-1'),
  mockCaseSessionMapRemove: vi.fn(),
  mockSessionStorageGet: vi.fn().mockReturnValue('session-global'),
  mockConnectAIStream: vi.fn(),
  mockUseJudgmentStore: { isLoading: false, error: null as string | null },
  mockUseSessionStore: { session: { session_id: 'session-store-1' } as { session_id?: string } },
  usePollingTestHelper: { runFnOnStart: false, capturedFn: null as (() => Promise<unknown>) | null },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
  getLocale: () => 'zh-TW',
}));
const mockGetContentList = vi.fn().mockResolvedValue([]);
vi.mock('@/services/api/content', () => ({
  getContentList: (...args: unknown[]) => mockGetContentList(...args),
}));
vi.mock('@/services/aiStream', () => ({
  connectAIStream: (...args: unknown[]) => mockConnectAIStream(...args),
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});
vi.mock('sonner', () => ({
  toast: mockToast,
}));
vi.mock('@/store/judgmentStore', () => ({
  useJudgmentStore: () => mockUseJudgmentStore,
}));
vi.mock('@/store/sessionStore', () => ({
  useSessionStore: () => mockUseSessionStore,
}));
vi.mock('@/services/api/judgment', () => ({
  getJudgmentByCaseId: (...args: unknown[]) => mockGetJudgmentByCaseId(...args),
  generateJudgment: (...args: unknown[]) => mockGenerateJudgment(...args),
}));
vi.mock('@/services/api/case', () => ({
  getCase: (...args: unknown[]) => mockGetCase(...args),
  uploadEvidence: (...args: unknown[]) => mockUploadEvidence(...args),
}));
vi.mock('@/utils/storage', () => ({
  sessionStorage: { get: mockSessionStorageGet, set: vi.fn() },
  caseSessionMap: { get: mockCaseSessionMapGet, set: vi.fn(), remove: mockCaseSessionMapRemove, clear: vi.fn() },
}));
vi.mock('@/hooks/usePolling', () => ({
  usePolling: (fn: () => Promise<unknown>) => {
    if (usePollingTestHelper.runFnOnStart) {
      usePollingTestHelper.capturedFn = fn;
      return {
        startPolling: () => { usePollingTestHelper.capturedFn?.().catch(() => {}); },
        stopPolling: mockStopPolling,
        isPolling: false,
      };
    }
    return {
      startPolling: mockStartPolling,
      stopPolling: mockStopPolling,
      isPolling: false,
    };
  },
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('./components/ResultHeader', () => ({ default: () => <div>ResultHeader</div> }));
vi.mock('./components/SummarySection', () => ({ default: () => <div>SummarySection</div> }));
vi.mock('./components/ResponsibilitySection', () => ({
  default: ({ ratio }: { ratio: { plaintiff: number; defendant: number } }) => (
    <div>ResponsibilitySection:{ratio.plaintiff}/{ratio.defendant}</div>
  ),
}));
vi.mock('./components/JudgmentSection', () => ({ default: () => <div>JudgmentSection</div> }));
vi.mock('./components/EvidenceUploadSection', () => ({
  default: ({
    onUploadFiles,
    status,
  }: {
    onUploadFiles: (files: File[]) => void;
    status?: 'success' | 'failed' | 'pending' | null;
  }) => (
    <div>
      <div>{`evidence-status-${status ?? 'none'}`}</div>
      <button onClick={() => onUploadFiles([new File(['x'], 'e.jpg', { type: 'image/jpeg' })])}>
        upload-evidence
      </button>
      <button onClick={() => onUploadFiles([])}>upload-empty</button>
    </div>
  ),
}));
vi.mock('./components/RegisterPromptSection', () => ({
  default: ({
    show,
    onRegister,
    onClose,
  }: {
    show: boolean;
    onRegister: () => void;
    onClose: () => void;
  }) =>
    show ? (
      <div>
        <button onClick={onRegister}>register-prompt-register</button>
        <button onClick={onClose}>register-prompt-close</button>
      </div>
    ) : null,
}));

function renderWithRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/quick-experience/result/:id" element={<QuickExperienceResult />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderNoParamRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<QuickExperienceResult />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('QuickExperienceResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContentList.mockResolvedValue([]);
    usePollingTestHelper.runFnOnStart = false;
    usePollingTestHelper.capturedFn = null;
    mockUseJudgmentStore.isLoading = false;
    mockUseJudgmentStore.error = null;
    mockUseSessionStore.session = { session_id: 'session-store-1' };
    mockCaseSessionMapGet.mockReturnValue('session-case-1');
    mockSessionStorageGet.mockReturnValue('session-global');
    mockGetCase.mockResolvedValue({
      id: 'case-1',
      status: 'completed',
      evidences: [{ id: 'e1' }],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockResolvedValue({
      id: 'j1',
      summary: 'summary',
      judgment_content: 'content',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
      responsibility_ratio: { plaintiff: 60, defendant: 40 },
    });
    mockUploadEvidence.mockResolvedValue([]);
    mockConnectAIStream.mockResolvedValue(() => {});
  });

  it('應掛載並顯示結果區塊', async () => {
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('ResultHeader')).toBeInTheDocument();
    expect(screen.getByText('SummarySection')).toBeInTheDocument();
  });

  it('collaborative 案件（mode=collaborative）在 result 頁應可正確載入（F02 result 回訪：與 F01 共用 Result 頁）', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-collab',
      mode: 'collaborative',
      status: 'completed',
      evidences: [{ id: 'e1' }],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockResolvedValueOnce({
      id: 'j1',
      summary: 'collab-summary',
      judgment_content: 'collab-content',
      plaintiff_ratio: 55,
      defendant_ratio: 45,
      responsibility_ratio: { plaintiff: 55, defendant: 45 },
    });
    renderWithRoute('/quick-experience/result/case-collab');
    expect(await screen.findByText('ResultHeader')).toBeInTheDocument();
    expect(screen.getByText('SummarySection')).toBeInTheDocument();
    expect(screen.getByText('JudgmentSection')).toBeInTheDocument();
    expect(screen.getByText('ResponsibilitySection:55/45')).toBeInTheDocument();
  });

  it('safety_support 判決不應展示比例卡（F02-BUG-002：安全場景不得呈現對稱責任分配）', async () => {
    mockGetJudgmentByCaseId.mockResolvedValueOnce({
      id: 'j-safety',
      summary: 'safety-summary',
      judgment_content: 'safety-content',
      plaintiff_ratio: 20,
      defendant_ratio: 80,
      responsibility_ratio: { plaintiff: 20, defendant: 80 },
      judgment_route: 'safety_support',
    });

    renderWithRoute('/quick-experience/result/case-1');

    expect(await screen.findByText('ResultHeader')).toBeInTheDocument();
    expect(screen.getByText('SummarySection')).toBeInTheDocument();
    expect(screen.getByText('JudgmentSection')).toBeInTheDocument();
    expect(screen.queryByText('ResponsibilitySection:20/80')).not.toBeInTheDocument();
  });

  it('getContentList 失敗時應不影響頁面渲染（tips 非關鍵，F01 邊界）', async () => {
    mockGetContentList.mockRejectedValueOnce(new Error('content load fail'));
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('ResultHeader')).toBeInTheDocument();
    expect(screen.getByText('SummarySection')).toBeInTheDocument();
  });

  it('初次讀取應優先使用 caseSessionMap 的 session 查詢案件與判決', async () => {
    renderWithRoute('/quick-experience/result/case-1');

    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledWith('case-1', 'session-case-1');
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('case-1', 'session-case-1');
    });
  });

  it('缺少 caseSessionMap 時應回退使用全局 sessionStorage', async () => {
    mockCaseSessionMapGet.mockReturnValueOnce(null);
    mockSessionStorageGet.mockReturnValueOnce('session-global-fallback');

    renderWithRoute('/quick-experience/result/case-1');

    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledWith('case-1', 'session-global-fallback');
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('case-1', 'session-global-fallback');
    });
  });

  it('缺少 caseSessionMap 與全局 session 時應回退使用 store session', async () => {
    mockCaseSessionMapGet.mockReturnValueOnce(null);
    mockSessionStorageGet.mockReturnValueOnce(null);
    mockUseSessionStore.session = { session_id: 'session-store-fallback' };

    renderWithRoute('/quick-experience/result/case-1');

    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalledWith('case-1', 'session-store-fallback');
      expect(mockGetJudgmentByCaseId).toHaveBeenCalledWith('case-1', 'session-store-fallback');
    });
  });

  it('isLoading 且尚無判決時應顯示分析中動畫', async () => {
    mockUseJudgmentStore.isLoading = true;
    mockGetJudgmentByCaseId.mockResolvedValueOnce(null);
    renderWithRoute('/quick-experience/result/case-1');
    // t() is mocked to return keys; component uses quickResult.analyzingTitle
    expect(await screen.findByText('quickResult.analyzingTitle')).toBeInTheDocument();
  });

  it('store error 且尚無判決時應顯示錯誤並可返回創建頁', async () => {
    mockUseJudgmentStore.error = 'store-error';
    mockGetJudgmentByCaseId.mockResolvedValueOnce(null);
    renderWithRoute('/quick-experience/result/case-1');
    const backBtn = await screen.findByText('error.back');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('案件 404 時應顯示 caseNotFoundOrExpired、清理映射並跳轉創建頁（F01 案件不存在/過期反饋）', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'NOT_FOUND' });
    renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith('message.caseNotFoundOrExpired');
      expect(mockCaseSessionMapRemove).toHaveBeenCalledWith('case-1');
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create', { replace: true });
    });
  });

  it('案件 HTTP_404 時也應顯示 caseNotFoundOrExpired、清理映射並跳轉創建頁（F01 案件不存在/過期反饋）', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'HTTP_404' });
    renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith('message.caseNotFoundOrExpired');
      expect(mockCaseSessionMapRemove).toHaveBeenCalledWith('case-1');
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create', { replace: true });
    });
  });

  it('案件查詢一般錯誤時不應跳轉創建頁', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'UNKNOWN' });
    renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/quick-experience/create', { replace: true });
  });

  it('getCase 與 getJudgmentByCaseId 皆失敗時應顯示錯誤並可點擊 retry 或返回創建頁', async () => {
    mockGetCase.mockRejectedValue({ code: 'UNKNOWN' });
    mockGetJudgmentByCaseId.mockRejectedValue({ code: 'NETWORK_ERROR', message: 'network err' });
    renderWithRoute('/quick-experience/result/case-1');
    const backBtn = await screen.findByText('error.back');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('getCase 與 getJudgmentByCaseId 皆失敗時點擊 retry 應呼叫 startPolling 以重新嘗試載入（F01 錯誤恢復：retry 觸發輪詢）', async () => {
    mockGetCase.mockRejectedValue({ code: 'UNKNOWN' });
    mockGetJudgmentByCaseId.mockRejectedValue({ code: 'NETWORK_ERROR', message: 'network err' });
    renderWithRoute('/quick-experience/result/case-1');
    const retryBtn = await screen.findByText('error.retry');
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockStartPolling).toHaveBeenCalled();
    });
  });

  it('getCase 與 getJudgmentByCaseId 皆失敗時點擊 retry 成功後應顯示判決內容（F01 錯誤恢復：retry 成功閉環）', async () => {
    mockGetCase.mockRejectedValue({ code: 'UNKNOWN' });
    const successJudgment = {
      id: 'j-retry',
      summary: 'retry-summary',
      judgment_content: 'retry-content',
      plaintiff_ratio: 70,
      defendant_ratio: 30,
      responsibility_ratio: { plaintiff: 70, defendant: 30 },
    };
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'network err' }).mockResolvedValueOnce(successJudgment);
    usePollingTestHelper.runFnOnStart = true;
    renderWithRoute('/quick-experience/result/case-1');
    const retryBtn = await screen.findByText('error.retry');
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(screen.getByText('SummarySection')).toBeInTheDocument();
      expect(screen.getByText('JudgmentSection')).toBeInTheDocument();
      expect(screen.getByText('ResponsibilitySection:70/30')).toBeInTheDocument();
    });
  });

  it('fetchCase 成功但組件已卸載時不應 setState（useMountedRef 回歸：F01-OPT-002）', async () => {
    let resolveGetCase: (v: unknown) => void;
    mockGetCase.mockImplementation(
      () => new Promise((resolve) => { resolveGetCase = resolve; })
    );
    const { unmount } = renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalled();
    });
    unmount();
    resolveGetCase!({
      id: 'case-1',
      status: 'completed',
      evidences: [],
    });
    await Promise.resolve();
    await Promise.resolve();
  });

  it('fetchCase 返回 NOT_FOUND 但組件已卸載時不應 navigate 或 message（useMountedRef 回歸：F01-OPT-002）', async () => {
    let rejectGetCase: (v: unknown) => void;
    mockGetCase.mockImplementation(
      () => new Promise((_, reject) => { rejectGetCase = reject; })
    );
    const { unmount } = renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
      expect(mockGetCase).toHaveBeenCalled();
    });
    unmount();
    rejectGetCase!({ code: 'NOT_FOUND' });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockToast.warning).not.toHaveBeenCalled();
  });

  it('輪詢獲取判決成功但組件已卸載時不應 setState（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveGetJudgment: (v: unknown) => void;
    mockGetJudgmentByCaseId.mockImplementation(
      () => new Promise((resolve) => { resolveGetJudgment = resolve; })
    );
    mockGetCase.mockResolvedValue({
      id: 'case-1',
      status: 'in_progress',
      evidences: [],
    });
    const { unmount } = renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
      expect(mockGetJudgmentByCaseId).toHaveBeenCalled();
    });
    unmount();
    resolveGetJudgment!({
      id: 'j-1',
      summary: 's',
      judgment_content: 'c',
      plaintiff_ratio: 50,
      defendant_ratio: 50,
      responsibility_ratio: { plaintiff: 50, defendant: 50 },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('judgment_failed 時 retry 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'judgment_failed',
      evidences: [],
      judgment_failure_reason: 'ai timeout',
    });
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_FAILED', message: 'failed' });
    let resolveGenerate: (v: unknown) => void;
    mockGenerateJudgment.mockImplementation(
      () => new Promise((resolve) => { resolveGenerate = resolve; })
    );
    const { unmount } = renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('error.retry'));
    await waitFor(() => {
      expect(mockGenerateJudgment).toHaveBeenCalledWith('case-1', 'session-case-1');
    });
    unmount();
    resolveGenerate!({});
    await Promise.resolve();
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('判決失敗時點擊重試應調用 generateJudgment 並重啟輪詢', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'judgment_failed',
      evidences: [],
      judgment_failure_reason: 'ai timeout',
    });
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_FAILED', message: 'failed' });
    renderWithRoute('/quick-experience/result/case-1');
    const retryBtn = await screen.findByText('error.retry');
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGenerateJudgment).toHaveBeenCalledWith('case-1', 'session-case-1');
      expect(mockStartPolling).toHaveBeenCalled();
    });
  });

  it('重試判決在無任何 sessionId 時應以 undefined 調用 generateJudgment', async () => {
    mockCaseSessionMapGet.mockReturnValue(null);
    mockSessionStorageGet.mockReturnValue(null);
    mockUseSessionStore.session = {};
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'judgment_failed',
      evidences: [],
      judgment_failure_reason: 'ai timeout',
    });
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_FAILED', message: 'failed' });
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('error.retry'));
    await waitFor(() => {
      expect(mockGenerateJudgment).toHaveBeenCalledWith('case-1', undefined);
    });
  });

  it('session 過期錯誤時應提供重新開始按鈕並停止輪詢', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'SESSION_EXPIRED', message: 'expired' });
    renderWithRoute('/quick-experience/result/case-1');
    const restartBtn = await screen.findByText('result.restart');
    expect(mockStopPolling).toHaveBeenCalled();
    fireEvent.click(restartBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('SESSION_EXPIRED 時應停止輪詢，避免持續請求', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'SESSION_EXPIRED', message: 'expired' });
    renderWithRoute('/quick-experience/result/case-1');
    await screen.findByText('result.restart');
    expect(mockStopPolling).toHaveBeenCalled();
  });

  it('session 過期且 message 為空時應顯示 expiredHint fallback', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'SESSION_EXPIRED', message: '' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('error.session.expiredHint')).toBeInTheDocument();
  });

  it('session 錯誤缺少 message 時應顯示 expiredHint fallback', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'SESSION_ID_REQUIRED' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('error.session.expiredHint')).toBeInTheDocument();
  });

  it('INVALID_SESSION_ID 時應顯示受控 session fallback 並可重新開始', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'INVALID_SESSION_ID', message: 'session invalid' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('error.session.expiredHint')).toBeInTheDocument();
    fireEvent.click(screen.getByText('result.restart'));
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('session 過期錯誤時應提供登入與註冊回訪出口，並保留當前 result 路徑', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'SESSION_EXPIRED', message: 'expired' });
    renderWithRoute('/quick-experience/result/case-1');

    fireEvent.click(await screen.findByText('auth.login.submit'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', {
      state: { from: { pathname: '/quick-experience/result/case-1' } },
    });

    fireEvent.click(screen.getByText('register.action.now'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register', {
      state: { from: { pathname: '/quick-experience/result/case-1' } },
    });
  });

  it('判決 pending 類錯誤碼不應直接顯示錯誤頁', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_NOT_FOUND' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('pending.long.message')).toBeInTheDocument();
    expect(screen.queryByText('error.fetch.title')).not.toBeInTheDocument();
  });

  it('無案件 id 時應提示並導回 create', async () => {
    renderNoParamRoute('/quick-experience/result');
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('message.caseIdMissing');
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
    });
  });

  it('一般抓取錯誤時點擊重試應重啟輪詢', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'UNKNOWN', message: 'boom' });
    renderWithRoute('/quick-experience/result/case-1');
    const retryBtn = await screen.findByText('error.retry');
    fireEvent.click(retryBtn);
    expect(mockStartPolling).toHaveBeenCalled();
  });

  it('未知錯誤且 message 為空時應顯示 getJudgmentFail fallback（F10：空 message 視為無）', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'UNKNOWN', message: '' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('message.getJudgmentFail')).toBeInTheDocument();
  });

  it('未知錯誤缺少 code/message 時應顯示 getJudgmentFail fallback', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({});
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('message.getJudgmentFail')).toBeInTheDocument();
  });

  it('FORBIDDEN 錯誤應顯示受控權限 fallback 且不誤判為 pending', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'FORBIDDEN', message: '無權限訪問此判決' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('common.forbidden')).toBeInTheDocument();
    expect(screen.queryByText('pending.long.message')).not.toBeInTheDocument();
  });

  it('retry 判決失敗且錯誤非 Error 時應使用 fallback 文案', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'judgment_failed',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_FAILED', message: 'failed' });
    mockGenerateJudgment.mockRejectedValueOnce('bad-retry');
    renderWithRoute('/quick-experience/result/case-1');
    const retryBtn = await screen.findByText('error.retry');
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('message.retryFail');
    });
  });

  it('retry 判決失敗且 message 為空字串時應使用受控 code fallback（F10 邊界）', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'judgment_failed',
    });
    mockGetJudgmentByCaseId.mockResolvedValueOnce(null);
    mockGenerateJudgment.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    renderWithRoute('/quick-experience/result/case-1');
    const retryBtn = await screen.findByText('error.retry');
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('common.serverError');
    });
  });

  it('judgment_failed 時 retry，generateJudgment FORBIDDEN 且無 message 時應使用受控權限 fallback（F01 權限邊界）', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'judgment_failed',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_FAILED', message: 'failed' });
    mockGenerateJudgment.mockRejectedValueOnce({ code: 'FORBIDDEN' });
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('error.retry'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('common.forbidden');
    });
  });

  it('retry 判決失敗且錯誤為 Error 時應使用 retryFail fallback', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'judgment_failed',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_FAILED', message: 'failed' });
    mockGenerateJudgment.mockRejectedValueOnce(new Error('retry exploded'));
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('error.retry'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('message.retryFail');
    });
  });

  it('judgment_failed 時 retry 快速連點只會送出一次 generateJudgment 請求（F01 重試節流）', async () => {
    mockGetCase.mockResolvedValue({
      id: 'case-1',
      status: 'judgment_failed',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockRejectedValue({ code: 'JUDGMENT_FAILED', message: 'failed' });
    let resolveGen: (v: unknown) => void;
    mockGenerateJudgment.mockImplementation(
      () => new Promise((resolve) => { resolveGen = resolve; })
    );
    renderWithRoute('/quick-experience/result/case-1');
    const retryBtn = await screen.findByText('error.retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGenerateJudgment).toHaveBeenCalledTimes(1);
    });
    resolveGen!({ id: 'j1', plaintiff_ratio: 50, defendant_ratio: 50 });
    await waitFor(() => {
      expect(mockStartPolling).toHaveBeenCalled();
    });
  });

  it('JUDGMENT_FAILED 且空 message/無 failure reason 時應顯示 judgmentRetryHint fallback（F10：空 message 視為無）', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'completed',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_FAILED', message: '' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('message.judgmentRetryHint')).toBeInTheDocument();
  });

  it('JUDGMENT_FAILED 缺少 message 時應顯示 judgmentRetryHint fallback', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'completed',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_FAILED' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('message.judgmentRetryHint')).toBeInTheDocument();
  });

  it('stream.failed 固定 invalid response 訊息應轉為目前語言 fallback，而非直出英文診斷字串', async () => {
    mockGetJudgmentByCaseId.mockResolvedValueOnce(null);
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'submitted',
      evidences: [],
      judgment_failure_reason: null,
    });

    renderWithRoute('/quick-experience/result/case-1');

    await waitFor(() => {
      expect(mockConnectAIStream).toHaveBeenCalled();
    });
    const callbacks = mockConnectAIStream.mock.calls[0][2] as {
      onEvent?: (event: {
        eventType: string;
        streamId: string;
        requestId: string;
        scopeType: string;
        scopeId: string;
        seq: number;
        createdAt: string;
        error?: { code: string; message: string };
      }) => void;
    };

    await act(async () => {
      callbacks.onEvent?.({
        eventType: 'stream.failed',
        streamId: 'stream-1',
        requestId: 'request-1',
        scopeType: 'case_judgment',
        scopeId: 'case-1',
        seq: 1,
        createdAt: '2026-06-04T00:00:00.000Z',
        error: {
          code: 'INVALID_RESPONSE',
          message: 'Invalid judgment response from server',
        },
      });
    });

    expect(await screen.findByText('apiError.invalidResponse')).toBeInTheDocument();
    expect(screen.queryByText('Invalid judgment response from server')).not.toBeInTheDocument();
  });

  it('長時間等待分支應顯示等待/重生/返回操作', async () => {
    mockGetJudgmentByCaseId.mockResolvedValueOnce(null);
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'submitted',
      evidences: [],
      judgment_failure_reason: null,
    });
    renderWithRoute('/quick-experience/result/case-1');
    const waitBtn = await screen.findByText('pending.long.action.wait');
    fireEvent.click(waitBtn);
    expect(mockStartPolling).toHaveBeenCalled();

    const regenBtn = screen.getByText('pending.long.action.regen');
    fireEvent.click(regenBtn);
    await waitFor(() => {
      expect(mockGenerateJudgment).toHaveBeenCalledWith('case-1', 'session-case-1');
    });

    fireEvent.click(screen.getByText('pending.long.action.back'));
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('長時間等待分支點擊重新生成成功後應顯示判決內容（F01 錯誤恢復：重新生成成功閉環）', async () => {
    const successJudgment = {
      id: 'j-regen',
      summary: 'regen-summary',
      judgment_content: 'regen-content',
      plaintiff_ratio: 65,
      defendant_ratio: 35,
      responsibility_ratio: { plaintiff: 65, defendant: 35 },
    };
    mockGetJudgmentByCaseId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(successJudgment);
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'submitted',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGenerateJudgment.mockResolvedValue({});
    usePollingTestHelper.runFnOnStart = true;
    renderWithRoute('/quick-experience/result/case-1');
    const regenBtn = await screen.findByText('pending.long.action.regen');
    expect(mockGenerateJudgment).not.toHaveBeenCalled();
    fireEvent.click(regenBtn);
    await waitFor(
      () => {
        expect(mockGenerateJudgment).toHaveBeenCalledWith('case-1', 'session-case-1');
        expect(screen.getByText('SummarySection')).toBeInTheDocument();
        expect(screen.getByText('ResponsibilitySection:65/35')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('長時間等待分支點擊繼續等待成功後應顯示判決內容（F01 錯誤恢復：繼續等待成功閉環）', async () => {
    const successJudgment = {
      id: 'j-wait',
      summary: 'wait-summary',
      judgment_content: 'wait-content',
      plaintiff_ratio: 55,
      defendant_ratio: 45,
      responsibility_ratio: { plaintiff: 55, defendant: 45 },
    };
    mockGetJudgmentByCaseId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(successJudgment);
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'submitted',
      evidences: [],
      judgment_failure_reason: null,
    });
    usePollingTestHelper.runFnOnStart = true;
    renderWithRoute('/quick-experience/result/case-1');
    const waitBtn = await screen.findByText('pending.long.action.wait');
    fireEvent.click(waitBtn);
    await waitFor(
      () => {
        expect(screen.getByText('SummarySection')).toBeInTheDocument();
        expect(screen.getByText('JudgmentSection')).toBeInTheDocument();
        expect(screen.getByText('ResponsibilitySection:55/45')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('證據上傳缺少 sessionId 時應報錯且不調 uploadEvidence', async () => {
    mockCaseSessionMapGet.mockReturnValue(null);
    mockSessionStorageGet.mockReturnValue(null);
    mockUseSessionStore.session = {};
    renderWithRoute('/quick-experience/result/case-1');
    const uploadBtn = await screen.findByText('upload-evidence');
    fireEvent.click(uploadBtn);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
    expect(mockUploadEvidence).not.toHaveBeenCalled();
  });

  it('證據上傳空列表時應提示選擇檔案', async () => {
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-empty'));
    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith('message.selectFile');
    });
  });

  it('證據上傳成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveUpload: () => void;
    mockUploadEvidence.mockImplementation(
      () => new Promise<void>((resolve) => { resolveUpload = resolve; })
    );
    const { unmount } = renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-evidence'));
    await waitFor(() => {
      expect(mockUploadEvidence).toHaveBeenCalledWith(
        'case-1',
        expect.any(Array),
        'session-case-1'
      );
    });
    unmount();
    resolveUpload!();
    await Promise.resolve();
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('證據上傳成功時應調用 uploadEvidence、清除 pending 標記並呼叫 fetchCase 刷新案件', async () => {
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    renderWithRoute('/quick-experience/result/case-1');
    const initialGetCaseCalls = mockGetCase.mock.calls.length;
    const uploadBtn = await screen.findByText('upload-evidence');
    fireEvent.click(uploadBtn);
    await waitFor(() => {
      expect(mockUploadEvidence).toHaveBeenCalledWith(
        'case-1',
        expect.any(Array),
        'session-case-1'
      );
    });
    expect(removeSpy).toHaveBeenCalledWith('pending_evidence_case-1');
    await waitFor(() => {
      expect(mockGetCase.mock.calls.length).toBeGreaterThan(initialGetCaseCalls);
    });
  });

  it('證據上傳成功但 fetchCase 失敗時應保持 success 狀態且不顯示上傳失敗', async () => {
    mockGetCase
      .mockResolvedValueOnce({
        id: 'case-1',
        status: 'completed',
        evidences: [],
        judgment_failure_reason: null,
      })
      .mockRejectedValueOnce(new Error('refresh failed'));
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-evidence'));
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('message.evidenceUploadSuccess');
    });
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(await screen.findByText('evidence-status-success')).toBeInTheDocument();
  });

  it('證據上傳失敗且錯誤非 Error 時應使用 fallback 文案', async () => {
    mockUploadEvidence.mockRejectedValueOnce('upload-fail-non-error');
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-evidence'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('message.evidenceUploadFail');
    });
  });

  it('證據上傳 FORBIDDEN 時應顯示受控權限 fallback（F01 權限邊界）', async () => {
    mockUploadEvidence.mockRejectedValueOnce({ code: 'FORBIDDEN', message: '此案件已無法補交證據' });
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-evidence'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('common.forbidden');
    });
  });

  it('證據上傳 FORBIDDEN 且無 message 時應使用受控權限 fallback（F01 權限邊界）', async () => {
    mockUploadEvidence.mockRejectedValueOnce({ code: 'FORBIDDEN' });
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-evidence'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('common.forbidden');
    });
  });

  it('證據上傳失敗且 message 為空字串時應使用受控 code fallback（F10 邊界：空 message 視為無）', async () => {
    mockUploadEvidence.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-evidence'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('common.serverError');
    });
  });

  it('證據上傳失敗後應仍可再次點擊上傳，成功後應顯示成功（F01 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetCase.mockResolvedValue({
      id: 'case-1',
      status: 'submitted',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockUploadEvidence
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValueOnce([]);
    renderWithRoute('/quick-experience/result/case-1');
    const uploadBtn = await screen.findByText('upload-evidence');
    fireEvent.click(uploadBtn);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
    fireEvent.click(uploadBtn);
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('message.evidenceUploadSuccess');
    });
    expect(mockUploadEvidence).toHaveBeenCalledTimes(2);
  });

  it('案件無證據且存在 pending 標記時應讀取 pending 狀態並顯示 evidence-status-pending（F01 evidence 回訪）', async () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('true');
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'submitted',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockResolvedValueOnce({
      id: 'j-pending-evidence',
      summary: 'summary',
      judgment_content: 'content',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
      responsibility_ratio: { plaintiff: 60, defendant: 40 },
    });
    renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith('pending_evidence_case-1');
    });
    expect(await screen.findByText('evidence-status-pending')).toBeInTheDocument();
    getSpy.mockRestore();
  });

  it('案件 completed 時不顯示 evidence 上傳區塊（F01 evidence 回訪邊界：completed 不可上傳）', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'completed',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockResolvedValueOnce({
      id: 'j-completed',
      summary: 'summary',
      judgment_content: 'content',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
      responsibility_ratio: { plaintiff: 60, defendant: 40 },
    });
    renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
      expect(screen.getByText('ResponsibilitySection:60/40')).toBeInTheDocument();
    });
    expect(screen.getByText('evidence-status-none')).toBeInTheDocument();
    expect(screen.queryByText('evidence-status-pending')).not.toBeInTheDocument();
  });

  it('案件可上傳且已有證據時應設置 evidence status 為 success', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'submitted',
      evidences: [{ id: 'e1' }],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockResolvedValueOnce({
      id: 'j-with-evidence',
      summary: 'summary',
      judgment_content: 'content',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
      responsibility_ratio: { plaintiff: 60, defendant: 40 },
    });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('evidence-status-success')).toBeInTheDocument();
  });

  it('getCase 回傳 evidences 為非陣列時應不崩潰且不誤設 success（F01 邊界：API 回傳不完整時防禦）', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'submitted',
      evidences: 'invalid' as unknown as unknown[],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockResolvedValueOnce({
      id: 'j1',
      summary: 'summary',
      judgment_content: 'content',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
      responsibility_ratio: { plaintiff: 60, defendant: 40 },
    });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('ResultHeader')).toBeInTheDocument();
    expect(screen.getByText('SummarySection')).toBeInTheDocument();
  });

  it('判決缺少 responsibility_ratio 時應回退使用 plaintiff/defendant ratio', async () => {
    mockGetJudgmentByCaseId.mockResolvedValueOnce({
      id: 'j-fallback',
      summary: 'summary',
      judgment_content: 'content',
      plaintiff_ratio: 55,
      defendant_ratio: 45,
      responsibility_ratio: null,
    });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('ResponsibilitySection:55/45')).toBeInTheDocument();
  });

  it('主要按鈕應可導向註冊、登入與返回創建頁', async () => {
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText(/register\.action\.now/));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register', {
      state: { from: { pathname: '/quick-experience/result/case-1' } },
    });
    fireEvent.click(screen.getByText('auth.login.submit'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', {
      state: { from: { pathname: '/quick-experience/result/case-1' } },
    });
    fireEvent.click(screen.getByText(/quickCreate\.recoveredCase\.startNew/));
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('證據上傳在缺少 map/global session 時應回退使用 store session', async () => {
    mockCaseSessionMapGet.mockReturnValue(null);
    mockSessionStorageGet.mockReturnValue(null);
    mockUseSessionStore.session = { session_id: 'session-store-upload' };

    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-evidence'));

    await waitFor(() => {
      expect(mockUploadEvidence).toHaveBeenCalledWith(
        'case-1',
        expect.any(Array),
        'session-store-upload'
      );
    });
  });

  it('證據上傳在 caseSessionMap、sessionStorage、store session 三源都缺失時應顯示 sessionIdMissing 且不調用 uploadEvidence（F01 邊界）', async () => {
    mockCaseSessionMapGet.mockReturnValue(null);
    mockSessionStorageGet.mockReturnValue(null);
    mockUseSessionStore.session = null as unknown as { session_id?: string };

    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-evidence'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('message.sessionIdMissing');
    });
    expect(mockUploadEvidence).not.toHaveBeenCalled();
  });

  it('證據上傳失敗時應保留 pending 標記並提示錯誤', async () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    mockUploadEvidence.mockRejectedValueOnce(new Error('upload failed'));
    renderWithRoute('/quick-experience/result/case-1');
    const uploadBtn = await screen.findByText('upload-evidence');
    fireEvent.click(uploadBtn);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
    expect(setSpy).toHaveBeenCalledWith('pending_evidence_case-1', 'true');
  });

  it('RegisterPrompt 可觸發註冊與關閉', async () => {
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('register-prompt-register'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register', {
      state: { from: { pathname: '/quick-experience/result/case-1' } },
    });
    fireEvent.click(screen.getByText('register-prompt-close'));
    await waitFor(() => {
      expect(screen.queryByText('register-prompt-register')).not.toBeInTheDocument();
    });
  });
});
