/**
 * QuickExperience Create 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuickExperienceCreate from './index';

vi.mock('framer-motion', () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const {
  mockNavigate,
  mockToast,
  mockCreateSession,
  mockSetSession,
  mockCreateQuickCase,
  mockGetCaseBySessionId,
  mockUploadEvidence,
  mockSessionState,
  mockCaseStoreState,
  mockSessionStorageGet,
  mockSessionStorageSet,
  mockLocalStoreGet,
  mockLocalStoreSet,
  mockLocalStoreRemove,
  mockCaseSessionMapSet,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  mockCreateSession: vi.fn().mockResolvedValue(undefined),
  mockSetSession: vi.fn(),
  mockCreateQuickCase: vi.fn(),
  mockGetCaseBySessionId: vi.fn(),
  mockUploadEvidence: vi.fn(),
  mockSessionState: { session: null as { session_id?: string } | null },
  mockCaseStoreState: { isLoading: false },
  mockSessionStorageGet: vi.fn().mockReturnValue(null),
  mockSessionStorageSet: vi.fn(),
  mockLocalStoreGet: vi.fn().mockReturnValue(null),
  mockLocalStoreSet: vi.fn(),
  mockLocalStoreRemove: vi.fn(),
  mockCaseSessionMapSet: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
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

vi.mock('antd/es/upload/interface', () => ({}));

vi.mock('@/store/sessionStore', () => ({
  useSessionStore: () => ({
    createSession: mockCreateSession,
    session: mockSessionState.session,
    setSession: mockSetSession,
  }),
}));

vi.mock('@/store/caseStore', () => ({
  useCaseStore: () => ({
    createQuickCase: mockCreateQuickCase,
    isLoading: mockCaseStoreState.isLoading,
  }),
}));

vi.mock('@/utils/storage', () => ({
  localStore: { get: mockLocalStoreGet, set: mockLocalStoreSet, remove: mockLocalStoreRemove },
  sessionStorage: { get: mockSessionStorageGet, set: mockSessionStorageSet },
  caseSessionMap: { set: mockCaseSessionMapSet, get: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/utils/logger', () => ({
  logger: {
    warn: mockLoggerWarn,
  },
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/business/StatementInput', () => ({
  default: ({
    value,
    onChange,
    role,
  }: {
    value: string;
    onChange: (v: string) => void;
    role: string;
  }) => <textarea aria-label={role} value={value} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock('@/components/business/FileUpload', () => ({
  default: ({ onChange }: { onChange: (files: Array<unknown>) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange([
          {
            uid: '1',
            name: 'proof.jpg',
            originFileObj: new File(['x'], 'proof.jpg', { type: 'image/jpeg' }),
          },
        ])
      }
    >
      set-files
    </button>
  ),
}));
vi.mock('@/services/api/case', () => ({
  getCaseBySessionId: (...args: unknown[]) => mockGetCaseBySessionId(...args),
  uploadEvidence: (...args: unknown[]) => mockUploadEvidence(...args),
}));

const validPlaintiff = '這是一段超過三十字的原告敘述，用於覆蓋快速體驗當前真實提交流程。';
const validDefendant = '這是一段足夠長度的被告敘述，用於覆蓋可選輸入與正常提交分支。';

function renderPage() {
  return render(
    <MemoryRouter>
      <QuickExperienceCreate />
    </MemoryRouter>
  );
}

async function moveToStepTwo() {
  fireEvent.change(screen.getByLabelText('plaintiff'), {
    target: { value: validPlaintiff },
  });
  fireEvent.click(screen.getByText('quickCreate.step.next'));
  await screen.findByLabelText('defendant');
}

async function moveToStepThree() {
  await moveToStepTwo();
  fireEvent.click(screen.getByText('quickCreate.step.next'));
  await screen.findByText('quickCreate.step3.title');
}

describe('QuickExperienceCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockCreateSession.mockReset();
    mockCreateSession.mockResolvedValue(undefined);
    mockSessionState.session = null;
    mockCaseStoreState.isLoading = false;
    mockSessionStorageGet.mockReturnValue(null);
    mockLocalStoreGet.mockReturnValue(null);
    mockGetCaseBySessionId.mockResolvedValue(null);
    mockCreateQuickCase.mockResolvedValue({
      case: { id: 'case-1' },
      session_id: 'session-1',
      session_expires_at: '2026-12-31T00:00:00.000Z',
    });
    mockUploadEvidence.mockResolvedValue([]);
    vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('無 session 時應初始化 createSession', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });
  });

  it('createSession 失敗時應仍顯示表單且可填寫（F01 錯誤恢復：session 失敗不阻塞表單）', async () => {
    mockCreateSession.mockRejectedValueOnce(new Error('session init failed'));
    renderPage();
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });
    const plaintiffInput = screen.getByLabelText('plaintiff');
    expect(plaintiffInput).toBeInTheDocument();
    fireEvent.change(plaintiffInput, { target: { value: validPlaintiff } });
    expect((plaintiffInput as HTMLTextAreaElement).value).toBe(validPlaintiff);
  });

  it('createSession 失敗時應顯示非阻塞弱提示與重試按鈕（F01 弱入口：session 初始化失敗可恢復）', async () => {
    mockCreateSession.mockRejectedValueOnce(new Error('session init failed'));

    renderPage();

    expect(await screen.findByText('quickCreate.sessionInitWeakWarning')).toBeInTheDocument();
    expect(screen.getByText('quickCreate.sessionInitWeakHint')).toBeInTheDocument();
    expect(screen.getByText('quickCreate.sessionInitRetry')).toBeInTheDocument();
    expect(screen.getByLabelText('plaintiff')).toBeInTheDocument();
  });

  it('點擊 session 初始化重試後應再次呼叫 createSession，成功時清除弱提示', async () => {
    mockCreateSession
      .mockRejectedValueOnce(new Error('session init failed'))
      .mockResolvedValueOnce(undefined);

    renderPage();

    fireEvent.click(await screen.findByText('quickCreate.sessionInitRetry'));

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.queryByText('quickCreate.sessionInitWeakWarning')).not.toBeInTheDocument();
    });
  });

  it('createSession 失敗後應仍可提交，createQuickCase 成功後應跳轉結果頁（F01 錯誤恢復：session 失敗不阻塞提交）', async () => {
    mockCreateSession.mockRejectedValue(new Error('session init failed'));
    mockSessionStorageGet.mockReturnValue(null);
    mockSessionState.session = null;
    mockCreateQuickCase.mockResolvedValueOnce({
      case: { id: 'case-session-fail-recovery' },
      session_id: 'session-from-quick',
      session_expires_at: '2026-12-31T00:00:00.000Z',
    });

    renderPage();
    await moveToStepThree();
    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));

    await waitFor(() => {
      expect(mockCreateQuickCase).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/case-session-fail-recovery');
    });
  });

  it('原告陳述不足 30 字時下一步按鈕應 disabled（邊界：validateStatement 30-2000 規則）', () => {
    renderPage();
    const plaintiffInput = screen.getByLabelText('plaintiff');
    fireEvent.change(plaintiffInput, { target: { value: '這是一段不足三十字的短敘述' } }); // 13 chars < 30
    const nextBtn = screen.getByText('quickCreate.step.next');
    expect(nextBtn).toBeDisabled();
  });

  it('原告陳述 exactly 29 字時下一步仍應 disabled', () => {
    renderPage();
    const plaintiffInput = screen.getByLabelText('plaintiff');
    fireEvent.change(plaintiffInput, { target: { value: '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九' } }); // 29 chars
    const nextBtn = screen.getByText('quickCreate.step.next');
    expect(nextBtn).toBeDisabled();
  });

  it('原告陳述 exactly 30 字時下一步應 enabled（邊界：validateStatement 30 字正邊界）', () => {
    renderPage();
    const plaintiffInput = screen.getByLabelText('plaintiff');
    fireEvent.change(plaintiffInput, { target: { value: '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十' } }); // 30 chars
    const nextBtn = screen.getByText('quickCreate.step.next');
    expect(nextBtn).not.toBeDisabled();
  });

  it('原告陳述超過 2000 字時下一步應 disabled（邊界：validateStatement 30-2000 規則上界）', () => {
    renderPage();
    const plaintiffInput = screen.getByLabelText('plaintiff');
    fireEvent.change(plaintiffInput, { target: { value: 'x'.repeat(2001) } });
    const nextBtn = screen.getByText('quickCreate.step.next');
    expect(nextBtn).toBeDisabled();
  });

  it('原告陳述 exactly 2000 字時下一步應 enabled（邊界：validateStatement 30-2000 規則上界正邊界）', () => {
    renderPage();
    const plaintiffInput = screen.getByLabelText('plaintiff');
    fireEvent.change(plaintiffInput, { target: { value: 'x'.repeat(2000) } });
    const nextBtn = screen.getByText('quickCreate.step.next');
    expect(nextBtn).not.toBeDisabled();
  });

  it('有草稿時應恢復原告內容，進入第二步後恢復被告內容', async () => {
    mockLocalStoreGet.mockReturnValueOnce({
      plaintiffStatement: validPlaintiff,
      defendantStatement: validDefendant,
      evidenceUrls: [],
    });

    renderPage();
    expect((await screen.findByLabelText('plaintiff') as HTMLTextAreaElement).value).toBe(validPlaintiff);

    fireEvent.click(screen.getByText('quickCreate.step.next'));
    expect((await screen.findByLabelText('defendant') as HTMLTextAreaElement).value).toBe(validDefendant);
  });

  it('存在 draft 可恢復案件時應顯示提示並可繼續', async () => {
    mockSessionStorageGet.mockReturnValue('session-x');
    mockGetCaseBySessionId.mockResolvedValueOnce({ id: 'case-r1', status: 'draft' });

    renderPage();

    fireEvent.click(await screen.findByText('quickCreate.recoveredCase.continue'));
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/case-r1');
  });

  it('第二步可自動生成被告草稿', async () => {
    renderPage();

    await moveToStepTwo();
    vi.useFakeTimers();
    fireEvent.click(screen.getByText('quickCreate.autoWrite'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });

    expect(mockToast.success).toHaveBeenCalledWith('message.defendantDraftDone');
    expect((screen.getByLabelText('defendant') as HTMLTextAreaElement).value).toBe('quickCreate.defendantDraftTemplate');
  });

  it('自動保存應寫入當前草稿', async () => {
    vi.useFakeTimers();
    renderPage();

    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: validPlaintiff },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockLocalStoreSet).toHaveBeenCalledWith(
      'quick_case_draft',
      expect.objectContaining({
        plaintiffStatement: validPlaintiff,
        defendantStatement: '',
      })
    );
    expect(screen.getByText('quickCreate.autoSaved')).toBeInTheDocument();
  });

  it('被告留空時仍應以空字串提交 quick case', async () => {
    renderPage();
    await moveToStepThree();

    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));

    await waitFor(() => {
      expect(mockCreateQuickCase).toHaveBeenCalledWith({
        plaintiff_statement: validPlaintiff,
        defendant_statement: '',
        evidence_urls: [],
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/case-1');
  });

  it('提交成功且返回 session_id 時應同步更新 session、映射與草稿狀態', async () => {
    renderPage();
    await moveToStepThree();

    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));

    await waitFor(() => {
      expect(mockSessionStorageSet).toHaveBeenCalledWith('session-1');
      expect(mockCaseSessionMapSet).toHaveBeenCalledWith('case-1', 'session-1');
      expect(mockSetSession).toHaveBeenCalledWith({
        session_id: 'session-1',
        expires_at: '2026-12-31T00:00:00.000Z',
      });
      expect(mockLocalStoreRemove).toHaveBeenCalledWith('quick_case_draft');
    });
  });

  it('證據上傳失敗時應標記 pending 並仍跳轉結果頁', async () => {
    mockUploadEvidence.mockRejectedValueOnce(new Error('upload failed'));
    renderPage();
    await moveToStepThree();

    fireEvent.click(screen.getByText('set-files'));
    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));

    await waitFor(() => {
      expect(mockUploadEvidence).toHaveBeenCalledWith('case-1', expect.any(Array), 'session-1');
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/case-1');
    });
    expect(localStorage.setItem).toHaveBeenCalledWith('pending_evidence_case-1', 'true');
  });

  it('結果未返回 session_id 時應回退使用現有 store session 上傳證據', async () => {
    mockSessionState.session = { session_id: 'store-session-1' };
    mockCreateQuickCase.mockResolvedValueOnce({
      case: { id: 'case-s' },
      session_id: undefined,
    });

    renderPage();
    await moveToStepThree();

    fireEvent.click(screen.getByText('set-files'));
    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));

    await waitFor(() => {
      expect(mockUploadEvidence).toHaveBeenCalledWith('case-s', expect.any(Array), 'store-session-1');
    });
  });

  it('createQuickCase 失敗時應優先顯示錯誤訊息本身，否則回退 submitFail', async () => {
    renderPage();
    await moveToStepThree();

    mockCreateQuickCase.mockRejectedValueOnce(new Error('create failed'));
    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('create failed');
    });

    mockCreateQuickCase.mockRejectedValueOnce('unknown');
    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('message.submitFail');
    });
  });

  it('createQuickCase 失敗且 message 為空字串時應使用 submitFail（F10 邊界：空 message 視為無）', async () => {
    mockCreateQuickCase.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await moveToStepThree();

    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('message.submitFail');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/quick-experience/result/'));
  });

  it('createQuickCase FORBIDDEN 且無 message 時應使用 submitFail（F01 權限邊界 fallback）', async () => {
    mockCreateQuickCase.mockRejectedValueOnce({ code: 'FORBIDDEN' });
    renderPage();
    await moveToStepThree();
    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('message.submitFail');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/quick-experience/result/'));
  });

  it('createQuickCase 失敗時應仍可點擊關閉並導向 /（F01 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockCreateQuickCase.mockRejectedValueOnce(new Error('網路錯誤'));
    renderPage();
    await moveToStepThree();

    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });

    const closeBtn = screen.getByLabelText('quickCreate.close');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('createQuickCase 失敗後應仍可再次點擊提交，成功後應跳轉結果頁（F01 錯誤恢復：失敗不阻塞重試）', async () => {
    mockCreateQuickCase
      .mockRejectedValueOnce(new Error('網路錯誤'))
      .mockResolvedValueOnce({ case: { id: 'case-retry' }, session_id: 'session-retry' });
    renderPage();
    await moveToStepThree();

    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('網路錯誤');
    });

    fireEvent.click(screen.getByText('quickCreate.submitAndAnalyze'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/case-retry');
    });
  });

  it('isLoading=true 時第三步提交按鈕應顯示 submitting 文案', async () => {
    mockCaseStoreState.isLoading = true;
    renderPage();
    await moveToStepThree();

    expect(screen.getByText('quickCreate.submitting')).toBeInTheDocument();
  });
});
