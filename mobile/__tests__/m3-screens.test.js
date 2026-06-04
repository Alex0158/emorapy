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
const mockCreateQuickSession = jest.fn();
const mockRefreshQuickSession = jest.fn();
const mockGetSessionId = jest.fn();
const mockSetSessionId = jest.fn();
const mockGetToken = jest.fn();
const mockSetPendingHref = jest.fn();
const mockCreateRoom = jest.fn();
const mockGetRoom = jest.fn();
const mockListMessages = jest.fn();
const mockGetJudgmentStatus = jest.fn();
const mockSendMessage = jest.fn();
const mockCreateInvite = jest.fn();
const mockAcceptInvite = jest.fn();
const mockDeclineInvite = jest.fn();
const mockRequestJudgment = jest.fn();
const mockLeaveRoom = jest.fn();
const mockConnectChatRoomStream = jest.fn();
const mockConnectChatAIStream = jest.fn();
const mockCaptureTelemetry = jest.fn();

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

jest.mock('@/src/features/m1/api', () => ({
  m1Api: {
    session: {
      createQuickSession: mockCreateQuickSession,
      refreshQuickSession: mockRefreshQuickSession,
    },
  },
}));

jest.mock('@/src/features/m3/api', () => ({
  connectChatAIStream: mockConnectChatAIStream,
  connectChatRoomStream: mockConnectChatRoomStream,
  normalizeM3Error: (error) => ({ message: error?.message || '請稍後再試。' }),
  m3Api: {
    chat: {
      acceptInvite: mockAcceptInvite,
      createInvite: mockCreateInvite,
      createRoom: mockCreateRoom,
      declineInvite: mockDeclineInvite,
      getJudgmentStatus: mockGetJudgmentStatus,
      getRoom: mockGetRoom,
      leaveRoom: mockLeaveRoom,
      listMessages: mockListMessages,
      requestJudgment: mockRequestJudgment,
      sendMessage: mockSendMessage,
    },
  },
}));

jest.mock('@/src/platform/storage/secureStore', () => ({
  pendingLandingStorage: {
    setPendingHref: mockSetPendingHref,
  },
  sessionStorage: {
    getSessionId: mockGetSessionId,
    setSessionId: mockSetSessionId,
  },
  tokenStorage: {
    getToken: mockGetToken,
  },
}));

jest.mock('@/src/platform/telemetry/client', () => ({
  captureTelemetry: mockCaptureTelemetry,
}));

jest.mock('@/src/platform/lifecycle/native', () => ({
  getCurrentLifecycleStatus: () => mockLifecycleStatus,
  subscribeLifecycle: (listener) => mockSubscribeLifecycle(listener),
}));

const ChatScreen = require('../app/(app)/chat/index').default;
const ChatRoomScreen = require('../app/(app)/chat/room').default;
const ChatInviteScreen = require('../app/(app)/chat/invite').default;
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

describe('M3 Chat screens', () => {
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
    mockGetToken.mockResolvedValue(null);
    mockGetSessionId.mockResolvedValue(null);
    mockSetSessionId.mockResolvedValue(undefined);
    mockSetPendingHref.mockResolvedValue(undefined);
    mockCreateQuickSession.mockResolvedValue({ session_id: 'guest-new' });
    mockRefreshQuickSession.mockResolvedValue({ session_id: 'guest-existing' });
    mockCreateRoom.mockResolvedValue({ id: 'room-1', status: 'solo_active' });
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
      participants: [],
    });
    mockListMessages.mockResolvedValue({
      messages: [
        {
          id: 'm1',
          content: 'hello from A',
          message_type: 'user_text',
          visibility_scope: 'all',
          created_at: '2026-05-08T00:00:00.000Z',
          sender_participant: { role_in_room: 'roleA' },
        },
      ],
      nextCursor: null,
    });
    mockGetJudgmentStatus.mockResolvedValue({ roomStatus: 'solo_active' });
    mockSendMessage.mockResolvedValue({ id: 'm2' });
    mockCreateInvite.mockResolvedValue({ id: 'invite-1', invite_code: 'ABC123', status: 'pending' });
    mockAcceptInvite.mockResolvedValue({ id: 'room-2' });
    mockDeclineInvite.mockResolvedValue({ id: 'invite-1', status: 'revoked' });
    mockRequestJudgment.mockResolvedValue({ roomId: 'room-1', caseId: 'case-1', status: 'judgment_requested' });
    mockLeaveRoom.mockResolvedValue({ id: 'room-1', status: 'archived' });
    mockConnectChatAIStream.mockImplementation((_roomId, callbacks) => {
      callbacks.onReady?.({ scopeType: 'chat_room', scopeId: 'room-1', snapshots: [] });
      return new Promise(() => undefined);
    });
    mockConnectChatRoomStream.mockResolvedValue(undefined);
  });

  afterEach(() => {
    while (queryClients.length) {
      queryClients.pop().clear();
    }
  });

  it('creates an anonymous session before starting a chat room', async () => {
    const screen = renderWithQuery(React.createElement(ChatScreen));

    expect(screen.getAllByText('對話').length).toBeGreaterThan(0);
    expect(screen.getByText('共同整理')).toBeTruthy();
    expect(screen.queryByText('CHAT')).toBeNull();
    expect(screen.queryByText('已有對話房間代號')).toBeNull();
    expect(screen.queryByPlaceholderText('輸入對話房間代號')).toBeNull();
    expect(screen.queryByText('房間')).toBeNull();
    fireEvent.press(screen.getByText('開始新的對話'));

    await waitFor(() => expect(mockCreateRoom).toHaveBeenCalledTimes(1));
    expect(mockCreateQuickSession).toHaveBeenCalledTimes(1);
    expect(mockSetSessionId).toHaveBeenCalledWith('guest-new');
    expect(mockRouterPush).toHaveBeenCalledWith('/chat/room?roomId=room-1');
  });

  it('renders chat home in the selected locale', () => {
    setLocale('en-US', { persist: false });

    const screen = renderWithQuery(React.createElement(ChatScreen));

    expect(screen.getByText('Chat before analysis')).toBeTruthy();
    expect(screen.getByText('Let the conversation collect context before deciding whether to request analysis.')).toBeTruthy();
    expect(screen.getByText('Start a new chat')).toBeTruthy();
    expect(screen.getByText('Have an invite code')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter the invite code from the other person')).toBeTruthy();
    expect(screen.getByText('Accept invite')).toBeTruthy();
    expect(screen.getByText('Open invite page')).toBeTruthy();
    expect(screen.getByText('Conversation stages')).toBeTruthy();
    expect(screen.getByText('Shared organizing')).toBeTruthy();
    expect(screen.getByText('View case track')).toBeTruthy();
    expect(screen.getByText('View personal context')).toBeTruthy();
    expect(screen.queryByText('先聊再判')).toBeNull();
    expect(screen.queryByText('已有邀請碼')).toBeNull();
  });

  it('guides missing chat room context back to supported entry paths', () => {
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(screen.getAllByText('對話').length).toBeGreaterThan(0);
    expect(screen.getByText('請先建立新的對話，或從邀請連結進入。')).toBeTruthy();
    expect(screen.getByText('缺少對話')).toBeTruthy();
    expect(screen.queryByText('CHAT')).toBeNull();
    expect(screen.queryByText(/房間代號/)).toBeNull();
    expect(screen.queryByText(/房間/)).toBeNull();
    expect(screen.getByText('回到對話')).toBeTruthy();
  });

  it('uses localized invite screen label instead of the old English eyebrow', () => {
    mockSearchParams = { code: 'ABC123' };
    const screen = renderWithQuery(React.createElement(ChatInviteScreen));

    expect(screen.getAllByText('邀請').length).toBeGreaterThan(0);
    expect(screen.queryByText('INVITE')).toBeNull();
  });

  it('renders invite landing in the selected locale', async () => {
    setLocale('en-US', { persist: false });
    mockSearchParams = { code: 'ABC123' };

    const screen = renderWithQuery(React.createElement(ChatInviteScreen));

    expect(await screen.findByText('Join chat')).toBeTruthy();
    expect(screen.getByText('After accepting, you will join this chat as side B.')).toBeTruthy();
    expect(screen.getAllByText('Back to chat').length).toBeGreaterThan(0);
    expect(screen.getByText('Invite code')).toBeTruthy();
    expect(screen.getByText('Login required')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter invite code')).toBeTruthy();
    expect(screen.getByText('Accept invite')).toBeTruthy();
    expect(screen.getByText('Decline / revoke invite')).toBeTruthy();
    expect(screen.getByText('After joining')).toBeTruthy();
    expect(screen.getByText('History visibility')).toBeTruthy();
    expect(screen.queryByText('加入對話')).toBeNull();
    expect(screen.queryByText('拒絕 / 撤回邀請')).toBeNull();
  });

  it('defers chat home invite accept to auth when no token exists', async () => {
    const screen = renderWithQuery(React.createElement(ChatScreen));

    fireEvent.changeText(screen.getByPlaceholderText(/邀請碼/), 'ABC123');
    fireEvent.press(screen.getByText('接受邀請'));

    await waitFor(() => expect(mockSetPendingHref).toHaveBeenCalledWith('/chat/invite?code=ABC123'));
    expect(mockAcceptInvite).not.toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith('/auth?next=%2Fchat%2Finvite%3Fcode%3DABC123');
    expect(mockCaptureTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        source: 'chat_home',
      }),
      name: 'chat_invite_auth_handoff',
      route: '/chat',
    }));
  });

  it('renders room messages, sends all-visible message, and requests judgment with included ids', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('hello from A')).toBeTruthy();
    expect(screen.getByText('對話狀態')).toBeTruthy();
    expect(screen.queryByText('房間代號')).toBeNull();
    expect(screen.queryByText(/房間/)).toBeNull();
    expect(screen.queryByText('room-1')).toBeNull();
    expect(screen.getByText(/訊息時間：/)).toBeTruthy();
    expect(screen.queryByText('2026-05-08T00:00:00.000Z')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText(/說清楚一個具體片段/), 'new message');
    fireEvent.press(screen.getByText('送出訊息'));

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(1));
    expect(mockSendMessage).toHaveBeenCalledWith('room-1', {
      content: 'new message',
      visibility_scope: 'all',
    });

    fireEvent.press(screen.getByText('請求梳理'));

    await waitFor(() => expect(mockRequestJudgment).toHaveBeenCalledTimes(1));
    expect(mockRequestJudgment).toHaveBeenCalledWith('room-1', {
      included_message_ids: ['m1'],
      participant_consent: undefined,
    });
  });

  it('renders chat room chrome in the selected locale while preserving message content', async () => {
    setLocale('en-US', { persist: false });
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('hello from A')).toBeTruthy();
    expect(screen.getAllByText('Chat').length).toBeGreaterThan(0);
    expect(screen.getByText('Organize first, invite later, and request analysis only through an explicit action.')).toBeTruthy();
    expect(screen.getByText('Chat status')).toBeTruthy();
    expect(screen.getAllByText('Organizing alone').length).toBeGreaterThan(0);
    expect(screen.getByText('Visibility policy')).toBeTruthy();
    expect(screen.getByText('The other person only sees the key summary after joining')).toBeTruthy();
    expect(screen.getByText('Message sync')).toBeTruthy();
    expect(screen.getByText('Mediator draft')).toBeTruthy();
    expect(screen.getByText(/Message time:/)).toBeTruthy();
    expect(screen.getByText('Side A')).toBeTruthy();
    expect(screen.getByText('Can be included in analysis')).toBeTruthy();
    expect(screen.getByPlaceholderText('Describe one concrete moment without rushing to assign blame.')).toBeTruthy();
    expect(screen.getByText('Send message')).toBeTruthy();
    expect(screen.getByText('Generate invite code')).toBeTruthy();
    expect(screen.getByText('Move to analysis')).toBeTruthy();
    expect(screen.getByText('Request analysis')).toBeTruthy();
    expect(screen.getByText('Leave chat')).toBeTruthy();
    expect(screen.queryByText('對話狀態')).toBeNull();
    expect(screen.queryByText('請求梳理')).toBeNull();
  });

  it('shows a user-safe message time fallback when message timestamps are missing', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockListMessages.mockResolvedValueOnce({
      messages: [
        {
          id: 'm-no-time',
          content: '沒有時間也要安全顯示',
          message_type: 'user_text',
          visibility_scope: 'all',
          created_at: null,
          sender_participant: { role_in_room: 'roleA' },
        },
      ],
      nextCursor: null,
    });
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('沒有時間也要安全顯示')).toBeTruthy();
    expect(screen.getByText('訊息時間：時間待同步')).toBeTruthy();
  });

  it('shows chat AI stream draft and refreshes room data when persisted', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockConnectChatAIStream.mockImplementationOnce((_roomId, callbacks, options) => {
      expect(options.afterSeq).toBeUndefined();
      setTimeout(() => {
        callbacks.onReady?.({
          scopeType: 'chat_room',
          scopeId: 'room-1',
          snapshots: [{
            streamId: 'stream-1',
            requestId: 'req-1',
            scopeType: 'chat_room',
            scopeId: 'room-1',
            status: 'streaming',
            lastSeq: 2,
            text: '我先整理雙方脈絡',
            updatedAt: '2026-05-08T00:00:00.000Z',
          }],
        });
        callbacks.onEvent?.({
          eventType: 'stream.delta',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'chat_room',
          scopeId: 'room-1',
          seq: 3,
          createdAt: '2026-05-08T00:00:01.000Z',
          deltaText: '，再提示下一步。',
        });
        callbacks.onEvent?.({
          eventType: 'stream.persisted',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'chat_room',
          scopeId: 'room-1',
          seq: 4,
          createdAt: '2026-05-08T00:00:02.000Z',
          fullText: '已保存。',
        });
      }, 0);
      return new Promise(() => undefined);
    });

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('已保存。')).toBeTruthy();
    await waitFor(() => expect(mockListMessages).toHaveBeenCalledTimes(2));
    expect(mockConnectChatAIStream).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({
        onReady: expect.any(Function),
        onEvent: expect.any(Function),
      }),
      expect.objectContaining({ signal: expect.any(Object) })
    );
    expect(screen.getByText(/草稿已保存 \/ App 使用中/)).toBeTruthy();
    expect(screen.queryByText(/第 4 段/)).toBeNull();
  });

  it('does not expose raw chat AI stream errors in the selected locale', async () => {
    setLocale('en-US', { persist: false });
    mockSearchParams = { roomId: 'room-error' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-error',
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
      participants: [],
    });
    mockListMessages.mockResolvedValue({ messages: [], nextCursor: null });
    mockConnectChatAIStream.mockImplementationOnce((_roomId, callbacks) => {
      callbacks.onEvent?.({
        eventType: 'stream.failed',
        streamId: 'stream-error',
        requestId: 'req-error',
        scopeType: 'chat_room',
        scopeId: 'room-error',
        seq: 2,
        createdAt: '2026-05-08T00:00:01.000Z',
        error: { code: 'APP_ERROR', message: 'provider down' },
      });
      return new Promise(() => undefined);
    });

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('The stream update was interrupted. Try again later.')).toBeTruthy();
    expect(screen.queryByText('provider down')).toBeNull();
  });

  it('recovers chat AI stream from last seq after app foregrounds', async () => {
    const connections = [];
    mockSearchParams = { roomId: 'room-recover' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-recover',
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
      participants: [],
    });
    mockListMessages.mockResolvedValue({ messages: [], nextCursor: null });
    mockConnectChatAIStream.mockImplementation((roomId, callbacks, options) => {
      connections.push({ roomId, callbacks, options });
      return new Promise(() => undefined);
    });

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    await waitFor(() => expect(mockConnectChatAIStream).toHaveBeenCalledTimes(1));
    expect(connections[0].roomId).toBe('room-recover');
    expect(connections[0].options.afterSeq).toBeUndefined();

    act(() => {
      connections[0].callbacks.onReady({
        scopeType: 'chat_room',
        scopeId: 'room-recover',
        snapshots: [{
          streamId: 'stream-recover',
          requestId: 'req-recover',
          scopeType: 'chat_room',
          scopeId: 'room-recover',
          status: 'streaming',
          lastSeq: 2,
          text: '我先整理雙方脈絡',
          updatedAt: '2026-05-08T00:00:00.000Z',
        }],
      });
    });
    expect(await screen.findByText('我先整理雙方脈絡')).toBeTruthy();

    act(() => {
      mockLifecycleStatus = 'background';
      mockLifecycleListener('background');
    });

    await waitFor(() => expect(connections[0].options.signal.aborted).toBe(true));
    expect(await screen.findByText(/正在恢復協調草稿，會從最近收到的內容繼續。 \/ App 在背景/)).toBeTruthy();
    expect(screen.queryByText(/第 2 段/)).toBeNull();

    act(() => {
      mockLifecycleStatus = 'active';
      mockLifecycleListener('active');
    });

    await waitFor(() => expect(mockConnectChatAIStream).toHaveBeenCalledTimes(2));
    expect(connections[1].roomId).toBe('room-recover');
    expect(connections[1].options.afterSeq).toBe(2);

    act(() => {
      connections[1].callbacks.onEvent({
        eventType: 'stream.delta',
        streamId: 'stream-recover',
        requestId: 'req-recover',
        scopeType: 'chat_room',
        scopeId: 'room-recover',
        seq: 3,
        createdAt: '2026-05-08T00:00:01.000Z',
        deltaText: '，再提示下一步。',
      });
    });

    expect(await screen.findByText('我先整理雙方脈絡，再提示下一步。')).toBeTruthy();
    expect(screen.getByText(/正在生成協調草稿 \/ App 使用中/)).toBeTruthy();
    expect(screen.queryByText(/第 3 段/)).toBeNull();
  });

  it('accepts invite code from the invite landing', async () => {
    mockGetToken.mockResolvedValue('jwt-token');
    mockSearchParams = { code: 'ABC123' };
    const screen = renderWithQuery(React.createElement(ChatInviteScreen));

    expect(await screen.findByText('接受邀請後，你會以 B 方加入這段對話。')).toBeTruthy();
    expect(screen.queryByText(/房間/)).toBeNull();
    fireEvent.press(await screen.findByText('接受邀請'));

    await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalledWith('ABC123'));
    expect(mockRouterPush).toHaveBeenCalledWith('/chat/room?roomId=room-2');
  });

  it('defers invite landing accept to auth and preserves the invite code', async () => {
    mockSearchParams = { code: 'ABC123' };
    const screen = renderWithQuery(React.createElement(ChatInviteScreen));

    fireEvent.press(await screen.findByText('接受邀請'));

    await waitFor(() => expect(mockSetPendingHref).toHaveBeenCalledWith('/chat/invite?code=ABC123'));
    expect(mockAcceptInvite).not.toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith('/auth?next=%2Fchat%2Finvite%3Fcode%3DABC123');
    expect(mockCaptureTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        source: 'chat_invite_landing',
      }),
      name: 'chat_invite_auth_handoff',
      route: '/chat/invite',
    }));
  });

  it('labels declined invite results without showing raw backend status', async () => {
    mockSearchParams = { code: 'ABC123' };
    const screen = renderWithQuery(React.createElement(ChatInviteScreen));

    fireEvent.press(await screen.findByText('拒絕 / 撤回邀請'));

    await waitFor(() => expect(mockDeclineInvite).toHaveBeenCalledWith('ABC123'));
    expect(await screen.findByText('邀請已撤回')).toBeTruthy();
    expect(screen.queryByText('revoked')).toBeNull();
  });
});
