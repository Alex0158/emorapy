const React = require('react');
const { act, fireEvent, render, waitFor } = require('@testing-library/react-native');
const { notifyManager, QueryClient, QueryClientProvider } = require('@tanstack/react-query');

let mockSearchParams = {};
let mockLifecycleStatus = 'active';
let mockLifecycleListener = null;
const mockSubscribeLifecycle = jest.fn((listener) => {
  mockLifecycleListener = listener;
  return jest.fn();
});
const mockRouterPush = jest.fn();
const mockGetPsychProfile = jest.fn();
const mockGiveConsent = jest.fn();
const mockDeleteAllData = jest.fn();
const mockGetFeedbackHistory = jest.fn();
const mockCheckResume = jest.fn();
const mockStartSession = jest.fn();
const mockGetInterviewSession = jest.fn();
const mockRespond = jest.fn();
const mockSkip = jest.fn();
const mockEndSession = jest.fn();
const mockCancel = jest.fn();
const mockRetryFailed = jest.fn();
const mockConnectInterviewStream = jest.fn();
const mockGetToken = jest.fn();

jest.mock('expo-router', () => ({
  Link: ({ children }) => {
    const React = require('react');
    return React.createElement(React.Fragment, null, children);
  },
  router: {
    push: mockRouterPush,
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/src/features/m2/api', () => ({
  connectInterviewStream: mockConnectInterviewStream,
  normalizeM2Error: (error) => ({ message: error?.message || '請稍後再試。' }),
  m2Api: {
    interview: {
      checkResume: mockCheckResume,
      cancel: mockCancel,
      endSession: mockEndSession,
      getSession: mockGetInterviewSession,
      retryFailed: mockRetryFailed,
      respond: mockRespond,
      skip: mockSkip,
      startSession: mockStartSession,
    },
    psychProfile: {
      deleteAllData: mockDeleteAllData,
      getFeedbackHistory: mockGetFeedbackHistory,
      getProfile: mockGetPsychProfile,
      giveConsent: mockGiveConsent,
    },
  },
}));

jest.mock('@/src/platform/storage/secureStore', () => ({
  tokenStorage: {
    getToken: mockGetToken,
  },
}));

jest.mock('@/src/platform/lifecycle/native', () => ({
  getCurrentLifecycleStatus: () => mockLifecycleStatus,
  subscribeLifecycle: (listener) => mockSubscribeLifecycle(listener),
}));

const ProfileScreen = require('../app/(app)/profile/index').default;
const InterviewScreen = require('../app/(app)/profile/interview').default;
const MyStoryScreen = require('../app/(app)/profile/story').default;
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

describe('M2 Profile/Interview screens', () => {
  beforeAll(() => {
    notifyManager.setNotifyFunction((callback) => {
      act(callback);
    });
  });

  afterAll(() => {
    notifyManager.setNotifyFunction((callback) => {
      callback();
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
    mockSearchParams = {};
    mockLifecycleStatus = 'active';
    mockLifecycleListener = null;
    mockSubscribeLifecycle.mockClear();
    mockGetPsychProfile.mockResolvedValue({
      consent_given: false,
      narratives: [],
      insights: [],
      richness_score: 0,
    });
    mockGiveConsent.mockResolvedValue(undefined);
    mockDeleteAllData.mockResolvedValue(undefined);
    mockGetFeedbackHistory.mockResolvedValue({ history: [] });
    mockCheckResume.mockResolvedValue(null);
    mockStartSession.mockResolvedValue({ id: 'interview-1' });
    mockGetInterviewSession.mockResolvedValue({
      id: 'interview-1',
      status: 'active',
      turns: [{ ai_message: '開始說一點你現在最想被理解的事。' }],
      domains_touched: [],
    });
    mockRespond.mockResolvedValue({ id: 'turn-2' });
    mockSkip.mockResolvedValue({ id: 'turn-2' });
    mockEndSession.mockResolvedValue({ id: 'interview-1', status: 'completed' });
    mockCancel.mockResolvedValue({ id: 'interview-1', status: 'cancelled' });
    mockRetryFailed.mockResolvedValue(undefined);
    mockConnectInterviewStream.mockImplementation((_sessionId, callbacks) => {
      callbacks.onReady?.({ scopeType: 'interview_session', scopeId: 'interview-1', snapshots: [] });
      return new Promise(() => undefined);
    });
    mockGetToken.mockResolvedValue('jwt-token');
  });

  afterEach(() => {
    while (queryClients.length) {
      queryClients.pop().clear();
    }
  });

  it('gives consent before starting a new interview and routes into the session', async () => {
    const screen = renderWithQuery(React.createElement(ProfileScreen));

    fireEvent.press(await screen.findByText('同意並開始訪談'));

    await waitFor(() => expect(mockGiveConsent).toHaveBeenCalledTimes(1));
    expect(mockStartSession).toHaveBeenCalledWith('organic');
    expect(mockRouterPush).toHaveBeenCalledWith('/profile/interview?sessionId=interview-1');
  });

  it('renders my-story counts and recent feedback history', async () => {
    mockGetPsychProfile.mockResolvedValueOnce({
      consent_given: true,
      narratives: [{ id: 'n1' }],
      insights: [{ id: 'i1' }, { id: 'i2' }],
      richness_score: 42,
    });
    mockGetFeedbackHistory.mockResolvedValueOnce({
      history: [
        {
          session_id: 'sess-1',
          feedback_card: JSON.stringify({
            summary: '你更在意被尊重。',
            encouragement: '能把這件事說清楚不容易。',
            continuation_hint: '下次可以繼續聊界線。',
          }),
          domains_touched: [],
          created_at: 'a',
          updated_at: 'b',
        },
      ],
    });

    const screen = renderWithQuery(React.createElement(MyStoryScreen));

    expect(await screen.findByText('第 1 次訪談回饋')).toBeTruthy();
    expect(screen.queryByText('sess-1')).toBeNull();
    expect(screen.getByText(/你更在意被尊重。/)).toBeTruthy();
    expect(screen.getByText(/下次可以繼續聊界線。/)).toBeTruthy();
    expect(screen.getByText('1 段')).toBeTruthy();
    expect(screen.getByText('2 條')).toBeTruthy();
    expect(screen.getByText('1 次')).toBeTruthy();
  });

  it('lets users retry a failed interview processing run from profile', async () => {
    mockCheckResume.mockResolvedValueOnce({
      has_pending: false,
      has_failed: true,
      failed_session_id: 'interview-failed',
    });

    const screen = renderWithQuery(React.createElement(ProfileScreen));

    fireEvent.press(await screen.findByText('重試上次整理'));

    await waitFor(() => expect(mockRetryFailed).toHaveBeenCalledWith('interview-failed'));
    expect(mockRouterPush).toHaveBeenCalledWith('/profile/story');
  });

  it('uses localized Profile and My Story screen labels instead of old English eyebrows', async () => {
    const profileScreen = renderWithQuery(React.createElement(ProfileScreen));

    expect((await profileScreen.findAllByText('個人脈絡')).length).toBeGreaterThan(0);
    expect(profileScreen.queryByText('PROFILE')).toBeNull();
    profileScreen.unmount();

    const storyScreen = renderWithQuery(React.createElement(MyStoryScreen));

    expect((await storyScreen.findAllByText('我的故事')).length).toBeGreaterThan(0);
    expect(storyScreen.queryByText('MY STORY')).toBeNull();
    expect(storyScreen.queryByText('回到 Profile')).toBeNull();
  });

  it('renders profile auth gate in the selected locale', async () => {
    setLocale('en-US', { persist: false });
    mockGetToken.mockResolvedValueOnce(null);

    const screen = renderWithQuery(React.createElement(ProfileScreen));

    expect(await screen.findByText('Save progress first')).toBeTruthy();
    expect(screen.getByText('Available after login')).toBeTruthy();
    expect(screen.getByText('Guided interview')).toBeTruthy();
    expect(screen.getByText('Log in or register')).toBeTruthy();
  });

  it('renders profile home statistics and actions in the selected locale', async () => {
    setLocale('en-US', { persist: false });
    mockGetPsychProfile.mockResolvedValueOnce({
      consent_given: true,
      narratives: [{ id: 'n1' }, { id: 'n2' }],
      insights: [{ id: 'i1' }],
      richness_score: 42,
    });

    const screen = renderWithQuery(React.createElement(ProfileScreen));

    expect(await screen.findByText('Help the system understand you')).toBeTruthy();
    expect(screen.getByText('Psych profile consented')).toBeTruthy();
    expect(screen.getByText('Current score 42; you can keep adding context over time.')).toBeTruthy();
    expect(screen.getByText('2 context entries and 1 insights organized.')).toBeTruthy();
    expect(screen.getByText('Start a new interview')).toBeTruthy();
    expect(screen.getByText('View My Story')).toBeTruthy();
  });

  it('renders my story auth gate in the selected locale', async () => {
    setLocale('en-US', { persist: false });
    mockGetToken.mockResolvedValueOnce(null);

    const screen = renderWithQuery(React.createElement(MyStoryScreen));

    expect(await screen.findByText('Log in first')).toBeTruthy();
    expect(screen.getByText('Data protection')).toBeTruthy();
    expect(screen.getByText('No local preload')).toBeTruthy();
    expect(screen.getByText('Log in or register')).toBeTruthy();
  });

  it('renders my story counts and actions in the selected locale', async () => {
    setLocale('en-US', { persist: false });
    mockGetPsychProfile.mockResolvedValueOnce({
      consent_given: true,
      narratives: [{ id: 'n1' }, { id: 'n2' }],
      insights: [{ id: 'i1' }],
      richness_score: 42,
    });
    mockGetFeedbackHistory.mockResolvedValueOnce({
      history: [{
        session_id: 'sess-1',
        feedback_card: null,
        domains_touched: [],
        created_at: 'a',
        updated_at: 'b',
      }],
    });

    const screen = renderWithQuery(React.createElement(MyStoryScreen));

    expect(await screen.findByText('Manageable')).toBeTruthy();
    expect(screen.getAllByText('My Story').length).toBeGreaterThan(0);
    expect(screen.getByText('2 entries')).toBeTruthy();
    expect(screen.getByText('1 insights')).toBeTruthy();
    expect(screen.getByText('1 rounds')).toBeTruthy();
    expect(screen.getByText('Interview feedback 1')).toBeTruthy();
    expect(screen.getByText('Feedback is still being organized')).toBeTruthy();
    expect(screen.getByText('Back to personal context')).toBeTruthy();
  });

  it('uses user-facing auth-gate wording before interview sync', async () => {
    mockGetToken.mockReturnValueOnce(null);

    const screen = renderWithQuery(React.createElement(InterviewScreen));
    await waitFor(() => expect(mockGetToken).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText('訪談需要登入後才會讀取並同步。')).toBeTruthy();
    expect(screen.getByText('心理訪談')).toBeTruthy();
    expect(screen.getByText('不匿名同步')).toBeTruthy();
    expect(screen.getByText('可回到個人脈絡')).toBeTruthy();
    expect(screen.queryByText('INTERVIEW')).toBeNull();
    expect(screen.queryByText(/Profile/)).toBeNull();
    expect(screen.queryByText('訪談需要登入後才會讀取或串流。')).toBeNull();
    expect(screen.queryByText('不匿名串流')).toBeNull();
  });

  it('replays interview stream snapshots and refetches canonical session when persisted', async () => {
    mockSearchParams = { sessionId: 'interview-1' };
    mockConnectInterviewStream.mockImplementationOnce((_sessionId, callbacks, options) => {
      expect(options.afterSeq).toBeUndefined();
      setTimeout(() => {
        callbacks.onReady?.({
          scopeType: 'interview_session',
          scopeId: 'interview-1',
          snapshots: [{
            streamId: 'stream-1',
            requestId: 'req-1',
            scopeType: 'interview_session',
            scopeId: 'interview-1',
            status: 'streaming',
            lastSeq: 3,
            text: '我正在整理',
            updatedAt: '2026-05-08T00:00:00.000Z',
          }],
        });
        callbacks.onEvent?.({
          eventType: 'stream.delta',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'interview_session',
          scopeId: 'interview-1',
          seq: 4,
          createdAt: '2026-05-08T00:00:01.000Z',
          deltaText: '你的故事。',
        });
        callbacks.onEvent?.({
          eventType: 'stream.persisted',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'interview_session',
          scopeId: 'interview-1',
          seq: 5,
          createdAt: '2026-05-08T00:00:02.000Z',
          fullText: '完成。',
        });
      }, 0);
      return new Promise(() => undefined);
    });

    const screen = renderWithQuery(React.createElement(InterviewScreen));

    expect(await screen.findByText('完成。')).toBeTruthy();
    await waitFor(() => expect(mockGetInterviewSession).toHaveBeenCalledTimes(2));
    expect(mockConnectInterviewStream).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        onReady: expect.any(Function),
        onEvent: expect.any(Function),
      }),
      expect.objectContaining({ signal: expect.any(Object) })
    );
    expect(screen.getByText('同步狀態')).toBeTruthy();
    expect(screen.getByText('訪談整理已保存。')).toBeTruthy();
    expect(screen.queryByText('第 5 段')).toBeNull();
  });

  it('recovers interview stream from last seq after app foregrounds', async () => {
    const connections = [];
    mockSearchParams = { sessionId: 'interview-recover' };
    mockGetInterviewSession.mockResolvedValue({
      id: 'interview-recover',
      status: 'active',
      turns: [{ ai_message: '開始說一點你現在最想被理解的事。' }],
      domains_touched: [],
    });
    mockConnectInterviewStream.mockImplementation((sessionId, callbacks, options) => {
      connections.push({ sessionId, callbacks, options });
      return new Promise(() => undefined);
    });

    const screen = renderWithQuery(React.createElement(InterviewScreen));

    await waitFor(() => expect(mockConnectInterviewStream).toHaveBeenCalledTimes(1));
    expect(connections[0].sessionId).toBe('interview-recover');
    expect(connections[0].options.afterSeq).toBeUndefined();

    act(() => {
      connections[0].callbacks.onReady({
        scopeType: 'interview_session',
        scopeId: 'interview-recover',
        snapshots: [{
          streamId: 'stream-recover',
          requestId: 'req-recover',
          scopeType: 'interview_session',
          scopeId: 'interview-recover',
          status: 'streaming',
          lastSeq: 6,
          text: '我正在整理',
          updatedAt: '2026-05-08T00:00:00.000Z',
        }],
      });
    });
    expect(await screen.findByText('我正在整理')).toBeTruthy();

    act(() => {
      mockLifecycleStatus = 'background';
      mockLifecycleListener('background');
    });

    await waitFor(() => expect(connections[0].options.signal.aborted).toBe(true));
    expect(await screen.findByText('App 在背景 / 正在恢復')).toBeTruthy();
    expect(screen.getByText('正在恢復訪談整理，會從最近收到的內容繼續。')).toBeTruthy();
    expect(screen.queryByText('第 6 段')).toBeNull();

    act(() => {
      mockLifecycleStatus = 'active';
      mockLifecycleListener('active');
    });

    await waitFor(() => expect(mockConnectInterviewStream).toHaveBeenCalledTimes(2));
    expect(connections[1].sessionId).toBe('interview-recover');
    expect(connections[1].options.afterSeq).toBe(6);

    act(() => {
      connections[1].callbacks.onEvent({
        eventType: 'stream.delta',
        streamId: 'stream-recover',
        requestId: 'req-recover',
        scopeType: 'interview_session',
        scopeId: 'interview-recover',
        seq: 7,
        createdAt: '2026-05-08T00:00:01.000Z',
        deltaText: '你的故事。',
      });
    });

    expect(await screen.findByText('我正在整理你的故事。')).toBeTruthy();
    expect(screen.getByText('正在同步訪談整理。')).toBeTruthy();
    expect(screen.queryByText('第 7 段')).toBeNull();
  });

  it('renders failed interview retry state without allowing new answers', async () => {
    mockSearchParams = { sessionId: 'interview-failed' };
    mockGetInterviewSession.mockResolvedValueOnce({
      id: 'interview-failed',
      status: 'processing_failed',
      turns: [{ ai_message: '前一次問題。' }],
      domains_touched: ['personality'],
    });

    const screen = renderWithQuery(React.createElement(InterviewScreen));

    expect(await screen.findByText('整理失敗')).toBeTruthy();
    expect(screen.getByText('個性特質')).toBeTruthy();
    expect(screen.queryByText('personality')).toBeNull();
    expect(screen.queryByTestId('profile.interview.message.input')).toBeNull();

    fireEvent.press(screen.getByText('重試整理'));

    await waitFor(() => expect(mockRetryFailed).toHaveBeenCalledWith('interview-failed'));
  });

  it('renders partial-success completed sessions as read-only without retry', async () => {
    mockSearchParams = { sessionId: 'interview-partial' };
    mockGetInterviewSession.mockResolvedValueOnce({
      id: 'interview-partial',
      status: 'completed',
      partial_success: true,
      pipeline_step: 6,
      turns: [{ ai_message: '最後一題。' }],
      domains_touched: ['relationship_history'],
    });

    const screen = renderWithQuery(React.createElement(InterviewScreen));

    expect(await screen.findByText('訪談已結束')).toBeTruthy();
    expect(screen.getByText(/核心脈絡已整理完成/)).toBeTruthy();
    expect(screen.getByText('感情經歷')).toBeTruthy();
    expect(screen.queryByText('relationship_history')).toBeNull();
    expect(screen.queryByText('重試整理')).toBeNull();
    expect(screen.queryByTestId('profile.interview.message.input')).toBeNull();
  });
});
