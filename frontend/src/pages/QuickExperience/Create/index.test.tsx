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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const {
  mockNavigate,
  mockMessage,
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
  mockCaseSessionMapGet,
  mockCaseSessionMapSet,
  mockWidth,
  mockKeyboardNav,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockMessage: {
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
  mockCaseSessionMapGet: vi.fn().mockReturnValue(null),
  mockCaseSessionMapSet: vi.fn(),
  mockWidth: { current: 1200 },
  mockKeyboardNav: vi.fn(),
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

vi.mock('antd', () => {
  return {
    Card: ({ children }: { children: unknown }) => <div>{children}</div>,
    Button: ({
      children,
      onClick,
      disabled,
      'aria-label': ariaLabel,
    }: {
      children: unknown;
      onClick?: () => void;
      disabled?: boolean;
      'aria-label'?: string;
    }) => (
      <button onClick={onClick} aria-label={ariaLabel} data-disabled={disabled ? 'true' : 'false'}>
        {children}
      </button>
    ),
    Progress: ({ percent }: { percent: number }) => <div data-testid="progress">{percent}</div>,
    Space: ({ children }: { children: unknown }) => <div>{children}</div>,
    Typography: {
      Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
      Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    },
    Tabs: ({
      items,
      onChange,
    }: {
      items: Array<{ key: string; label: string }>;
      onChange: (key: string) => void;
    }) => (
      <div>
        {items.map((item) => (
          <button key={item.key} onClick={() => onChange(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
    ),
    Collapse: ({ items }: { items: Array<{ key: string; children: React.ReactNode }> }) => (
      <div>{items[0]?.children}</div>
    ),
    Alert: ({
      message,
      description,
      action,
      onClose,
    }: {
      message: React.ReactNode;
      description?: React.ReactNode;
      action?: React.ReactNode;
      onClose?: () => void;
    }) => (
      <div data-testid="alert">
        <div>{message}</div>
        <div>{description}</div>
        <div>{action}</div>
        {onClose ? <button onClick={onClose}>close-alert</button> : null}
      </div>
    ),
    message: mockMessage,
  };
});

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
    currentCase: null,
    isLoading: mockCaseStoreState.isLoading,
  }),
}));
vi.mock('@/utils/storage', () => ({
  localStore: { get: mockLocalStoreGet, set: mockLocalStoreSet, remove: mockLocalStoreRemove },
  sessionStorage: { get: mockSessionStorageGet, set: mockSessionStorageSet },
  caseSessionMap: { get: mockCaseSessionMapGet, set: mockCaseSessionMapSet, remove: vi.fn() },
}));
vi.mock('@/hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: mockWidth.current }),
}));
vi.mock('@/hooks/useAccessibility', () => ({
  useKeyboardNavigation: (...args: unknown[]) => mockKeyboardNav(...args),
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/business/BearJudge', () => ({ default: () => <span>BearJudge</span> }));
vi.mock('@/components/business/StatementInput', () => ({
  default: ({
    value,
    onChange,
    role,
  }: {
    value: string;
    onChange: (v: string) => void;
    role: string;
  }) => (
    <div>
      <textarea aria-label={role} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  ),
}));
vi.mock('@/components/business/FileUpload', () => ({
  default: ({ onChange }: { onChange: (files: Array<unknown>) => void }) => (
    <button
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
vi.mock('@/components/common/KeyboardShortcuts', () => ({
  default: ({ shortcuts }: { shortcuts: Array<{ action: () => void }> }) => (
    <div>
      <button onClick={() => shortcuts[0]?.action()}>shortcut-save</button>
      <button onClick={() => shortcuts[1]?.action()}>shortcut-submit</button>
    </div>
  ),
}));
vi.mock('@/components/common/GuideTooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/services/api/case', () => ({
  getCaseBySessionId: (...args: unknown[]) => mockGetCaseBySessionId(...args),
  uploadEvidence: (...args: unknown[]) => mockUploadEvidence(...args),
}));

describe('QuickExperienceCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState.session = null;
    mockCaseStoreState.isLoading = false;
    mockSessionStorageGet.mockReturnValue(null);
    mockCaseSessionMapGet.mockReturnValue(null);
    mockGetCaseBySessionId.mockResolvedValue(null);
    mockCreateQuickCase.mockResolvedValue({
      case: { id: 'case-1' },
      session_id: 'session-1',
      session_expires_at: '2026-12-31T00:00:00.000Z',
    });
    mockUploadEvidence.mockResolvedValue([]);
    vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'removeItem');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('無 session 時應初始化 createSession', async () => {
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });
  });

  it('有草稿時應恢復原告與被告輸入', async () => {
    mockLocalStoreGet.mockReturnValueOnce({
      plaintiffStatement: '草稿原告內容',
      defendantStatement: '草稿被告內容',
      evidenceUrls: [],
    });
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    expect((await screen.findByLabelText('plaintiff') as HTMLTextAreaElement).value).toBe('草稿原告內容');
    expect((screen.getByLabelText('defendant') as HTMLTextAreaElement).value).toBe('草稿被告內容');
  });

  it('草稿缺失欄位時應回退為空字串', async () => {
    mockLocalStoreGet.mockReturnValueOnce({
      plaintiffStatement: undefined,
      defendantStatement: undefined,
      evidenceUrls: [],
    });
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect((screen.getByLabelText('plaintiff') as HTMLTextAreaElement).value).toBe('');
      expect((screen.getByLabelText('defendant') as HTMLTextAreaElement).value).toBe('');
    });
  });

  it('窄螢幕初始化時應使用 vertical 版型', async () => {
    mockWidth.current = 375;
    const { container } = render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    expect(container.querySelector('.input-area.vertical')).toBeInTheDocument();
    mockWidth.current = 1200;
  });

  it('存在可恢復案件時應顯示提示並可繼續', async () => {
    mockSessionStorageGet.mockReturnValue('session-x');
    mockGetCaseBySessionId.mockResolvedValueOnce({ id: 'case-r1', status: 'submitted' });

    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('quickCreate.recoveredCase.continue'));
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/case-r1');
  });

  it('存在可恢復案件時可選擇重新開始', async () => {
    mockSessionStorageGet.mockReturnValue('session-x');
    mockGetCaseBySessionId.mockResolvedValueOnce({ id: 'case-r1', status: 'completed' });
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByText('quickCreate.recoveredCase.startNew'));
    await waitFor(() => {
      expect(screen.queryByText('quickCreate.recoveredCase.startNew')).not.toBeInTheDocument();
    });
  });

  it('點擊自動代寫且無原告內容時應提示', async () => {
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /quickCreate\.autoWrite/i }));
    expect(mockMessage.info).toHaveBeenCalled();
  });

  it('點擊自動代寫且有原告內容時應生成被告草稿', async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段超過三十字的原告敘述，用於生成對方草稿內容。' },
    });
    fireEvent.click(screen.getByRole('button', { name: /quickCreate\.autoWrite/i }));
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('應可切換版型與套用模板', async () => {
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('quickCreate.layout.vertical'));
    fireEvent.click(screen.getAllByText('quickCreate.applyTemplateN')[0]);
    expect((screen.getByLabelText('plaintiff') as HTMLTextAreaElement).value).toBe('quickCreate.template1');
    fireEvent.click(screen.getByText('quickCreate.applyTemplate'));
    expect((screen.getByLabelText('defendant') as HTMLTextAreaElement).value).toBe('quickCreate.template1');
  });

  it('自動保存定時器應寫入草稿並顯示提示', async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段超過三十字的原告敘述，用於覆蓋定時自動保存行為。' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(mockLocalStoreSet).toHaveBeenCalledWith(
      'quick_case_draft',
      expect.objectContaining({
        plaintiffStatement: expect.stringContaining('定時自動保存'),
      })
    );
    expect(screen.getByText('quickCreate.autoSaved')).toBeInTheDocument();
  });

  it('空內容時自動保存不應寫入 localStore', async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(mockLocalStoreSet).not.toHaveBeenCalledWith('quick_case_draft', expect.anything());
  });

  it('提交成功時應創建案件、上傳證據並跳轉', async () => {
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段超過三十字的原告敘述，用於提交案件並驗證流程完整性。' },
    });
    fireEvent.change(screen.getByLabelText('defendant'), {
      target: { value: '這是一段足夠長度的被告敘述，用於覆蓋可選輸入分支。' },
    });
    fireEvent.click(screen.getByText('set-files'));
    fireEvent.click(screen.getByText('shortcut-submit'));

    await waitFor(() => {
      expect(mockCreateQuickCase).toHaveBeenCalledWith({
        plaintiff_statement: '這是一段超過三十字的原告敘述，用於提交案件並驗證流程完整性。',
        defendant_statement: '這是一段足夠長度的被告敘述，用於覆蓋可選輸入分支。',
        evidence_urls: [],
      });
    });
    expect(mockUploadEvidence).toHaveBeenCalledWith('case-1', expect.any(Array), 'session-1');
    expect(mockSessionStorageSet).toHaveBeenCalledWith('session-1');
    expect(mockCaseSessionMapSet).toHaveBeenCalledWith('case-1', 'session-1');
    expect(mockSetSession).toHaveBeenCalled();
    expect(mockLocalStoreRemove).toHaveBeenCalledWith('quick_case_draft');
    expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/case-1');
  });

  it('證據上傳失敗時應標記 pending 並仍跳轉結果頁', async () => {
    mockUploadEvidence.mockRejectedValueOnce(new Error('upload failed'));
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段超過三十字的原告敘述，用於提交案件並觸發上傳失敗分支。' },
    });
    fireEvent.click(screen.getByText('set-files'));
    fireEvent.click(screen.getByText('shortcut-submit'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/quick-experience/result/case-1');
    });
    expect(localStorage.setItem).toHaveBeenCalledWith('pending_evidence_case-1', 'true');
  });

  it('當 result 無 session_id 時應回退使用 store session_id 上傳', async () => {
    mockCreateQuickCase.mockResolvedValueOnce({
      case: { id: 'case-s' },
      session_id: undefined,
    });
    mockSessionState.session = { session_id: 'store-session-1' };
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段超過三十字的原告敘述，用於覆蓋 store session_id 回退上傳分支。' },
    });
    fireEvent.click(screen.getByText('set-files'));
    fireEvent.click(screen.getByText('shortcut-submit'));
    await waitFor(() => {
      expect(mockUploadEvidence).toHaveBeenCalledWith('case-s', expect.any(Array), 'store-session-1');
    });
  });

  it('提交進行中重複觸發應只提交一次', async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveCreate = resolve;
    });
    mockCreateQuickCase.mockReturnValueOnce(pendingPromise);

    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段超過三十字的原告敘述，用於覆蓋提交鎖避免重複送出邏輯，內容更長以確保可提交。' },
    });
    fireEvent.click(screen.getByText('shortcut-submit'));
    fireEvent.click(screen.getByText('shortcut-submit'));

    await waitFor(() => {
      expect(mockCreateQuickCase).toHaveBeenCalledTimes(1);
    });
    resolveCreate({ case: { id: 'case-9' }, session_id: 'session-9' });
  });

  it('鍵盤導航 Enter callback 在可提交時應觸發提交', async () => {
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段超過三十字的原告敘述，用於覆蓋鍵盤導航觸發提交邏輯。' },
    });
    const onEnter = mockKeyboardNav.mock.calls.at(-1)?.[0] as (() => void) | undefined;
    expect(onEnter).toBeDefined();
    onEnter?.();
    await waitFor(() => {
      expect(mockCreateQuickCase).toHaveBeenCalled();
    });
  });

  it('createQuickCase 拋出非 Error 時應顯示 submitFail 文案', async () => {
    mockCreateQuickCase.mockRejectedValueOnce('unknown');
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段超過三十字的原告敘述，用於覆蓋 createQuickCase 非 Error 失敗分支。' },
    });
    fireEvent.click(screen.getByText('shortcut-submit'));
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('message.submitFail');
    });
  });

  it('createQuickCase 拋出 Error 時應顯示錯誤訊息本身', async () => {
    mockCreateQuickCase.mockRejectedValueOnce(new Error('create failed'));
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段超過三十字的原告敘述，用於覆蓋 createQuickCase Error 分支。' },
    });
    fireEvent.click(screen.getByText('shortcut-submit'));
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('create failed');
    });
  });

  it('註冊提示可導向註冊並可關閉', async () => {
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('register.action.now'));
    expect(mockNavigate).toHaveBeenCalledWith('/auth/register');
    fireEvent.click(screen.getByText('quickCreate.close'));
    await waitFor(() => {
      expect(screen.queryByText('register.action.now')).not.toBeInTheDocument();
    });
  });

  it('快捷鍵保存草稿應寫入 localStore 並提示成功', async () => {
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('plaintiff'), {
      target: { value: '這是一段用於保存草稿的原告敘述內容，應被寫入 localStore。' },
    });
    fireEvent.click(screen.getByText('shortcut-save'));
    expect(mockLocalStoreSet).toHaveBeenCalledWith(
      'quick_case_draft',
      expect.objectContaining({
        plaintiffStatement: expect.stringContaining('保存草稿'),
      })
    );
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('isLoading=true 時提交按鈕文案應顯示 submitting', async () => {
    mockCaseStoreState.isLoading = true;
    render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    expect(screen.getByText('quickCreate.submitting')).toBeInTheDocument();
  });
});
