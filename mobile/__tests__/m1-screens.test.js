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
const mockSendVerificationCode = jest.fn();
const mockVerifyRegistrationCode = jest.fn();
const mockVerifyEmail = jest.fn();
const mockClaimSession = jest.fn();
const mockGetSessionId = jest.fn();
const mockSetSessionId = jest.fn();
const mockClearSessionId = jest.fn();
const mockSetToken = jest.fn();
const mockClearToken = jest.fn();
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
      sendVerificationCode: mockSendVerificationCode,
      verifyRegistrationCode: mockVerifyRegistrationCode,
      verifyEmail: mockVerifyEmail,
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
    clearToken: mockClearToken,
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
const { describeStreamStatus, formatQuickResultStreamError, shouldPollQuickResult } = QuickResultModule;
const AuthScreen = require('../app/(public)/auth/index').default;
const { setLocale } = require('@/src/i18n');
const {
  getIdentityQueryScopeEpoch,
  identityScopedQueryKey,
} = require('../src/providers/identityQueryScope');

const queryClients = [];

function renderWithQuery(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  queryClients.push(queryClient);
  const rendered = render(React.createElement(QueryClientProvider, { client: queryClient }, ui));
  rendered.queryClient = queryClient;
  return rendered;
}

describe('M1 Quick/Auth screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
    mockGetSessionId.mockResolvedValue(null);
    mockClearSessionId.mockResolvedValue(undefined);
    mockSetSessionId.mockResolvedValue(undefined);
    mockSetToken.mockResolvedValue(undefined);
    mockClearToken.mockResolvedValue(undefined);
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
    mockSendVerificationCode.mockResolvedValue({ expires_in: 300, resend_after: 60 });
    mockVerifyRegistrationCode.mockResolvedValue({
      verified: true,
      registration_proof: 'rp1_registration-proof',
      registration_proof_expires_in: 600,
    });
    mockVerifyEmail.mockResolvedValue(true);
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

  it('formats quick result stream errors through locale catalog without hiding generated text', () => {
    setLocale('en-US', { persist: false });

    expect(formatQuickResultStreamError({ code: 'SERVER_ERROR', message: '服務器錯誤' })).toBe(
      'The service could not complete the request. Please try again later.'
    );
    expect(formatQuickResultStreamError({ code: 'APP_ERROR', message: 'provider down' })).toBe(
      'Analysis sync was interrupted. Try again later or refresh the result.'
    );
    expect(describeStreamStatus({
      eventType: 'stream.failed',
      seq: 1,
      error: { code: 'APP_ERROR', message: 'provider down' },
    })).toBe('Analysis sync was interrupted. Try again later or refresh the result.');
    expect(describeStreamStatus({
      status: 'completed',
      lastSeq: 2,
      text: 'Generated analysis text',
    })).toBe('Generated analysis text');
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

  it('does not expose raw quick judgment stream event errors in selected locale', async () => {
    setLocale('en-US', { persist: false });
    mockSearchParams = { caseId: 'case-stream-error' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetQuickCase.mockResolvedValue({
      id: 'case-stream-error',
      status: 'in_progress',
      type: '其他衝突',
      judgment: null,
    });
    mockConnectQuickJudgmentStream.mockImplementationOnce(async (_caseId, callbacks) => {
      callbacks.onEvent({
        eventType: 'stream.failed',
        streamId: 'stream-error',
        requestId: 'req-error',
        scopeType: 'case_judgment',
        scopeId: 'case-stream-error',
        seq: 5,
        createdAt: '2026-05-08T00:00:01.000Z',
        error: { code: 'APP_ERROR', message: 'provider down' },
      });
    });
    const screen = renderWithQuery(React.createElement(QuickResultScreen));

    expect(await screen.findByText('Analysis sync was interrupted. Try again later or refresh the result.')).toBeTruthy();
    expect(screen.queryByText('provider down')).toBeNull();
  });

  it('does not expose raw quick judgment connection errors in selected locale', async () => {
    setLocale('en-US', { persist: false });
    mockSearchParams = { caseId: 'case-connection-error' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetQuickCase.mockResolvedValue({
      id: 'case-connection-error',
      status: 'in_progress',
      type: '其他衝突',
      judgment: null,
    });
    mockConnectQuickJudgmentStream.mockRejectedValueOnce(new Error('socket exploded'));
    const screen = renderWithQuery(React.createElement(QuickResultScreen));

    expect(await screen.findByText('Analysis sync was interrupted. Try again later or refresh the result.')).toBeTruthy();
    expect(screen.queryByText('socket exploded')).toBeNull();
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
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
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
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'short');

    expect(screen.getByText('請確認電子郵件格式。')).toBeTruthy();
    expect(screen.getByText('還需要 3 個字元。')).toBeTruthy();
    expect(screen.getByTestId('auth.submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');

    expect(screen.getByText('密碼長度符合要求。')).toBeTruthy();
    expect(screen.getByTestId('auth.submit').props.accessibilityState.disabled).toBe(false);
  });

  it('validates the complete backend password policy before sending a registration code', () => {
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.press(screen.getByTestId('auth.mode.register'));
    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'user@example.com');

    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password');
    expect(screen.getByText('這個密碼太常見，請改用較難猜的密碼。')).toBeTruthy();
    expect(screen.getByTestId('auth.submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'abcdefgh');
    expect(screen.getByText('密碼必須包含至少一個數字。')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('auth.password.input'), '123456789');
    expect(screen.getByText('密碼必須包含至少一個英文字母。')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('auth.password.input'), `${'a'.repeat(128)}1`);
    expect(screen.getByText('密碼不能超過 128 個字元。')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    expect(screen.getByText('密碼符合註冊安全規則。')).toBeTruthy();
    expect(screen.getByTestId('auth.submit').props.accessibilityState.disabled).toBe(false);
    expect(mockSendVerificationCode).not.toHaveBeenCalled();
  });

  it('registers only after send-code and proof-first email verification', async () => {
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.press(screen.getByTestId('auth.mode.register'));
    fireEvent.changeText(screen.getByTestId('auth.nickname.input'), '小晴');
    fireEvent.changeText(screen.getByTestId('auth.email.input'), ' New.User@Example.com ');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    fireEvent.press(screen.getByTestId('auth.submit'));

    await waitFor(() => {
      expect(mockSendVerificationCode).toHaveBeenCalledWith('new.user@example.com', 'register');
    });
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockSetToken).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth.registration.verification')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('auth.registration.code.input'), '12a3456');
    expect(screen.getByTestId('auth.registration.code.input').props.value).toBe('123456');
    fireEvent.press(screen.getByTestId('auth.registration.complete'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockVerifyRegistrationCode).toHaveBeenCalledWith(
      'new.user@example.com',
      '123456'
    );
    expect(mockRegister).toHaveBeenCalledWith({
      email: 'new.user@example.com',
      password: 'password-123',
      nickname: '小晴',
      registration_proof: 'rp1_registration-proof',
    });
    expect(mockSetToken).toHaveBeenCalledWith('jwt-token');
    expect(mockRouterReplace).toHaveBeenCalledWith('/case');
  });

  it('disables resend until the backend cooldown elapses', async () => {
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.press(screen.getByTestId('auth.mode.register'));
    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'cooldown@example.com');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    fireEvent.press(screen.getByTestId('auth.submit'));

    await waitFor(() => expect(mockSendVerificationCode).toHaveBeenCalledTimes(1));
    expect(screen.getByText('60 秒後可重新寄送')).toBeTruthy();
    expect(screen.getByTestId('auth.registration.resend').props.accessibilityState.disabled)
      .toBe(true);

    fireEvent.press(screen.getByTestId('auth.registration.resend'));
    expect(mockSendVerificationCode).toHaveBeenCalledTimes(1);
  });

  it('clears an active resend countdown when the auth screen unmounts', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    try {
      const screen = renderWithQuery(React.createElement(AuthScreen));

      fireEvent.press(screen.getByTestId('auth.mode.register'));
      fireEvent.changeText(screen.getByTestId('auth.email.input'), 'timer@example.com');
      fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
      fireEvent.press(screen.getByTestId('auth.submit'));

      await waitFor(() => expect(screen.getByText('60 秒後可重新寄送')).toBeTruthy());
      const countdownTimer = setIntervalSpy.mock.results.at(-1)?.value;
      expect(countdownTimer).toBeDefined();

      screen.unmount();

      expect(clearIntervalSpy).toHaveBeenCalledWith(countdownTimer);
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it('recovers an active unverified account, then retries login', async () => {
    mockLogin
      .mockRejectedValueOnce({ code: 'EMAIL_NOT_VERIFIED', message: 'raw backend message' })
      .mockResolvedValueOnce({ token: 'jwt-token' });
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'legacy@example.com');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    fireEvent.press(screen.getByTestId('auth.submit'));

    await waitFor(() => {
      expect(mockSendVerificationCode).toHaveBeenCalledWith(
        'legacy@example.com',
        'verify_email'
      );
    });
    expect(screen.getByTestId('auth.login-verification.verification')).toBeTruthy();
    expect(screen.getByText('驗證成功後會自動重新登入。')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('auth.login-verification.code.input'), '123456');
    fireEvent.press(screen.getByTestId('auth.login-verification.complete'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(2));
    expect(mockVerifyEmail).toHaveBeenCalledWith('legacy@example.com', '123456');
    expect(mockSetToken).toHaveBeenCalledWith('jwt-token');
    expect(mockRouterReplace).toHaveBeenCalledWith('/case');
  });

  it('localizes a backend WEAK_PASSWORD response during registration', async () => {
    mockRegister.mockRejectedValueOnce({
      code: 'WEAK_PASSWORD',
      message: 'raw backend message',
    });
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.press(screen.getByTestId('auth.mode.register'));
    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'weak@example.com');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    fireEvent.press(screen.getByTestId('auth.submit'));
    await waitFor(() => expect(mockSendVerificationCode).toHaveBeenCalledTimes(1));
    fireEvent.changeText(screen.getByTestId('auth.registration.code.input'), '123456');
    fireEvent.press(screen.getByTestId('auth.registration.complete'));

    expect(await screen.findByText(
      '密碼未符合安全規則，請使用 8–128 個字元並包含字母與數字，避免常見密碼。'
    )).toBeTruthy();
  });

  it('keeps a proof only in memory for a safe register retry', async () => {
    mockRegister
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'offline' })
      .mockResolvedValueOnce({ token: 'jwt-token' });
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.press(screen.getByTestId('auth.mode.register'));
    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'retry@example.com');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    fireEvent.press(screen.getByTestId('auth.submit'));
    await waitFor(() => expect(mockSendVerificationCode).toHaveBeenCalledTimes(1));

    fireEvent.changeText(screen.getByTestId('auth.registration.code.input'), '123456');
    fireEvent.press(screen.getByTestId('auth.registration.complete'));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockVerifyRegistrationCode).toHaveBeenCalledTimes(1);
    expect(mockSetToken).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('auth.registration.complete'));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(2));
    expect(mockVerifyRegistrationCode).toHaveBeenCalledTimes(1);
    expect(mockSetToken).toHaveBeenCalledWith('jwt-token');
    expect(JSON.stringify({
      sessionStorage: mockSetSessionId.mock.calls,
      telemetry: mockCaptureTelemetry.mock.calls,
      tokenStorage: mockSetToken.mock.calls,
    })).not.toContain('rp1_registration-proof');
  });

  it('clears the in-memory proof before resending a registration code', async () => {
    mockSendVerificationCode.mockResolvedValue({ expires_in: 300, resend_after: 0 });
    mockVerifyRegistrationCode
      .mockResolvedValueOnce({
        verified: true,
        registration_proof: 'rp1_first-proof',
        registration_proof_expires_in: 600,
      })
      .mockResolvedValueOnce({
        verified: true,
        registration_proof: 'rp1_second-proof',
        registration_proof_expires_in: 600,
      });
    mockRegister
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'offline' })
      .mockResolvedValueOnce({ token: 'jwt-token' });
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.press(screen.getByTestId('auth.mode.register'));
    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'resend@example.com');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    fireEvent.press(screen.getByTestId('auth.submit'));
    await waitFor(() => expect(mockSendVerificationCode).toHaveBeenCalledTimes(1));
    fireEvent.changeText(screen.getByTestId('auth.registration.code.input'), '123456');
    fireEvent.press(screen.getByTestId('auth.registration.complete'));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByTestId('auth.registration.resend'));
    await waitFor(() => expect(mockSendVerificationCode).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('auth.registration.code.input').props.value).toBe('');
    fireEvent.changeText(screen.getByTestId('auth.registration.code.input'), '654321');
    fireEvent.press(screen.getByTestId('auth.registration.complete'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(2));
    expect(mockVerifyRegistrationCode).toHaveBeenCalledTimes(2);
    expect(mockRegister).toHaveBeenLastCalledWith(expect.objectContaining({
      registration_proof: 'rp1_second-proof',
    }));
  });

  it('discards an expired registration proof and keeps the user in verification', async () => {
    mockRegister.mockRejectedValueOnce({
      code: 'REGISTRATION_PROOF_EXPIRED',
      message: 'raw backend message',
    });
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.press(screen.getByTestId('auth.mode.register'));
    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'expired@example.com');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    fireEvent.press(screen.getByTestId('auth.submit'));
    await waitFor(() => expect(mockSendVerificationCode).toHaveBeenCalledTimes(1));
    fireEvent.changeText(screen.getByTestId('auth.registration.code.input'), '123456');
    fireEvent.press(screen.getByTestId('auth.registration.complete'));

    expect(await screen.findByText('這次註冊驗證已過期，請重新寄送驗證碼。')).toBeTruthy();
    expect(screen.getByText('請重新寄送驗證碼，再完成註冊。')).toBeTruthy();
    expect(screen.getByTestId('auth.registration.code.input').props.value).toBe('');
    expect(screen.getByTestId('auth.registration.verification')).toBeTruthy();
  });

  it('clears registration verification when changing mode or going back to edit email', async () => {
    const screen = renderWithQuery(React.createElement(AuthScreen));

    fireEvent.press(screen.getByTestId('auth.mode.register'));
    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'first@example.com');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    fireEvent.press(screen.getByTestId('auth.submit'));
    await waitFor(() => expect(mockSendVerificationCode).toHaveBeenCalledTimes(1));
    fireEvent.changeText(screen.getByTestId('auth.registration.code.input'), '123456');

    fireEvent.press(screen.getByTestId('auth.mode.login'));
    expect(screen.queryByTestId('auth.registration.verification')).toBeNull();
    fireEvent.press(screen.getByTestId('auth.mode.register'));
    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'second@example.com');
    fireEvent.press(screen.getByTestId('auth.submit'));
    await waitFor(() => expect(mockSendVerificationCode).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('auth.registration.code.input').props.value).toBe('');

    fireEvent.press(screen.getByTestId('auth.registration.back'));
    expect(screen.queryByTestId('auth.registration.verification')).toBeNull();
    expect(screen.getByTestId('auth.email.input').props.value).toBe('second@example.com');
    fireEvent.changeText(screen.getByTestId('auth.email.input'), 'third@example.com');
    fireEvent.press(screen.getByTestId('auth.submit'));
    await waitFor(() => expect(mockSendVerificationCode).toHaveBeenCalledTimes(3));
    expect(mockSendVerificationCode).toHaveBeenLastCalledWith('third@example.com', 'register');
  });

  it('renders auth form and validation in the selected locale', () => {
    setLocale('en-US', { persist: false });
    const screen = renderWithQuery(React.createElement(AuthScreen));

    expect(screen.getByText('Save your progress')).toBeTruthy();
    expect(screen.getByText('Account details')).toBeTruthy();
    expect(screen.getByText('Log in and save')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'bad-email');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'short');

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
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
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
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
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

  it('rotates identity and removes A private caches before installing B login', async () => {
    const screen = renderWithQuery(React.createElement(AuthScreen));
    const oldChatKey = identityScopedQueryKey(0, 'm3', 'chat-messages', 'room-1');
    screen.queryClient.setQueryData(oldChatKey, {
      messages: [{ content: 'account-a-private-message' }],
    });
    screen.queryClient.setQueryData(['m2', 'psych-profile'], {
      narrative: 'account-a-private-profile',
    });
    screen.queryClient.setQueryData(['public-static', 'catalog'], 'keep-public');

    fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'account-b@example.com');
    fireEvent.changeText(screen.getByTestId('auth.password.input'), 'password-123');
    fireEvent.press(screen.getByText('登入並保存'));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/case'));
    expect(getIdentityQueryScopeEpoch(screen.queryClient)).toBe(1);
    expect(screen.queryClient.getQueryData(oldChatKey)).toBeUndefined();
    expect(screen.queryClient.getQueryData(['m2', 'psych-profile'])).toBeUndefined();
    expect(screen.queryClient.getQueryData(['public-static', 'catalog'])).toBe('keep-public');
    expect(JSON.stringify(screen.queryClient.getQueryCache().getAll().map((query) => query.state.data)))
      .not.toContain('account-a-private');
    expect(screen.queryClient.getQueryData(['app', 'auth-token'])).toBe('jwt-token');
  });

  it('fails closed and removes private caches when credential clearing fails', async () => {
    mockClearAppStorageWithPushCleanup.mockRejectedValueOnce(new Error('secure-store-failed'));
    const screen = renderWithQuery(React.createElement(AuthScreen));
    const oldAnalysisKey = identityScopedQueryKey(0, 'm3', 'chat-analysis-requests', 'room-1');
    screen.queryClient.setQueryData(oldAnalysisKey, [{ source: 'account-a-private-analysis' }]);
    screen.queryClient.setQueryData(['public-static', 'catalog'], 'keep-public');

    fireEvent.press(screen.getByText('清理本機會話'));

    await waitFor(() => expect(mockClearAppStorageWithPushCleanup).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.queryClient.getQueryData(oldAnalysisKey)).toBeUndefined();
    });
    expect(screen.queryClient.getQueryData(['public-static', 'catalog'])).toBe('keep-public');
    expect(screen.queryClient.getQueryData(['app', 'auth-token'])).toBeNull();
    expect(screen.queryClient.getQueryData(['app', 'session-id'])).toBeNull();
    expect(screen.queryClient.getQueryData(['app', 'identity-query-scope']))
      .toEqual(expect.objectContaining({ privateDataEnabled: false, transitioning: false }));
  });
});
