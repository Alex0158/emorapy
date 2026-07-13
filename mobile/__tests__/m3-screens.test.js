const React = require('react');
const { act, cleanup, fireEvent, render, waitFor } = require('@testing-library/react-native');
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
const mockListChannels = jest.fn();
const mockGetJudgmentStatus = jest.fn();
const mockGetRoomSafetyStatus = jest.fn();
const mockSendChannelMessage = jest.fn();
const mockGetPrivateContextPreference = jest.fn();
const mockUpdatePrivateContextPreference = jest.fn();
const mockUpdateSharedAdaptationConsent = jest.fn();
const mockCreateContextCapsule = jest.fn();
const mockGrantContextAuthorization = jest.fn();
const mockListContextCapsules = jest.fn();
const mockReviseContextCapsule = jest.fn();
const mockDiscardContextCapsule = jest.fn();
const mockListContextUsageReceipts = jest.fn();
const mockCreateAnalysisRequest = jest.fn();
const mockListAnalysisRequests = jest.fn();
const mockDecideAnalysisRequest = jest.fn();
const mockSubmitAnalysisRequest = jest.fn();
const mockRevokeAnalysisApproval = jest.fn();
const mockRevokeContextAuthorization = jest.fn();
const mockCreateInvite = jest.fn();
const mockAcceptInvite = jest.fn();
const mockDeclineInvite = jest.fn();
const mockRequestJudgment = jest.fn();
const mockLeaveRoom = jest.fn();
const mockConnectChatRoomStream = jest.fn();
const mockConnectChatChannelStream = jest.fn();
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
  connectChatChannelStream: mockConnectChatChannelStream,
  connectChatRoomStream: mockConnectChatRoomStream,
  normalizeM3Error: (error) => ({ message: error?.message || '請稍後再試。' }),
  m3Api: {
    chat: {
      acceptInvite: mockAcceptInvite,
      createInvite: mockCreateInvite,
      createContextCapsule: mockCreateContextCapsule,
      createAnalysisRequest: mockCreateAnalysisRequest,
      decideAnalysisRequest: mockDecideAnalysisRequest,
      createRoom: mockCreateRoom,
      declineInvite: mockDeclineInvite,
      getJudgmentStatus: mockGetJudgmentStatus,
      getRoomSafetyStatus: mockGetRoomSafetyStatus,
      getPrivateContextPreference: mockGetPrivateContextPreference,
      getRoom: mockGetRoom,
      leaveRoom: mockLeaveRoom,
      listChannels: mockListChannels,
      listContextCapsules: mockListContextCapsules,
      listContextUsageReceipts: mockListContextUsageReceipts,
      listAnalysisRequests: mockListAnalysisRequests,
      listMessages: mockListMessages,
      requestJudgment: mockRequestJudgment,
      revokeAnalysisApproval: mockRevokeAnalysisApproval,
      revokeContextAuthorization: mockRevokeContextAuthorization,
      reviseContextCapsule: mockReviseContextCapsule,
      discardContextCapsule: mockDiscardContextCapsule,
      sendChannelMessage: mockSendChannelMessage,
      submitAnalysisRequest: mockSubmitAnalysisRequest,
      grantContextAuthorization: mockGrantContextAuthorization,
      updatePrivateContextPreference: mockUpdatePrivateContextPreference,
      updateSharedAdaptationConsent: mockUpdateSharedAdaptationConsent,
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
const { ChatContextCapsuleComposer } = require('../src/features/m3/ChatContextCapsuleComposer');
const { setLocale } = require('@/src/i18n');
const { chatQueryKeys } = require('../src/features/m3/chatQueryKeys');
const {
  beginIdentityQueryTransition,
  completeIdentityQueryTransition,
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

function buildAnalysisRequest(status = 'approved') {
  return {
    id: 'analysis-1',
    room_id: 'room-1',
    requested_by_participant_id: 'participant-a',
    status,
    expires_at: '2099-01-01T00:00:00.000Z',
    selection_hash: 'a'.repeat(64),
    policy_version: 'chat-context-v1',
    required_participant_ids: ['participant-a', 'p-b'],
    selection_snapshot: {
      capsule_refs: [],
      message_refs: [{ id: 'm1', kind: 'chat_message', content_hash: 'b'.repeat(64) }],
    },
    participant_approvals: [
      {
        participant_id: 'participant-a',
        decision: 'approved',
        selection_hash: 'a'.repeat(64),
        policy_version: 'chat-context-v1',
        expires_at: '2099-01-01T00:00:00.000Z',
        revoked_at: null,
      },
      {
        participant_id: 'p-b',
        decision: 'approved',
        selection_hash: 'a'.repeat(64),
        policy_version: 'chat-context-v1',
        expires_at: '2099-01-01T00:00:00.000Z',
        revoked_at: null,
      },
    ],
    source_previews: {
      capsules: [],
      messages: [{
        kind: 'chat_message',
        id: 'm1',
        sender_role: 'roleA',
        content: 'hello from A',
        content_hash: 'b'.repeat(64),
      }],
    },
  };
}

function buildManagedCapsule() {
  const baseAuthorization = {
    capsule_id: 'capsule-1',
    subject_participant_id: 'participant-a',
    target_type: 'chat_room',
    target_id: 'room-1',
    capsule_content_hash: 'c'.repeat(64),
    policy_version: 'chat-context-v1',
    expires_at: '2099-01-01T00:00:00.000Z',
    revoked_at: null,
  };
  return {
    id: 'capsule-1',
    room_id: 'room-1',
    owner_participant_id: 'participant-a',
    source_channel_id: 'channel-private',
    lineage_id: 'lineage-1',
    version: 1,
    summary: '我願意分享的重點',
    source_refs: [
      { id: 'private-source-1', kind: 'chat_message', content_hash: 'd'.repeat(64) },
      { id: 'private-source-2', kind: 'chat_message', content_hash: 'e'.repeat(64) },
    ],
    content_hash: 'c'.repeat(64),
    policy_version: 'chat-context-v1',
    sensitivity_class: 'standard',
    status: 'approved',
    expires_at: '2099-01-01T00:00:00.000Z',
    revoked_at: null,
    authorizations: [
      {
        ...baseAuthorization,
        id: 'grant-shared',
        purpose: 'shared_mediation',
        audience: 'room_participants',
      },
      {
        ...baseAuthorization,
        id: 'grant-formal',
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
      },
    ],
  };
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
          channel_id: 'channel-shared',
          content: 'hello from A',
          message_type: 'user_text',
          visibility_scope: 'all',
          safety_flag: false,
          created_at: '2026-05-08T00:00:00.000Z',
          sender_participant: { participant_type: 'user', role_in_room: 'roleA' },
        },
      ],
      nextCursor: null,
    });
    mockListChannels.mockResolvedValue([
      {
        id: 'channel-private',
        room_id: 'room-1',
        kind: 'private',
        owner_participant_id: 'participant-a',
      },
      {
        id: 'channel-shared',
        room_id: 'room-1',
        kind: 'shared',
        owner_participant_id: null,
      },
    ]);
    mockGetJudgmentStatus.mockResolvedValue({ roomStatus: 'solo_active' });
    mockGetRoomSafetyStatus.mockResolvedValue({ status: 'open' });
    mockSendChannelMessage.mockResolvedValue({ id: 'm2', channel_id: 'channel-private' });
    mockGetPrivateContextPreference.mockResolvedValue({
      participant_id: 'participant-a',
      mode: 'private_only',
      mode_policy_version: '2026-07-13.adaptation-v1',
      mode_updated_at: '2026-07-13T19:00:00.000Z',
      adaptation_decision: 'declined',
      adaptation_policy_version: '2026-07-13.adaptation-v1',
      adaptation_decided_at: '2026-07-13T19:01:00.000Z',
      room_adaptation: {
        policy_version: '2026-07-13.adaptation-v1',
        enabled: false,
        active_participant_count: 1,
        accepted_participant_count: 0,
        owner_opt_in_count: 0,
      },
    });
    mockUpdatePrivateContextPreference.mockResolvedValue({
      participant_id: 'participant-a',
      mode: 'shared_process_controls',
      mode_policy_version: '2026-07-13.adaptation-v1',
      mode_updated_at: '2026-07-13T19:05:00.000Z',
      adaptation_decision: 'not_set',
      adaptation_policy_version: null,
      adaptation_decided_at: null,
      room_adaptation: {
        policy_version: '2026-07-13.adaptation-v1',
        enabled: false,
        active_participant_count: 1,
        accepted_participant_count: 0,
        owner_opt_in_count: 1,
      },
    });
    mockUpdateSharedAdaptationConsent.mockResolvedValue({
      participant_id: 'participant-a',
      mode: 'shared_process_controls',
      mode_policy_version: '2026-07-13.adaptation-v1',
      mode_updated_at: '2026-07-13T19:05:00.000Z',
      adaptation_decision: 'accepted',
      adaptation_policy_version: '2026-07-13.adaptation-v1',
      adaptation_decided_at: '2026-07-13T19:06:00.000Z',
      room_adaptation: {
        policy_version: '2026-07-13.adaptation-v1',
        enabled: false,
        active_participant_count: 1,
        accepted_participant_count: 1,
        owner_opt_in_count: 1,
      },
    });
    mockListContextCapsules.mockResolvedValue([]);
    mockListContextUsageReceipts.mockResolvedValue([]);
    mockCreateContextCapsule.mockResolvedValue({
      id: 'capsule-1',
      content_hash: 'c'.repeat(64),
      policy_version: 'chat-context-v1',
    });
    mockGrantContextAuthorization.mockResolvedValue({ id: 'grant-1' });
    mockReviseContextCapsule.mockResolvedValue({ id: 'capsule-2', status: 'draft' });
    mockDiscardContextCapsule.mockResolvedValue({ id: 'capsule-1', status: 'discarded' });
    mockListAnalysisRequests.mockResolvedValue([]);
    mockCreateAnalysisRequest.mockResolvedValue({
      id: 'analysis-1',
      room_id: 'room-1',
      status: 'pending_approval',
      selection_hash: 'a'.repeat(64),
      policy_version: 'chat-context-v1',
      required_participant_ids: ['participant-a', 'p-b'],
      selection_snapshot: {
        capsule_refs: [],
        message_refs: [{ id: 'm1', kind: 'chat_message', content_hash: 'b'.repeat(64) }],
      },
    });
    mockDecideAnalysisRequest.mockResolvedValue({ id: 'approval-a', decision: 'approved' });
    mockSubmitAnalysisRequest.mockResolvedValue({ id: 'analysis-1', status: 'submitted' });
    mockRevokeAnalysisApproval.mockResolvedValue({ id: 'approval-a', revoked_at: '2026-07-13T00:00:00.000Z' });
    mockRevokeContextAuthorization.mockResolvedValue({ id: 'grant-1', revoked_at: '2026-07-13T00:00:00.000Z' });
    mockCreateInvite.mockResolvedValue({ id: 'invite-1', invite_code: 'ABC123', status: 'pending' });
    mockAcceptInvite.mockResolvedValue({ id: 'room-2' });
    mockDeclineInvite.mockResolvedValue({ id: 'invite-1', status: 'revoked' });
    mockRequestJudgment.mockResolvedValue({ roomId: 'room-1', caseId: 'case-1', status: 'judgment_requested' });
    mockLeaveRoom.mockResolvedValue({ id: 'room-1', status: 'archived' });
    mockConnectChatAIStream.mockImplementation((scopeType, scopeId, callbacks) => {
      callbacks.onReady?.({ scopeType, scopeId, snapshots: [] });
      return new Promise(() => undefined);
    });
    mockConnectChatChannelStream.mockResolvedValue(undefined);
    mockConnectChatRoomStream.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
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

  it('renders room messages, sends through the shared channel, and creates an exact analysis request', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect((await screen.findAllByText('hello from A')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('對話狀態')).toBeTruthy();
    expect(screen.queryByText('房間代號')).toBeNull();
    expect(screen.queryByText(/房間/)).toBeNull();
    expect(screen.queryByText('room-1')).toBeNull();
    expect(screen.getByText(/訊息時間：/)).toBeTruthy();
    expect(screen.queryByText('2026-05-08T00:00:00.000Z')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText(/願意讓雙方一起看到/), 'new message');
    fireEvent.press(screen.getByText('送出訊息'));

    await waitFor(() => expect(mockSendChannelMessage).toHaveBeenCalledTimes(1));
    expect(mockSendChannelMessage).toHaveBeenCalledWith('channel-shared', {
      content: 'new message',
    });

    const reviewSelection = screen.getByTestId('chat.room.analysis.review-open');
    expect(reviewSelection.props.accessibilityState).toEqual(expect.objectContaining({
      disabled: true,
    }));
    fireEvent.press(screen.getByTestId('chat.room.analysis.message.m1'));
    expect(reviewSelection.props.accessibilityState).toEqual(expect.objectContaining({
      disabled: false,
    }));
    fireEvent.press(reviewSelection);

    expect(mockCreateAnalysisRequest).not.toHaveBeenCalled();
    expect(screen.getByText('批准前先核對精確內容')).toBeTruthy();
    expect(screen.getAllByText('hello from A')).toHaveLength(2);
    act(() => {
      screen.queryClient.setQueryData(chatQueryKeys.messages(0, 'room-1'), {
        messages: [
          {
            id: 'm1',
            channel_id: 'channel-shared',
            content: 'hello from A',
            message_type: 'user_text',
            visibility_scope: 'all',
            safety_flag: false,
            created_at: '2026-05-08T00:00:00.000Z',
            sender_participant: { participant_type: 'user', role_in_room: 'roleA' },
          },
          {
            id: 'm-later',
            channel_id: 'channel-shared',
            content: 'arrived after review opened',
            message_type: 'user_text',
            visibility_scope: 'all',
            safety_flag: false,
            created_at: '2026-05-08T00:00:01.000Z',
            sender_participant: { participant_type: 'user', role_in_room: 'roleA' },
          },
        ],
        nextCursor: null,
      });
    });
    fireEvent.press(screen.getByText('建立並批准以上精確內容'));

    await waitFor(() => expect(mockCreateAnalysisRequest).toHaveBeenCalledTimes(1));
    expect(mockCreateAnalysisRequest).toHaveBeenCalledWith('room-1', {
      selected_capsule_ids: [],
      selected_message_ids: ['m1'],
    });
    expect(mockDecideAnalysisRequest).toHaveBeenCalledWith('room-1', 'analysis-1', {
      decision: 'approved',
      policy_version: 'chat-context-v1',
      selection_hash: 'a'.repeat(64),
    });
    expect(mockRequestJudgment).not.toHaveBeenCalled();
  });

  it('submits only an exact request approved by all required participants', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockListAnalysisRequests.mockResolvedValue([buildAnalysisRequest()]);

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    const submit = await screen.findByText('提交並開始梳理');
    fireEvent.press(submit);

    await waitFor(() => expect(mockSubmitAnalysisRequest).toHaveBeenCalledWith('room-1', 'analysis-1'));
    expect(mockRequestJudgment).toHaveBeenCalledWith('room-1', {
      analysis_request_id: 'analysis-1',
    });
  });

  it('retries judgment handoff for a submitted request without submitting it again', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockListAnalysisRequests.mockResolvedValue([buildAnalysisRequest('submitted')]);

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByText('重試開始梳理'));

    await waitFor(() => expect(mockRequestJudgment).toHaveBeenCalledWith('room-1', {
      analysis_request_id: 'analysis-1',
    }));
    expect(mockSubmitAnalysisRequest).not.toHaveBeenCalled();
  });

  it('serializes revoke and judgment handoff actions for the same request in the same tick', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockListAnalysisRequests.mockResolvedValue([buildAnalysisRequest('submitted')]);
    let resolveRevoke;
    mockRevokeAnalysisApproval.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRevoke = resolve;
    }));

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));
    const revoke = await screen.findByTestId('chat.room.analysis.revoke-approval');
    const submit = screen.getByTestId('chat.room.analysis.submit');

    act(() => {
      fireEvent.press(revoke);
      fireEvent.press(submit);
    });

    await waitFor(() => expect(mockRevokeAnalysisApproval).toHaveBeenCalledTimes(1));
    expect(mockSubmitAnalysisRequest).not.toHaveBeenCalled();
    expect(mockRequestJudgment).not.toHaveBeenCalled();
    expect(submit.props.accessibilityState).toEqual(expect.objectContaining({
      disabled: true,
    }));

    await act(async () => {
      resolveRevoke({ id: 'approval-a', revoked_at: '2026-07-13T00:00:00.000Z' });
    });
  });

  it('lets either participant revoke their exact approval before processing starts', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockListAnalysisRequests.mockResolvedValue([buildAnalysisRequest('submitted')]);

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));
    fireEvent.press(await screen.findByTestId('chat.room.analysis.revoke-approval'));

    await waitFor(() => expect(mockRevokeAnalysisApproval).toHaveBeenCalledWith(
      'room-1',
      'analysis-1',
      {
        policy_version: 'chat-context-v1',
        selection_hash: 'a'.repeat(64),
      },
    ));
    expect(screen.getByText(/已開始處理或已顯示的結果不能倒帶/)).toBeTruthy();
  });

  it('shows a localized error when approval revocation fails', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockListAnalysisRequests.mockResolvedValue([buildAnalysisRequest('approved')]);
    mockRevokeAnalysisApproval.mockRejectedValueOnce(new Error('network'));

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));
    fireEvent.press(await screen.findByTestId('chat.room.analysis.revoke-approval'));

    expect(await screen.findByText('未能撤回你的批准')).toBeTruthy();
    expect(screen.getByText('你的批准暫時維持。請檢查連線後再試一次。')).toBeTruthy();
  });

  it('does not offer approval revocation once analysis is processing', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'judgment_requested',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockListAnalysisRequests.mockResolvedValue([buildAnalysisRequest('processing')]);

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('今次梳理已開始處理')).toBeTruthy();
    expect(screen.queryByTestId('chat.room.analysis.revoke-approval')).toBeNull();
  });

  it('keeps request creation and evidence selection roleA-only while roleB can review an active request', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetToken.mockResolvedValue('role-b-token');
    mockListChannels.mockResolvedValue([
      { id: 'channel-private-b', room_id: 'room-1', kind: 'private', owner_participant_id: 'p-b' },
      { id: 'channel-shared', room_id: 'room-1', kind: 'shared', owner_participant_id: null },
    ]);
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('等待 A 方建立梳理範圍')).toBeTruthy();
    expect(screen.queryByTestId('chat.room.analysis.review-open')).toBeNull();
    expect(screen.queryByTestId('chat.room.request-judgment')).toBeNull();

    const request = buildAnalysisRequest('pending_approval');
    request.participant_approvals = request.participant_approvals.filter(
      (approval) => approval.participant_id !== 'p-b',
    );
    mockListAnalysisRequests.mockResolvedValue([request]);
    await act(async () => {
      await screen.queryClient.invalidateQueries({
        queryKey: chatQueryKeys.analysisRequests(0, 'room-1'),
      });
    });

    expect(await screen.findByText('今次精確納入的內容')).toBeTruthy();
    expect(screen.getByTestId('chat.room.analysis.approve')).toBeTruthy();
    expect(screen.queryByTestId('chat.room.analysis.review-open')).toBeNull();
  });

  it('lets the capsule owner revoke each active purpose without erasing past use', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [{ id: 'participant-a', role_in_room: 'roleA', is_active: true }],
    });
    mockListContextCapsules.mockResolvedValue([buildManagedCapsule()]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByTestId('chat.room.lane.private'));
    expect(await screen.findByText('管理可分享版本')).toBeTruthy();
    expect(screen.getByText(/已開始處理或已向雙方顯示的內容不能倒帶收回/)).toBeTruthy();
    const formalRevoke = screen.getByTestId(
      'chat.room.capsule.revoke.formal_analysis_evidence.capsule-1',
    );
    expect(formalRevoke.props.accessibilityState).toEqual({
      busy: false,
      disabled: false,
      selected: false,
    });
    expect(formalRevoke.props.accessibilityHint).toMatch(/停止這個用途之後再使用/);
    const receiptCallsBeforeRevoke = mockListContextUsageReceipts.mock.calls.length;
    fireEvent.press(formalRevoke);

    await waitFor(() => expect(mockRevokeContextAuthorization).toHaveBeenCalledWith(
      'room-1',
      'grant-formal',
      { reason_code: 'user_revoked' },
    ));
    await waitFor(() => {
      expect(mockListContextUsageReceipts.mock.calls.length).toBeGreaterThan(
        receiptCallsBeforeRevoke,
      );
    });
  });

  it('keeps draft sharing and formal-analysis permissions as separate explicit actions', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [{ id: 'participant-a', role_in_room: 'roleA', is_active: true }],
    });
    const draft = buildManagedCapsule();
    draft.status = 'draft';
    draft.authorizations = [];
    mockListContextCapsules.mockResolvedValue([draft]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByTestId('chat.room.lane.private'));
    expect(await screen.findByText('尚未分享的草稿')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat.room.capsule.grant.shared_mediation.capsule-1'));

    await waitFor(() => expect(mockGrantContextAuthorization).toHaveBeenCalledWith(
      'room-1',
      'capsule-1',
      {
        audience: 'room_participants',
        capsule_content_hash: 'c'.repeat(64),
        policy_version: 'chat-context-v1',
        purpose: 'shared_mediation',
        target_id: 'room-1',
        target_type: 'chat_room',
      },
    ));

    fireEvent.press(screen.getByTestId(
      'chat.room.capsule.grant.formal_analysis_evidence.capsule-1',
    ));
    await waitFor(() => expect(mockGrantContextAuthorization).toHaveBeenLastCalledWith(
      'room-1',
      'capsule-1',
      expect.objectContaining({
        audience: 'analysis_participants',
        purpose: 'formal_analysis_evidence',
      }),
    ));
  });

  it('re-authorizes a missing purpose without recreating the capsule', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [{ id: 'participant-a', role_in_room: 'roleA', is_active: true }],
    });
    const capsule = buildManagedCapsule();
    capsule.authorizations[0].revoked_at = '2026-07-13T00:00:00.000Z';
    mockListContextCapsules.mockResolvedValue([capsule]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByTestId('chat.room.lane.private'));
    expect(await screen.findByText('重新批准共同對話用途')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat.room.capsule.grant.shared_mediation.capsule-1'));

    await waitFor(() => expect(mockGrantContextAuthorization).toHaveBeenCalledTimes(1));
    expect(mockCreateContextCapsule).not.toHaveBeenCalled();
  });

  it('revises only from the exact fixed sources and returns the new version to draft', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [{ id: 'participant-a', role_in_room: 'roleA', is_active: true }],
    });
    mockListContextCapsules.mockResolvedValue([buildManagedCapsule()]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByTestId('chat.room.lane.private'));
    fireEvent.press(await screen.findByTestId('chat.room.capsule.revise.capsule-1'));
    expect(screen.getByText(/不會自動加入新內容/)).toBeTruthy();
    fireEvent.changeText(
      screen.getByTestId('chat.room.capsule.revision-input.capsule-1'),
      '我願意分享的新版本',
    );
    fireEvent.press(screen.getByTestId('chat.room.capsule.revise-save.capsule-1'));

    await waitFor(() => expect(mockReviseContextCapsule).toHaveBeenCalledWith(
      'room-1',
      'capsule-1',
      {
        expires_at: '2099-01-01T00:00:00.000Z',
        source_channel_id: 'channel-private',
        source_message_ids: ['private-source-1', 'private-source-2'],
        summary: '我願意分享的新版本',
      },
    ));
    expect(mockGrantContextAuthorization).not.toHaveBeenCalled();
  });

  it('requires confirmation before discarding a current capsule', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [{ id: 'participant-a', role_in_room: 'roleA', is_active: true }],
    });
    mockListContextCapsules.mockResolvedValue([buildManagedCapsule()]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByTestId('chat.room.lane.private'));
    fireEvent.press(await screen.findByTestId('chat.room.capsule.discard.capsule-1'));
    expect(mockDiscardContextCapsule).not.toHaveBeenCalled();
    expect(screen.getByText('確定捨棄這個版本？')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat.room.capsule.discard-confirm.capsule-1'));

    await waitFor(() => expect(mockDiscardContextCapsule).toHaveBeenCalledWith(
      'room-1',
      'capsule-1',
    ));
  });

  it('offers no lifecycle actions for revoked, discarded, or expired capsules', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    const revoked = { ...buildManagedCapsule(), id: 'capsule-revoked', status: 'revoked', revoked_at: '2026-07-13T00:00:00.000Z' };
    const discarded = { ...buildManagedCapsule(), id: 'capsule-discarded', status: 'discarded' };
    const expired = { ...buildManagedCapsule(), id: 'capsule-expired', expires_at: '2020-01-01T00:00:00.000Z' };
    mockListContextCapsules.mockResolvedValue([revoked, discarded, expired]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByTestId('chat.room.lane.private'));
    await screen.findByText('這次使用了甚麼');
    expect(screen.queryByText('管理可分享版本')).toBeNull();
    expect(screen.queryByTestId('chat.room.capsule.discard.capsule-revoked')).toBeNull();
    expect(screen.queryByTestId('chat.room.capsule.discard.capsule-discarded')).toBeNull();
    expect(screen.queryByTestId('chat.room.capsule.discard.capsule-expired')).toBeNull();
  });

  it('renders identifier-free low-sensitivity context usage receipts', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockListContextUsageReceipts.mockResolvedValue([{
      scope: 'actor',
      category: 'shared_mediation_use',
      purpose: 'shared_mediation',
      decision: 'allowed',
      source_type_counts: {
        chat_message: 0,
        context_capsule: 2,
        personal_memory: 0,
        joint_memory: 0,
        formal_evidence: 0,
      },
      authorization_count: 1,
      policy_version: 'secret-policy-version',
      prompt_version: 'secret-prompt-version',
      created_at: '2026-07-13T12:30:00.000Z',
      id: 'secret-audit-id',
      reason_code: 'secret-trauma-reason',
      owner: 'secret-owner',
      topic: 'secret-topic',
    }]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByTestId('chat.room.lane.private'));
    expect(await screen.findByText('這次使用了甚麼')).toBeTruthy();
    expect(await screen.findByText('共同對話使用')).toBeTruthy();
    expect(screen.getByText('可分享版本 2；授權 1 項')).toBeTruthy();
    expect(screen.queryByText(/secret-audit-id/)).toBeNull();
    expect(screen.queryByText(/secret-trauma-reason/)).toBeNull();
    expect(screen.queryByText(/secret-owner/)).toBeNull();
    expect(screen.queryByText(/secret-topic/)).toBeNull();
    expect(screen.queryByText(/secret-policy-version/)).toBeNull();
    expect(screen.queryByText(/secret-prompt-version/)).toBeNull();
  });

  it('keeps a created request visible as approval-pending when requester self-approval fails', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockDecideAnalysisRequest.mockRejectedValueOnce(new Error('network'));
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByTestId('chat.room.analysis.message.m1'));
    fireEvent.press(screen.getByText('先核對今次精確內容'));
    fireEvent.press(screen.getByText('建立並批准以上精確內容'));

    expect(await screen.findByText('梳理範圍已建立，但你的批准尚未記錄')).toBeTruthy();
    expect(mockCreateAnalysisRequest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockListAnalysisRequests.mock.calls.length).toBeGreaterThan(1));
  });

  it('shows a localized error when saving the private-context preference fails', async () => {
    mockSearchParams = { roomId: 'room-private' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockListMessages.mockResolvedValue({ messages: [], nextCursor: null });
    mockUpdatePrivateContextPreference.mockRejectedValueOnce(new Error('network'));
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    fireEvent.press(await screen.findByTestId('chat.room.context-preference.process-controls'));

    expect(await screen.findByText('未能更新私人內容設定')).toBeTruthy();
    expect(screen.getByText('原有設定沒有改變。請檢查連線後再試一次。')).toBeTruthy();
  });

  it('requires a versioned trust choice before opening shared conversation', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockGetPrivateContextPreference.mockResolvedValue({
      participant_id: 'participant-a',
      mode: 'private_only',
      mode_policy_version: '2026-07-13.adaptation-v1',
      mode_updated_at: '2026-07-13T19:00:00.000Z',
      adaptation_decision: 'not_set',
      adaptation_policy_version: null,
      adaptation_decided_at: null,
      room_adaptation: {
        policy_version: '2026-07-13.adaptation-v1',
        enabled: false,
        active_participant_count: 2,
        accepted_participant_count: 0,
        owner_opt_in_count: 0,
      },
    });

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('進入共同對話前，先確認使用邊界')).toBeTruthy();
    expect(screen.getByTestId('chat.room.lane.shared').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('chat.room.trust.declined'));

    await waitFor(() => expect(mockUpdateSharedAdaptationConsent).toHaveBeenCalledWith(
      'room-1',
      {
        decision: 'declined',
        policy_version: '2026-07-13.adaptation-v1',
      },
    ));
  });

  it('fails closed when context governance cannot load while private support and retry remain available', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockGetPrivateContextPreference.mockRejectedValueOnce(new Error('network'));
    const draft = buildManagedCapsule();
    draft.status = 'draft';
    draft.authorizations = [];
    mockListContextCapsules.mockResolvedValue([draft]);

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('未能載入私人內容設定')).toBeTruthy();
    fireEvent.press(await screen.findByTestId('chat.room.analysis.message.m1'));
    expect(screen.getByTestId('chat.room.lane.shared').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('chat.room.analysis.review-open').props.accessibilityState.disabled).toBe(true);
    expect((await screen.findByTestId(
      'chat.room.capsule.grant.formal_analysis_evidence.capsule-1',
    )).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('chat.room.compose.input').props.editable).toBe(true);

    mockGetPrivateContextPreference.mockResolvedValueOnce({
      participant_id: 'participant-a',
      mode: 'private_only',
      mode_policy_version: '2026-07-13.adaptation-v1',
      mode_updated_at: '2026-07-13T19:00:00.000Z',
      adaptation_decision: 'declined',
      adaptation_policy_version: '2026-07-13.adaptation-v1',
      adaptation_decided_at: '2026-07-13T19:01:00.000Z',
      room_adaptation: {
        policy_version: '2026-07-13.adaptation-v1',
        enabled: false,
        active_participant_count: 2,
        accepted_participant_count: 0,
        owner_opt_in_count: 0,
      },
    });
    fireEvent.press(screen.getByTestId('chat.room.context-preference.retry'));

    await waitFor(() => {
      expect(screen.getByTestId('chat.room.lane.shared').props.accessibilityState.disabled).toBe(false);
    });
    expect(screen.getByTestId('chat.room.analysis.review-open').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('chat.room.lane.private'));
    expect(screen.getByTestId(
      'chat.room.capsule.grant.formal_analysis_evidence.capsule-1',
    ).props.accessibilityState.disabled).toBe(false);
  });

  it('keeps private support available while a sanitized safety pause blocks shared and formal actions', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockGetRoomSafetyStatus.mockResolvedValue({ status: 'paused' });
    const capsule = buildManagedCapsule();
    capsule.authorizations = capsule.authorizations.filter(
      (authorization) => authorization.purpose === 'shared_mediation',
    );
    mockListContextCapsules.mockResolvedValue([capsule]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    await waitFor(() => {
      expect(screen.getAllByText('共同空間暫時停用').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByTestId('chat.room.compose.input').props.editable).toBe(false);
    expect(screen.getByTestId('chat.room.compose.input').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('chat.room.send-message').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('chat.room.analysis.review-open').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('chat.room.lane.private'));
    expect(screen.getByTestId('chat.room.compose.input').props.editable).toBe(true);
    expect(screen.getByTestId('chat.room.compose.input').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByTestId(
      'chat.room.capsule.grant.formal_analysis_evidence.capsule-1',
    ).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('chat.room.compose.input'), '只留在我的私人空間');
    fireEvent.press(screen.getByTestId('chat.room.send-message'));

    await waitFor(() => expect(mockSendChannelMessage).toHaveBeenCalledWith(
      'channel-private',
      { content: '只留在我的私人空間' },
    ));
    expect(mockCreateAnalysisRequest).not.toHaveBeenCalled();
  });

  it('blocks formal handoff during a safety pause but preserves approval revocation', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockGetRoomSafetyStatus.mockResolvedValue({ status: 'paused' });
    mockListAnalysisRequests.mockResolvedValue([buildAnalysisRequest('approved')]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect((await screen.findByTestId('chat.room.analysis.submit')).props.accessibilityState.disabled)
      .toBe(true);
    expect(screen.getByTestId('chat.room.analysis.revoke-approval').props.accessibilityState.disabled)
      .toBe(false);
    fireEvent.press(screen.getByTestId('chat.room.analysis.revoke-approval'));

    await waitFor(() => expect(mockRevokeAnalysisApproval).toHaveBeenCalled());
    expect(mockSubmitAnalysisRequest).not.toHaveBeenCalled();
    expect(mockRequestJudgment).not.toHaveBeenCalled();
  });

  it('freezes capsule source ids and saves only a draft when the composer opens', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { gcTime: Infinity, retry: false },
        queries: { gcTime: Infinity, retry: false },
      },
    });
    queryClients.push(queryClient);
    const firstMessages = [
      { id: 'private-1', channel_id: 'channel-private', content: 'first', message_type: 'user_text', safety_flag: false },
      { id: 'private-2', channel_id: 'channel-private', content: 'second', message_type: 'ai_reflection', safety_flag: false },
    ];
    const laterMessages = [
      ...firstMessages,
      { id: 'private-3', channel_id: 'channel-private', content: 'third', message_type: 'user_text', safety_flag: false },
    ];
    const renderComposer = (messages) => React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(ChatContextCapsuleComposer, {
        messages,
        privateChannelId: 'channel-private',
        roomId: 'room-1',
      }),
    );
    const screen = render(renderComposer(firstMessages));

    fireEvent.press(screen.getByTestId('chat.room.capsule.open'));
    screen.rerender(renderComposer(laterMessages));
    fireEvent.press(screen.getByTestId('chat.room.capsule.save-draft'));

    await waitFor(() => expect(mockCreateContextCapsule).toHaveBeenCalledWith('room-1', {
      source_channel_id: 'channel-private',
      source_message_ids: ['private-1', 'private-2'],
      summary: 'second',
    }));
    expect(mockGrantContextAuthorization).not.toHaveBeenCalled();
  });

  it('sends private messages to the private channel and scopes private AI to chat_channel', async () => {
    mockSearchParams = { roomId: 'room-private' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockGetRoom.mockResolvedValue({
      id: 'room-private',
      status: 'solo_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [],
    });
    mockListMessages.mockResolvedValue({ messages: [], nextCursor: null });

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    await waitFor(() => expect(mockConnectChatAIStream).toHaveBeenCalledWith(
      'chat_channel',
      'channel-private',
      expect.objectContaining({
        onReady: expect.any(Function),
        onEvent: expect.any(Function),
      }),
      expect.objectContaining({ signal: expect.any(Object) }),
    ));
    expect(mockConnectChatChannelStream).toHaveBeenCalledWith(
      'channel-private',
      expect.objectContaining({ onEvent: expect.any(Function) }),
      expect.objectContaining({ signal: expect.any(Object) }),
    );

    fireEvent.changeText(screen.getByTestId('chat.room.compose.input'), '只留給我與 AI');
    fireEvent.press(screen.getByTestId('chat.room.send-message'));

    await waitFor(() => expect(mockSendChannelMessage).toHaveBeenCalledWith(
      'channel-private',
      { content: '只留給我與 AI' },
    ));

    fireEvent.press(screen.getByTestId('chat.room.context-preference.process-controls'));
    await waitFor(() => expect(mockUpdatePrivateContextPreference).toHaveBeenCalledWith(
      'room-private',
      {
        mode: 'shared_process_controls',
        policy_version: '2026-07-13.adaptation-v1',
      },
    ));
    expect(mockGetPrivateContextPreference).toHaveBeenCalledWith('room-private');
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
    expect(screen.getByText('Conversation space')).toBeTruthy();
    expect(screen.getAllByText('Shared conversation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('You, the other person, and AI can see this. Content may enter shared analysis only after each person confirms.').length).toBeGreaterThan(0);
    expect(screen.getByText('Message sync')).toBeTruthy();
    expect(screen.getByText('Mediator draft')).toBeTruthy();
    expect(screen.getByText(/Message time:/)).toBeTruthy();
    expect(screen.getByText('Side A')).toBeTruthy();
    expect(screen.getByText('Can be included in analysis')).toBeTruthy();
    expect(screen.getByPlaceholderText('Write something you are ready for both people to see…')).toBeTruthy();
    expect(screen.getByText('Send message')).toBeTruthy();
    expect(screen.getByText('Generate invite code')).toBeTruthy();
    expect(screen.getByText('Move to analysis')).toBeTruthy();
    expect(screen.getByText('Waiting for side A to create the Analysis scope')).toBeTruthy();
    expect(screen.getByText('Leave chat')).toBeTruthy();
    expect(screen.queryByText('對話狀態')).toBeNull();
    expect(screen.queryByText('建立今次梳理範圍')).toBeNull();
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

  it('refreshes adaptation consent after room membership events', async () => {
    let roomStreamCallbacks;
    let resolveContextPreference;
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockListMessages.mockResolvedValue({ messages: [], nextCursor: null });
    mockConnectChatRoomStream.mockImplementation((_roomId, callbacks) => {
      roomStreamCallbacks = callbacks;
      return new Promise(() => undefined);
    });
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    await waitFor(() => {
      expect(mockGetPrivateContextPreference).toHaveBeenCalledTimes(1);
      expect(mockListContextUsageReceipts).toHaveBeenCalledTimes(1);
      expect(mockGetRoomSafetyStatus).toHaveBeenCalledTimes(1);
      expect(roomStreamCallbacks).toBeTruthy();
    });
    const refreshedContextPreference = {
      participant_id: 'participant-a',
      mode: 'private_only',
      mode_policy_version: '2026-07-13.adaptation-v1',
      mode_updated_at: '2026-07-13T19:00:00.000Z',
      adaptation_decision: 'not_set',
      adaptation_policy_version: null,
      adaptation_decided_at: null,
      room_adaptation: {
        policy_version: '2026-07-13.adaptation-v1',
        enabled: false,
        active_participant_count: 2,
        accepted_participant_count: 0,
        owner_opt_in_count: 0,
      },
    };
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockGetPrivateContextPreference.mockImplementationOnce(() => new Promise((resolve) => {
      resolveContextPreference = resolve;
    }));
    mockGetRoomSafetyStatus.mockResolvedValue({ status: 'paused' });

    act(() => {
      roomStreamCallbacks.onEvent({ type: 'participant_joined' });
    });

    await waitFor(() => expect(mockGetPrivateContextPreference).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockListContextUsageReceipts).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockGetRoomSafetyStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByTestId('chat.room.lane.shared').props.accessibilityState.disabled).toBe(true);
    });
    await act(async () => resolveContextPreference(refreshedContextPreference));
    expect(await screen.findByText('進入共同對話前，先確認使用邊界')).toBeTruthy();
    expect(await screen.findByText('共同空間暫時停用')).toBeTruthy();
  });

  it('shows chat AI stream draft and refreshes room data when persisted', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetSessionId.mockResolvedValue('guest-existing');
    mockConnectChatAIStream.mockImplementation((scopeType, scopeId, callbacks, options) => {
      if (scopeType !== 'chat_room') return new Promise(() => undefined);
      expect(scopeId).toBe('room-1');
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
      'chat_room',
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
    mockConnectChatAIStream.mockImplementationOnce((scopeType, scopeId, callbacks) => {
      expect(scopeType).toBe('chat_channel');
      expect(scopeId).toBe('channel-private');
      callbacks.onEvent?.({
        eventType: 'stream.failed',
        streamId: 'stream-error',
        requestId: 'req-error',
        scopeType: 'chat_channel',
        scopeId: 'channel-private',
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
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockListMessages.mockResolvedValue({ messages: [], nextCursor: null });
    mockConnectChatAIStream.mockImplementation((scopeType, scopeId, callbacks, options) => {
      connections.push({ scopeType, scopeId, callbacks, options });
      return new Promise(() => undefined);
    });

    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    await waitFor(() => expect(mockConnectChatAIStream).toHaveBeenCalledTimes(1));
    expect(connections[0]).toMatchObject({
      scopeType: 'chat_channel',
      scopeId: 'channel-private',
    });
    fireEvent.press(screen.getByTestId('chat.room.lane.shared'));
    await waitFor(() => expect(mockConnectChatAIStream).toHaveBeenCalledTimes(2));
    expect(connections[1]).toMatchObject({
      scopeType: 'chat_room',
      scopeId: 'room-recover',
    });
    expect(connections[1].options.afterSeq).toBeUndefined();

    act(() => {
      connections[1].callbacks.onReady({
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

    await waitFor(() => expect(connections[1].options.signal.aborted).toBe(true));
    expect(await screen.findByText(/正在恢復協調草稿，會從最近收到的內容繼續。 \/ App 在背景/)).toBeTruthy();
    expect(screen.queryByText(/第 2 段/)).toBeNull();

    act(() => {
      mockLifecycleStatus = 'active';
      mockLifecycleListener('active');
    });

    await waitFor(() => expect(mockConnectChatAIStream).toHaveBeenCalledTimes(3));
    expect(connections[2]).toMatchObject({
      scopeType: 'chat_room',
      scopeId: 'room-recover',
    });
    expect(connections[2].options.afterSeq).toBe(2);

    act(() => {
      connections[2].callbacks.onEvent({
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

  it('removes private room, capsule, and analysis content before the same room can render after logout', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetToken.mockResolvedValue('account-a-token');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'participant-a', role_in_room: 'roleA', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', is_active: true },
      ],
    });
    mockListMessages.mockResolvedValue({
      messages: [{
        id: 'private-a',
        channel_id: 'channel-private',
        content: 'account-a-private-message',
        message_type: 'user_text',
        visibility_scope: 'owner_only',
        safety_flag: false,
        created_at: '2026-07-13T00:00:00.000Z',
        sender_participant: { participant_type: 'user', role_in_room: 'roleA' },
      }],
      nextCursor: null,
    });
    const accountACapsule = buildManagedCapsule();
    accountACapsule.summary = 'account-a-private-capsule';
    mockListContextCapsules.mockResolvedValue([accountACapsule]);
    const accountARequest = buildAnalysisRequest('approved');
    accountARequest.source_previews.messages[0].content = 'account-a-private-analysis';
    mockListAnalysisRequests.mockResolvedValue([accountARequest]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    expect(await screen.findByText('account-a-private-message')).toBeTruthy();
    expect(await screen.findByText('account-a-private-capsule')).toBeTruthy();
    expect(await screen.findByText('account-a-private-analysis')).toBeTruthy();

    mockGetToken.mockResolvedValue(null);
    await act(async () => {
      const epoch = await beginIdentityQueryTransition(screen.queryClient);
      completeIdentityQueryTransition(screen.queryClient, epoch, {
        privateDataEnabled: true,
      });
    });

    expect(await screen.findByTestId('chat.room.auth-gate.screen')).toBeTruthy();
    expect(screen.queryByText('account-a-private-message')).toBeNull();
    expect(screen.queryByText('account-a-private-capsule')).toBeNull();
    expect(screen.queryByText('account-a-private-analysis')).toBeNull();
    expect(JSON.stringify(screen.queryClient.getQueryCache().getAll().map((query) => query.state.data)))
      .not.toContain('account-a-private');
  });

  it('ignores in-flight A private responses after the identity epoch changes to B', async () => {
    mockSearchParams = { roomId: 'room-1' };
    mockGetToken.mockResolvedValue('account-a-token');
    mockGetRoom.mockResolvedValue({
      id: 'room-1',
      status: 'solo_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [{ id: 'participant-a', role_in_room: 'roleA', is_active: true }],
    });
    let resolveAccountAMessages;
    let resolveAccountACapsules;
    let resolveAccountARequests;
    mockListMessages
      .mockImplementationOnce(() => new Promise((resolve) => { resolveAccountAMessages = resolve; }))
      .mockResolvedValue({
        messages: [{
          id: 'private-b',
          channel_id: 'channel-private',
          content: 'account-b-private-message',
          message_type: 'user_text',
          visibility_scope: 'owner_only',
          safety_flag: false,
          created_at: '2026-07-13T00:00:01.000Z',
          sender_participant: { participant_type: 'user', role_in_room: 'roleA' },
        }],
        nextCursor: null,
      });
    mockListContextCapsules
      .mockImplementationOnce(() => new Promise((resolve) => { resolveAccountACapsules = resolve; }))
      .mockResolvedValue([]);
    mockListAnalysisRequests
      .mockImplementationOnce(() => new Promise((resolve) => { resolveAccountARequests = resolve; }))
      .mockResolvedValue([]);
    const screen = renderWithQuery(React.createElement(ChatRoomScreen));

    await waitFor(() => {
      expect(mockListMessages).toHaveBeenCalledTimes(1);
      expect(mockListContextCapsules).toHaveBeenCalledTimes(1);
      expect(mockListAnalysisRequests).toHaveBeenCalledTimes(1);
    });

    mockGetToken.mockResolvedValue('account-b-token');
    await act(async () => {
      const epoch = await beginIdentityQueryTransition(screen.queryClient);
      completeIdentityQueryTransition(screen.queryClient, epoch, {
        privateDataEnabled: true,
      });
    });
    expect(await screen.findByText('account-b-private-message')).toBeTruthy();

    const accountACapsule = buildManagedCapsule();
    accountACapsule.summary = 'late-account-a-private-capsule';
    const accountARequest = buildAnalysisRequest('approved');
    accountARequest.source_previews.messages[0].content = 'late-account-a-private-analysis';
    await act(async () => {
      resolveAccountAMessages({
        messages: [{
          id: 'private-a-late',
          channel_id: 'channel-private',
          content: 'late-account-a-private-message',
          message_type: 'user_text',
          visibility_scope: 'owner_only',
          safety_flag: false,
          created_at: '2026-07-13T00:00:00.000Z',
          sender_participant: { participant_type: 'user', role_in_room: 'roleA' },
        }],
        nextCursor: null,
      });
      resolveAccountACapsules([accountACapsule]);
      resolveAccountARequests([accountARequest]);
      await Promise.resolve();
    });

    expect(screen.queryByText('late-account-a-private-message')).toBeNull();
    expect(screen.queryByText('late-account-a-private-capsule')).toBeNull();
    expect(screen.queryByText('late-account-a-private-analysis')).toBeNull();
    expect(JSON.stringify(screen.queryClient.getQueryCache().getAll().map((query) => query.state.data)))
      .not.toContain('late-account-a-private');
  });
});
