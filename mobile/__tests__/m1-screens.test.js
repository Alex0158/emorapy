const React = require('react');
const { act, cleanup, fireEvent, render, waitFor } = require('@testing-library/react-native');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockCreateQuickSession = jest.fn();
const mockRefreshQuickSession = jest.fn();
const mockCreateQuickCase = jest.fn();
const mockCreateCollaborativeCase = jest.fn();
const mockGetQuickCase = jest.fn();
const mockGetQuickCaseBySessionId = jest.fn();
const mockConnectQuickJudgmentStream = jest.fn();
const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockClaimSession = jest.fn();
const mockGetSessionId = jest.fn();
const mockSetSessionId = jest.fn();
const mockClearSessionId = jest.fn();
const mockSetToken = jest.fn();
const mockConsumePendingHref = jest.fn();
const mockClearAppStorageWithPushCleanup = jest.fn();
const mockCaptureTelemetry = jest.fn();
let mockLifecycleStatus = 'active';
let mockLifecycleListener = null;
const mockSubscribeLifecycle = jest.fn((listener) => {
  mockLifecycleListener = listener;
  return jest.fn();
});
let mockSearchParams = {};

jest.mock('expo-router', () => ({
  Link: ({ children }) => {
    const React = require('react');
    return React.createElement(React.Fragment, null, children);
  },
  router: {
    push: mockRouterPush,
    replace: mockRouterReplace,
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/src/features/m1/api', () => ({
  connectQuickJudgmentStream: mockConnectQuickJudgmentStream,
  normalizeM1Error: (error) => ({
    code: error?.code || 'APP_ERROR',
    message: error?.message || '請稍後再試。',
  }),
  m1Api: {
    session: {
      createQuickSession: mockCreateQuickSession,
      refreshQuickSession: mockRefreshQuickSession,
    },
    quick: {
      createCollaborativeCase: mockCreateCollaborativeCase,
      createQuickCase: mockCreateQuickCase,
      getCase: mockGetQuickCase,
      getCaseBySessionId: mockGetQuickCaseBySessionId,
    },
    auth: {
      login: mockLogin,
      register: mockRegister,
      claimSession: mockClaimSession,
    },
  },
}));

jest.mock('@/src/features/m5/pushLifecycle', () => ({
  clearAppStorageWithPushCleanup: mockClearAppStorageWithPushCleanup,
}));

jest.mock('@/src/platform/storage/secureStore', () => ({
  sessionStorage: {
    clearSessionId: mockClearSessionId,
    getSessionId: mockGetSessionId,
    setSessionId: mockSetSessionId,
  },
  tokenStorage: {
    setToken: mockSetToken,
  },
  pendingLandingStorage: {
    consumePendingHref: mockConsumePendingHref,
  },
}));

jest.mock('@/src/platform/telemetry/client', () => ({
  captureTelemetry: mockCaptureTelemetry,
}));

jest.mock('@/src/platform/lifecycle/native', () => ({
  getCurrentLifecycleStatus: () => mockLifecycleStatus,
  subscribeLifecycle: (listener) => mockSubscribeLifecycle(listener),
}));

const QuickScreen = require('../app/(public)/quick/index').default;
const QuickCollaborativeScreen = require('../app/(public)/quick/collaborative').default;
const QuickResultModule = require('../app/(public)/quick/result');
const QuickResultScreen = QuickResultModule.default;
const { shouldPollQuickResult } = QuickResultModule;
const AuthScreen = require('../app/(public)/auth/index').default;
const { setLocale } = require('@/src/i18n');

const queryClients = [];

function renderWithQuery(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  queryClients.push(queryClient);
  return render(React.createElement(QueryClientProvider, { client: queryClient }, ui));
}

describe('M1 Quick/Auth screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
    mockGetSessionId.mockResolvedValue(null);
    mockClearSessionId.mockResolvedValue(undefined);
    mockSetSessionId.mockResolvedValue(undefined);
    mockSetToken.mockResolvedValue(undefined);
    mockConsumePendingHref.mockResolvedValue(null);
    mockClearAppStorageWithPushCleanup.mockResolvedValue(undefined);
    mockCreateQuickSession.mockResolvedValue({ session_id: 'guest-new' });
    mockRefreshQuickSession.mockResolvedValue({ session_id: 'guest-existing' });
    mockCreateQuickCase.mockResolvedValue({ session_id: 'guest-new', case: { id: 'case-1' } });
    mockCreateCollaborativeCase.mockResolvedValue({
      case: { id: 'case-collab' },
      phase: 'a_done',
      session_id: 'guest-collab',
      session_expires_at: '2026-05-09T00:00:00.000Z',
    });
    mockConnectQuickJudgmentStream.mockResolvedValue(undefined);
    mockGetQuickCase.mockResolvedValue(null);
    mockGetQuickCaseBySessionId.mockResolvedValue(null);
    mockLogin.mockResolvedValue({ token: 'jwt-token' });
    mockRegister.mockResolvedValue({ token: 'jwt-token' });
    mockClaimSession.mockResolvedValue({ case_id: 'case-1' });
    mockLifecycleStatus = 'active';
    mockLifecycleListener = null;
    mockSubscribeLifecycle.mockClear();
    mockSearchParams = {};
  });

  afterEach(() => {
    cleanup();
    act(() => {
      while (queryClients.length) {
        queryClients.pop().clear();
      }
    });
  });

  it('submits quick case through anonymous session and routes to result', async () => {
    const screen = renderWithQuery(React.createElement(QuickScreen));

    fireEvent.changeText(
      screen.getByPlaceholderText(/誰做了什麼/),
      '我想先把今天的衝突整理清楚'
    );
    fireEvent.changeText(
      screen.getByPlaceholderText(/補上對方視角/),
      '對方可能覺得自己已經說得很清楚'
    );
    fireEvent.press(screen.getByText('提交快速整理'));

    await waitFor(() => expect(mockCreateQuickCase).toHaveBeenCalledTimes(1));

    expect(mockCreateQuickSession).toHaveBeenCalledTimes(1);
    expect(mockCreateQuickCase).toHaveBeenCalledWith({
      plaintiff_statement: '我想先把今天的衝突整理清楚',
      defendant_statement: '對方可能覺得自己已經說得很清楚',
    });
    expect(mockSetSessionId).toHaveBeenCalledWith('guest-new');
    expect(mockRouterPush).toHaveBeenCalledWith('/quick/result?caseId=case-1');
  });

  it('keeps quick submit disabled until both statements have enough context', () => {
    const screen = renderWithQuery(React.createElement(QuickScreen));

    expect(screen.getAllByText('快速整理').length).toBeGreaterThan(0);
    expect(screen.queryByText('QUICK')).toBeNull();
    expect(screen.getByTestId('quick.submit').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('quick.plaintiff.helper').props.children).toContain('再補 10 個字');
    expect(screen.getByTestId('quick.defendant.helper').props.children).toContain('再補 10 個字');

    fireEvent.changeText(screen.getByPlaceholderText(/誰做了什麼/), '這是一段足夠長的我的說法');
    fireEvent.changeText(screen.getByPlaceholderText(/補上對方視角/), '這是一段足夠長的對方說法');

    expect(screen.getByTestId('quick.submit').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByTestId('quick.plaintiff.helper').props.children).toContain('/800');
    expect(screen.getByTestId('quick.defendant.helper').props.children).toContain('/800');
  });

  it('renders quick entry helper copy in the selected locale', () => {
    setLocale('en-US', { persist: false });
    const screen = renderWithQuery(React.createElement(QuickScreen));

    expect(screen.getAllByText('Quick summary').length).toBeGreaterThan(0);
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByPlaceholderText(/What happened/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Add the other perspective/)).toBeTruthy();
    expect(screen.getByTestId('quick.plaintiff.helper').props.children).toContain('Add 10 more characters');
    expect(screen.getByText('Submit quick summary')).toBeTruthy();
  });

  it('uses localized Auth screen label instead of the old English eyebrow', () => {
    const screen = renderWithQuery(React.createElement(AuthScreen));

    expect(screen.getByText('帳號')).toBeTruthy();
    expect(screen.getByText('電子郵件')).toBeTruthy();
    expect(screen.getByText('密碼')).toBeTruthy();
    expect(screen.queryByText('AUTH')).toBeNull();
    expect(screen.queryByText('Email')).toBeNull();
    expect(screen.queryByText('Password')).toBeNull();
  });

  it('refreshes existing anonymous session before quick submit', async () => {
    mockGetSessionId.mockResolvedValueOnce('guest-existing');
    mockCreateQuickCase.mockResolvedValueOnce({ session_id: 'guest-existing', case: { id: 'case-2' } });
    const screen = renderWithQuery(React.createElement(QuickScreen));

    fireEvent.changeText(screen.getByPlaceholderText(/誰做了什麼/), '這是一段足夠長的我的說法');
    fireEvent.changeText(screen.getByPlaceholderText(/補上對方視角/), '這是一段足夠長的對方說法');
    fireEvent.press(screen.getByText('提交快速整理'));

    await waitFor(() => expect(mockRefreshQuickSession).toHaveBeenCalledWith('guest-existing'));
    expect(mockCreateQuickSession).not.toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith('/quick/result?caseId=case-2');
  });

  it('recovers expired anonymous session before quick submit', async () => {
    mockGetSessionId.mockResolvedValueOnce('guest-expired');
    mockRefreshQuickSession.mockRejectedValueOnce({
      code: 'SESSION_EXPIRED',
      message: 'expired',
    });
    mockCreateQuickSession.mockResolvedValueOnce({ session_id: 'guest-recovered' });
    mockCreateQuickCase.mockResolvedValueOnce({
      session_id: 'guest-recovered',
      case: { id: 'case-recovered' },
    });
    const screen = renderWithQuery(React.createElement(QuickScreen));

    fireEvent.changeText(screen.getByPlaceholderText(/誰做了什麼/), '這是一段足夠長的我的說法');
    fireEvent.changeText(screen.getByPlaceholderText(/補上對方視角/), '這是一段足夠長的對方說法');
    fireEvent.press(screen.getByText('提交快速整理'));

    await waitFor(() => expect(mockCreateQuickCase).toHaveBeenCalledTimes(1));

    expect(mockRefreshQuickSession).toHaveBeenCalledWith('guest-expired');
    expect(mockClearSessionId).toHaveBeenCalledTimes(1);
    expect(mockCreateQuickSession).toHaveBeenCalledTimes(1);
    expect(mockSetSessionId).toHaveBeenCalledWith('guest-recovered');
    expect(mockCaptureTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'app_quick_session_recovered',
        context: {
          code: 'SESSION_EXPIRED',
          hadSession: true,
        },
      })
    );
    expect(mockRouterPush).toHaveBeenCalledWith('/quick/result?caseId=case-recovered');
  });

  it('polls quick result only while judgment is still generating', () => {
    expect(shouldPollQuickResult(null)).toBe(false);
    expect(shouldPollQuickResult({ status: 'submitted', judgment: null })).toBe(true);
    expect(shouldPollQuickResult({ status: 'in_progress', judgment: null })).toBe(true);
    expect(shouldPollQuickResult({ status: 'completed', judgment: { summary: '完成' } })).toBe(false);
    expect(shouldPollQuickResult({ status: 'judgment_failed', judgment: null })).toBe(false);
  });

  it('renders quick result empty state in the selected locale', async () => {
    setLocale('en-US', { persist: false });
    const screen = renderWithQuery(React.createElement(QuickResultScreen));

    await waitFor(() => expect(mockGetSessionId).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Result handoff')).toBeTruthy();
    expect(await screen.findByText(
      'No quick summary result was found. Return to quick summary to submit again, or try later.'
    )).toBeTruthy();
    expect(screen.getByText('Refresh result')).toBeTruthy();
    expect(screen.getByText('Next step')).toBeTruthy();
  });

  it('shows automatic refresh state for pending quick result', async () => {
    mockSearchParams = { caseId: 'case-pending' };
    mockGetSessionId.mockResolvedValueOnce('guest-existing');
    mockGetQuickCase.mockResolvedValueOnce({
      id: 'case-pending',
      status: 'in_progress',
      type: '其他衝突',
      judgment: null,
    });
    const screen = renderWithQuery(React.createElement(QuickResultScreen));

    expect(await screen.findByText('已收到快速整理，AI 判斷可能仍在生成中。稍後刷新可以看到更新結果。')).toBeTruthy();
    expect(screen.getByText('整理狀態：已建立')).toBeTruthy();
    expect(screen.getByText('自動刷新')).toBeTruthy();
    expect(screen.queryByText('case-pending')).toBeNull();
    expect(mockGetQuickCase).toHaveBeenCalledWith('case-pending', 'guest-existing');
  });

  it('connects quick judgment stream and refetches when stream persists', async () => {
    mockSearchParams = { caseId: 'case-stream' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetQuickCase
      .mockResolvedValueOnce({
        id: 'case-stream',
        status: 'in_progress',
        type: '其他衝突',
        judgment: null,
      })
      .mockResolvedValueOnce({
        id: 'case-stream',
        status: 'completed',
        type: '其他衝突',
        judgment: { summary: '串流完成後的摘要' },
      });
    mockConnectQuickJudgmentStream.mockImplementationOnce(async (caseId, callbacks, options) => {
      expect(caseId).toBe('case-stream');
      expect(options.afterSeq).toBeUndefined();
      callbacks.onReady({
        scopeType: 'case_judgment',
        scopeId: 'case-stream',
        snapshots: [{
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'case_judgment',
          scopeId: 'case-stream',
          status: 'streaming',
          lastSeq: 3,
          phase: 'drafting_judgment',
          updatedAt: '2026-05-08T00:00:00.000Z',
        }],
      });
      callbacks.onEvent({
        eventType: 'stream.persisted',
        streamId: 'stream-1',
        requestId: 'req-1',
        scopeType: 'case_judgment',
        scopeId: 'case-stream',
        seq: 4,
        createdAt: '2026-05-08T00:00:01.000Z',
        metadata: { judgmentId: 'judgment-1' },
      });
    });
    const screen = renderWithQuery(React.createElement(QuickResultScreen));

    await waitFor(() => expect(mockConnectQuickJudgmentStream).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('串流完成後的摘要')).toBeTruthy();
    expect(mockGetQuickCase).toHaveBeenCalledTimes(2);
  });

  it('uses user-facing wording when quick judgment sync is ready without snapshot', async () => {
    mockSearchParams = { caseId: 'case-ready' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetQuickCase.mockResolvedValue({
      id: 'case-ready',
      status: 'in_progress',
      type: '其他衝突',
      judgment: null,
    });
    mockConnectQuickJudgmentStream.mockImplementationOnce(async (_caseId, callbacks) => {
      callbacks.onReady({
        scopeType: 'case_judgment',
        scopeId: 'case-ready',
        snapshots: [],
      });
    });

    const screen = renderWithQuery(React.createElement(QuickResultScreen));

    expect(await screen.findByText('已接上判斷同步。')).toBeTruthy();
    expect(screen.queryByText('已接上 AI 判斷串流。')).toBeNull();
  });

  it('recovers quick judgment stream from last seq after app foregrounds', async () => {
    const connections = [];
    mockSearchParams = { caseId: 'case-recover' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetQuickCase.mockResolvedValue({
      id: 'case-recover',
      status: 'in_progress',
      type: '其他衝突',
      judgment: null,
    });
    mockConnectQuickJudgmentStream.mockImplementation((caseId, callbacks, options) => {
      connections.push({ caseId, callbacks, options });
      return new Promise(() => undefined);
    });
    const screen = renderWithQuery(React.createElement(QuickResultScreen));

    expect(await screen.findByText('自動刷新')).toBeTruthy();
    await waitFor(() => expect(mockConnectQuickJudgmentStream).toHaveBeenCalledTimes(1));
    expect(connections[0].caseId).toBe('case-recover');
    expect(connections[0].options.afterSeq).toBeUndefined();

    act(() => {
      connections[0].callbacks.onReady({
        scopeType: 'case_judgment',
        scopeId: 'case-recover',
        snapshots: [{
          streamId: 'stream-recover',
          requestId: 'req-recover',
          scopeType: 'case_judgment',
          scopeId: 'case-recover',
          status: 'streaming',
          lastSeq: 3,
          phase: 'drafting_judgment',
          updatedAt: '2026-05-08T00:00:00.000Z',
        }],
      });
    });
    expect(await screen.findByText('AI 判斷進度已更新。')).toBeTruthy();

    act(() => {
      mockLifecycleStatus = 'background';
      mockLifecycleListener('background');
    });

    await waitFor(() => expect(connections[0].options.signal.aborted).toBe(true));
    expect(await screen.findByText(/App 回到前景後會恢復判斷同步/)).toBeTruthy();
    expect(screen.queryByText(/最後進度/)).toBeNull();
    expect(screen.queryByText(/最近位置/)).toBeNull();
    expect(mockConnectQuickJudgmentStream).toHaveBeenCalledTimes(1);

    act(() => {
      mockLifecycleStatus = 'active';
      mockLifecycleListener('active');
    });

    await waitFor(() => expect(mockConnectQuickJudgmentStream).toHaveBeenCalledTimes(2));
    expect(connections[1].caseId).toBe('case-recover');
    expect(connections[1].options.afterSeq).toBe(3);
    expect(connections[1].options.signal.aborted).toBe(false);

    act(() => {
      connections[1].callbacks.onEvent({
        eventType: 'stream.delta',
        streamId: 'stream-recover',
        requestId: 'req-recover',
        scopeType: 'case_judgment',
        scopeId: 'case-recover',
        seq: 4,
        deltaText: 'partial',
        createdAt: '2026-05-08T00:00:01.000Z',
      });
    });

    expect(await screen.findByText('AI 判斷正在更新。')).toBeTruthy();
  });

  it('clears expired anonymous session when quick result can no longer be read', async () => {
    mockSearchParams = { caseId: 'case-expired' };
    mockGetSessionId.mockResolvedValueOnce('guest-expired');
    mockGetQuickCase.mockRejectedValueOnce({
      code: 'SESSION_EXPIRED',
      message: 'expired',
    });
    const screen = renderWithQuery(React.createElement(QuickResultScreen));

    expect(await screen.findByText('匿名進度已過期或無法讀取。請重新提交快速整理，或登入後查看已保存內容。')).toBeTruthy();
    expect(mockClearSessionId).toHaveBeenCalledTimes(1);
    expect(mockCaptureTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'app_quick_session_access_failed',
        context: {
          code: 'SESSION_EXPIRED',
          clearedSession: true,
        },
      })
    );
  });

  it('renders collaborative quick entry copy in the selected locale', () => {
    setLocale('en-US', { persist: false });
    const screen = renderWithQuery(React.createElement(QuickCollaborativeScreen));

    expect(screen.getByText('Two-person quick note')).toBeTruthy();
    expect(screen.getByText('First side note')).toBeTruthy();
    expect(screen.getByText('Step 1 / 2')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Write what happened/)).toBeTruthy();
    expect(screen.getByText('Record first side')).toBeTruthy();
    expect(screen.getByText('Flow boundary')).toBeTruthy();
  });

  it('walks same-device collaborative quick flow from role A to role B result', async () => {
    mockCreateQuickSession.mockResolvedValueOnce({ session_id: 'guest-collab' });
    mockGetSessionId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('guest-collab');
    mockCreateCollaborativeCase
      .mockResolvedValueOnce({
        case: { id: 'case-collab' },
        phase: 'a_done',
        session_id: 'guest-collab',
        session_expires_at: '2026-05-09T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        case: { id: 'case-collab' },
        phase: 'submitted',
        session_id: 'guest-collab',
        session_expires_at: '2026-05-09T00:00:00.000Z',
      });
    const screen = renderWithQuery(React.createElement(QuickCollaborativeScreen));

    fireEvent.changeText(
      screen.getByPlaceholderText(/先寫下發生了什麼/),
      '第一方想先把這次衝突的背景、自己在意的地方，以及希望對方理解的事情完整寫清楚。'
    );
    fireEvent.press(screen.getByText('記錄第一方'));

    await waitFor(() => expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(1));
    expect(mockCreateCollaborativeCase).toHaveBeenNthCalledWith(
      1,
      {
        plaintiff_statement: '第一方想先把這次衝突的背景、自己在意的地方，以及希望對方理解的事情完整寫清楚。',
      },
      'guest-collab'
    );
    expect(await screen.findByText('第一方已記錄。請把設備交給第二方，讓對方補上自己的說法。')).toBeTruthy();

    fireEvent.changeText(
      screen.getByPlaceholderText(/不用反駁全部內容/),
      '第二方補上自己看到的重點和限制。'
    );
    fireEvent.press(screen.getByText('提交雙方說明'));

    await waitFor(() => expect(mockCreateCollaborativeCase).toHaveBeenCalledTimes(2));
    expect(mockCreateCollaborativeCase).toHaveBeenNthCalledWith(
      2,
      {
        case_id: 'case-collab',
        defendant_statement: '第二方補上自己看到的重點和限制。',
      },
      'guest-collab'
    );
    expect(mockSetSessionId).toHaveBeenCalledWith('guest-collab');
    expect(mockRouterPush).toHaveBeenCalledWith('/quick/result?caseId=case-collab');
  });

  it('logs in, stores token, claims anonymous session, and enters app shell', async () => {
    mockGetSessionId.mockResolvedValueOnce('guest-existing');
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'user@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('至少 8 個字元'), 'password-123');
    fireEvent.press(screen.getByText('登入並保存'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));

    expect(mockLogin).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password-123' });
    expect(mockSetToken).toHaveBeenCalledWith('jwt-token');
    expect(mockClaimSession).toHaveBeenCalledWith('guest-existing');
    expect(mockRouterReplace).toHaveBeenCalledWith('/case');
    expect(await screen.findByText('已保存快速整理。')).toBeTruthy();
    expect(screen.queryByText('case-1')).toBeNull();
    const queryClient = queryClients.at(-1);
    expect(queryClient.getQueryData(['app', 'auth-token'])).toBe('jwt-token');
    expect(queryClient.getQueryData(['app', 'session-id'])).toBe('guest-existing');
  });

  it('keeps auth submit disabled until email and password are valid', () => {
    const screen = renderWithQuery(React.createElement(AuthScreen));

    expect(screen.getByTestId('auth.submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'bad-email');
    fireEvent.changeText(screen.getByPlaceholderText('至少 8 個字元'), 'short');

    expect(screen.getByText('請確認電子郵件格式。')).toBeTruthy();
    expect(screen.getByText('還需要 3 個字元。')).toBeTruthy();
    expect(screen.getByTestId('auth.submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'user@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('至少 8 個字元'), 'password-123');

    expect(screen.getByText('密碼長度符合要求。')).toBeTruthy();
    expect(screen.getByTestId('auth.submit').props.accessibilityState.disabled).toBe(false);
  });

  it('renders auth form and validation in the selected locale', () => {
    setLocale('en-US', { persist: false });
    const screen = renderWithQuery(React.createElement(AuthScreen));

    expect(screen.getByText('Save your progress')).toBeTruthy();
    expect(screen.getByText('Account details')).toBeTruthy();
    expect(screen.getByText('Log in and save')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'bad-email');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'short');

    expect(screen.getByText('Check the email format.')).toBeTruthy();
    expect(screen.getByText('3 more characters needed.')).toBeTruthy();

    fireEvent.press(screen.getByText('Register'));
    expect(screen.getByText('Nickname')).toBeTruthy();
    expect(screen.getByPlaceholderText('How should we call you?')).toBeTruthy();
  });

  it('does not block login when claim-session fails for an expired anonymous session', async () => {
    mockGetSessionId.mockResolvedValueOnce('guest-expired');
    mockClaimSession.mockRejectedValueOnce({
      code: 'SESSION_EXPIRED',
      message: 'Session 已過期',
    });
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'user@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('至少 8 個字元'), 'password-123');
    fireEvent.press(screen.getByText('登入並保存'));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/case'));

    expect(mockLogin).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password-123' });
    expect(mockSetToken).toHaveBeenCalledWith('jwt-token');
    expect(mockClaimSession).toHaveBeenCalledWith('guest-expired');
    expect(mockClearSessionId).toHaveBeenCalledTimes(1);
    expect(mockCaptureTelemetry).toHaveBeenCalledWith({
      name: 'app_auth_claim_session_failed',
      severity: 'warning',
      route: '/auth',
      context: {
        code: 'SESSION_EXPIRED',
        hasSession: true,
      },
    });
    expect(await screen.findByText('已登入，但匿名進度已過期或無法保存。你可以從案件與修復繼續。')).toBeTruthy();
    const queryClient = queryClients.at(-1);
    expect(queryClient.getQueryData(['app', 'auth-token'])).toBe('jwt-token');
    expect(queryClient.getQueryData(['app', 'session-id'])).toBeNull();
  });

  it('resumes a protected notification target after login', async () => {
    mockSearchParams = { next: '/notifications' };
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'user@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('至少 8 個字元'), 'password-123');
    fireEvent.press(screen.getByText('登入並保存'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));

    expect(mockConsumePendingHref).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith('/notifications');
  });

  it('clears local app session through push token cleanup', async () => {
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.press(screen.getByText('清理本機會話'));

    await waitFor(() => expect(mockClearAppStorageWithPushCleanup).toHaveBeenCalledTimes(1));
    const queryClient = queryClients.at(-1);
    expect(queryClient.getQueryData(['app', 'auth-token'])).toBeNull();
    expect(queryClient.getQueryData(['app', 'session-id'])).toBeNull();
    expect(await screen.findByText('這台裝置的登入狀態、快速整理和提醒通道已清理。')).toBeTruthy();
  });
});
