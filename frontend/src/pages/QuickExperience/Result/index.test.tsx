/**
 * QuickExperience Result 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuickExperienceResult from './index';

const {
  mockNavigate,
  mockMessage,
  mockStartPolling,
  mockStopPolling,
  mockGetJudgmentByCaseId,
  mockGenerateJudgment,
  mockGetCase,
  mockUploadEvidence,
  mockCaseSessionMapGet,
  mockCaseSessionMapRemove,
  mockSessionStorageGet,
  mockUseJudgmentStore,
  mockUseSessionStore,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockMessage: {
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
  mockUseJudgmentStore: { isLoading: false, error: null as string | null },
  mockUseSessionStore: { session: { session_id: 'session-store-1' } as { session_id?: string } },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
  getLocale: () => 'zh-TW',
}));
vi.mock('@/services/api/content', () => ({
  getContentList: vi.fn().mockResolvedValue([]),
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});
	vi.mock('antd', () => {
	  return {
	    Typography: { Text: ({ children }: { children: unknown }) => <span>{children}</span> },
	    Spin: ({ description }: { description?: string }) => <div>{description || 'spin'}</div>,
	    Alert: ({
	      title,
	      message,
	      description,
	      action,
	    }: {
	      title?: unknown;
	      message?: unknown;
	      description?: unknown;
	      action?: unknown;
	    }) => (
	      <div>
	        <div>{title ?? message}</div>
	        <div>{description}</div>
	        <div>{action}</div>
	      </div>
	    ),
    Button: ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>,
    Space: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    message: mockMessage,
  };
});
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
  usePolling: () => ({
    startPolling: mockStartPolling,
    stopPolling: mockStopPolling,
    isPolling: false,
  }),
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
  });

  it('應掛載並顯示結果區塊', async () => {
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('ResultHeader')).toBeInTheDocument();
    expect(screen.getByText('SummarySection')).toBeInTheDocument();
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

  it('案件 404 時應清理映射並跳轉創建頁', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'NOT_FOUND' });
    renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
      expect(mockCaseSessionMapRemove).toHaveBeenCalledWith('case-1');
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create', { replace: true });
    });
  });

  it('案件 HTTP_404 時也應清理映射並跳轉創建頁', async () => {
    mockGetCase.mockRejectedValueOnce({ code: 'HTTP_404' });
    renderWithRoute('/quick-experience/result/case-1');
    await waitFor(() => {
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

  it('session 過期錯誤時應提供重新開始按鈕', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'SESSION_EXPIRED', message: 'expired' });
    renderWithRoute('/quick-experience/result/case-1');
    const restartBtn = await screen.findByText('result.restart');
    fireEvent.click(restartBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
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

  it('判決 pending 類錯誤碼不應直接顯示錯誤頁', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_NOT_FOUND' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('pending.long.message')).toBeInTheDocument();
    expect(screen.queryByText('error.fetch.title')).not.toBeInTheDocument();
  });

  it('無案件 id 時應提示並導回 create', async () => {
    renderNoParamRoute('/quick-experience/result');
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('message.caseIdMissing');
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

  it('未知錯誤且 message 為空時應顯示 retryOrLater fallback', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'UNKNOWN', message: '' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('message.retryOrLater')).toBeInTheDocument();
  });

  it('未知錯誤缺少 code/message 時應顯示 getJudgmentFail fallback', async () => {
    mockGetJudgmentByCaseId.mockRejectedValueOnce({});
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('message.getJudgmentFail')).toBeInTheDocument();
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
      expect(mockMessage.error).toHaveBeenCalledWith('message.retryFail');
    });
  });

  it('retry 判決失敗且錯誤為 Error 時應顯示錯誤訊息', async () => {
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
      expect(mockMessage.error).toHaveBeenCalledWith('retry exploded');
    });
  });

  it('JUDGMENT_FAILED 且空 message/無 failure reason 時應顯示 retryOrLater', async () => {
    mockGetCase.mockResolvedValueOnce({
      id: 'case-1',
      status: 'completed',
      evidences: [],
      judgment_failure_reason: null,
    });
    mockGetJudgmentByCaseId.mockRejectedValueOnce({ code: 'JUDGMENT_FAILED', message: '' });
    renderWithRoute('/quick-experience/result/case-1');
    expect(await screen.findByText('message.retryOrLater')).toBeInTheDocument();
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
  });

  it('證據上傳缺少 sessionId 時應報錯且不調 uploadEvidence', async () => {
    mockCaseSessionMapGet.mockReturnValue(null);
    mockSessionStorageGet.mockReturnValue(null);
    mockUseSessionStore.session = {};
    renderWithRoute('/quick-experience/result/case-1');
    const uploadBtn = await screen.findByText('upload-evidence');
    fireEvent.click(uploadBtn);
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalled();
    });
    expect(mockUploadEvidence).not.toHaveBeenCalled();
  });

  it('證據上傳空列表時應提示選擇檔案', async () => {
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-empty'));
    await waitFor(() => {
      expect(mockMessage.warning).toHaveBeenCalledWith('message.selectFile');
    });
  });

  it('證據上傳成功時應調用 uploadEvidence 並清除 pending 標記', async () => {
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    renderWithRoute('/quick-experience/result/case-1');
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
  });

  it('證據上傳失敗時應保留 pending 標記並提示錯誤', async () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    mockUploadEvidence.mockRejectedValueOnce(new Error('upload failed'));
    renderWithRoute('/quick-experience/result/case-1');
    const uploadBtn = await screen.findByText('upload-evidence');
    fireEvent.click(uploadBtn);
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalled();
    });
    expect(setSpy).toHaveBeenCalledWith('pending_evidence_case-1', 'true');
  });

  it('證據上傳失敗且錯誤非 Error 時應使用 fallback 文案', async () => {
    mockUploadEvidence.mockRejectedValueOnce('upload-fail-non-error');
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('upload-evidence'));
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('message.evidenceUploadFail');
    });
  });

  it('案件無證據且存在 pending 標記時應讀取 pending 狀態', async () => {
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
    getSpy.mockRestore();
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

  it('主要按鈕應可導向註冊與返回創建頁', async () => {
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText(/register\.action\.now/));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register');
    fireEvent.click(screen.getByText(/quickCreate\.recoveredCase\.startNew/));
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('RegisterPrompt 可觸發註冊與關閉', async () => {
    renderWithRoute('/quick-experience/result/case-1');
    fireEvent.click(await screen.findByText('register-prompt-register'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register');
    fireEvent.click(screen.getByText('register-prompt-close'));
    await waitFor(() => {
      expect(screen.queryByText('register-prompt-register')).not.toBeInTheDocument();
    });
  });
});
