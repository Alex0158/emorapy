const prismaMock = {
  chatMessage: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const actorAccessMock = {
  ensureActor: jest.fn(),
  getAccessibleRoom: jest.fn(),
  getCurrentParticipant: jest.fn(),
  resolveActiveHumanParticipant: jest.fn(),
  lockActiveParticipant: jest.fn(),
  lockActiveHumanParticipants: jest.fn(),
  lockActiveRoleB: jest.fn(),
};
const channelServiceMock = {
  resolveChannelForWrite: jest.fn(),
  getOrCreateWriteChannelForParticipant: jest.fn(),
};
const privateAnalystMock = { onUserMessage: jest.fn() };
const sharedOrchestratorMock = { onUserMessage: jest.fn() };
const safetyRouterMock = {
  activateForRouteWithClient: jest.fn(),
  assertSharedMessagingAllowed: jest.fn(),
};
const metricsMock = {
  recordMessage: jest.fn(),
  recordRateLimit: jest.fn(),
};
const eventsMock = { publish: jest.fn() };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/services/chat-actor-access.service', () => ({
  chatActorAccessService: actorAccessMock,
}));
jest.mock('../../../src/services/chat-channel.service', () => ({
  chatChannelService: channelServiceMock,
}));
jest.mock('../../../src/services/private-analyst-orchestrator.service', () => ({
  privateAnalystOrchestrator: privateAnalystMock,
}));
jest.mock('../../../src/services/chat-ai-orchestrator.service', () => ({
  chatAIOrchestrator: sharedOrchestratorMock,
}));
jest.mock('../../../src/services/chat-safety-router.service', () => ({
  chatSafetyRouterService: safetyRouterMock,
}));
jest.mock('../../../src/services/chat-metrics.service', () => ({
  chatMetricsService: metricsMock,
}));
jest.mock('../../../src/services/chat-events.service', () => ({
  chatEventsService: eventsMock,
}));

import { ChatMessageService } from '../../../src/services/chat-message.service';

describe('ChatMessageService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    actorAccessMock.ensureActor.mockImplementation(async actor => actor);
    actorAccessMock.lockActiveParticipant.mockResolvedValue(undefined);
    actorAccessMock.lockActiveHumanParticipants.mockResolvedValue(undefined);
    actorAccessMock.lockActiveRoleB.mockResolvedValue(undefined);
    safetyRouterMock.activateForRouteWithClient.mockResolvedValue({
      changed: false,
      sharedStatusChanged: false,
    });
    safetyRouterMock.assertSharedMessagingAllowed.mockResolvedValue(undefined);
    metricsMock.recordMessage.mockResolvedValue(undefined);
    metricsMock.recordRateLimit.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async callback => callback(prismaMock));
  });

  it('directly fails closed for legacy summary_only before opening a transaction', async () => {
    const service = new ChatMessageService();

    await expect(service.sendMessage('room-1', { userId: 'user-a' }, {
      content: 'private raw text',
      visibilityScope: 'summary_only' as never,
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: {
        reason_code: 'CHAT_SUMMARY_ONLY_UNAVAILABLE',
        safe_visibility_scope: 'owner_only',
      },
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
  });

  it('directly keeps private persistence and AI dispatch in the owner lane', async () => {
    const participant = {
      id: 'participant-a',
      room_id: 'room-private',
      role_in_room: 'roleA',
      participant_type: 'user',
      user_id: 'user-a',
      is_active: true,
      left_at: null,
    };
    const aiParticipant = {
      id: 'participant-ai',
      room_id: 'room-private',
      role_in_room: 'aiMediator',
      participant_type: 'ai',
      is_active: true,
      left_at: null,
    };
    const room = {
      id: 'room-private',
      status: 'solo_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [participant, aiParticipant],
    };
    const channel = {
      id: 'channel-private-a',
      room_id: room.id,
      kind: 'private',
      owner_participant_id: participant.id,
    };
    actorAccessMock.resolveActiveHumanParticipant.mockResolvedValue({
      actor: { userId: 'user-a' },
      room,
      participant,
    });
    channelServiceMock.getOrCreateWriteChannelForParticipant.mockResolvedValue(channel);
    prismaMock.chatMessage.create.mockResolvedValue({
      id: 'message-private',
      content: 'only me and AI',
      visibility_scope: 'owner_only',
      sender_participant: participant,
      channel,
    });

    await new ChatMessageService().sendMessage(room.id, { userId: 'user-a' }, {
      content: 'only me and AI',
      visibilityScope: 'owner_only' as never,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'ReadCommitted' },
    );
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        channel_id: channel.id,
        visibility_scope: 'owner_only',
        ai_context_eligible: true,
      }),
    }));
    expect(safetyRouterMock.activateForRouteWithClient).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: room.id,
        ownerParticipantId: participant.id,
        route: 'standard',
      }),
      prismaMock,
    );
    expect(privateAnalystMock.onUserMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        privateChannelId: channel.id,
        ownerParticipantId: participant.id,
      }),
      { id: 'message-private', content: 'only me and AI' },
    );
    expect(sharedOrchestratorMock.onUserMessage).not.toHaveBeenCalled();
    expect(eventsMock.publish).not.toHaveBeenCalled();
  });

  it('publishes only a sanitized room refresh when a private signal changes shared safety', async () => {
    const participant = {
      id: 'participant-a',
      room_id: 'room-private',
      role_in_room: 'roleA',
      participant_type: 'user',
      user_id: 'user-a',
      is_active: true,
      left_at: null,
    };
    const room = {
      id: 'room-private',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [participant],
    };
    const channel = {
      id: 'channel-private-a',
      room_id: room.id,
      kind: 'private',
      owner_participant_id: participant.id,
    };
    actorAccessMock.resolveActiveHumanParticipant.mockResolvedValue({
      actor: { userId: 'user-a' },
      room,
      participant,
    });
    channelServiceMock.getOrCreateWriteChannelForParticipant.mockResolvedValue(channel);
    safetyRouterMock.activateForRouteWithClient.mockResolvedValueOnce({
      changed: true,
      sharedStatusChanged: true,
    });
    prismaMock.chatMessage.create.mockResolvedValue({
      id: 'message-private',
      content: 'private safety signal',
      visibility_scope: 'owner_only',
      sender_participant: participant,
      channel,
    });

    await new ChatMessageService().sendMessage(room.id, { userId: 'user-a' }, {
      content: 'private safety signal',
      visibilityScope: 'owner_only' as never,
    });

    expect(eventsMock.publish).toHaveBeenCalledWith({
      type: 'room_status',
      roomId: room.id,
      payload: { safetyStatusChanged: true },
      at: expect.any(String),
    });
    const payload = eventsMock.publish.mock.calls[0]?.[0]?.payload;
    expect(payload).not.toHaveProperty('ownerParticipantId');
    expect(payload).not.toHaveProperty('action');
    expect(payload).not.toHaveProperty('reason');
    expect(payload).not.toHaveProperty('source');
  });

  it('persists no private message when its action-only safety state cannot be linearized', async () => {
    const participant = {
      id: 'participant-a',
      room_id: 'room-private',
      role_in_room: 'roleA',
      participant_type: 'user',
      user_id: 'user-a',
      is_active: true,
      left_at: null,
    };
    const room = {
      id: 'room-private',
      status: 'solo_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [participant],
    };
    const channel = {
      id: 'channel-private-a',
      room_id: room.id,
      kind: 'private',
      owner_participant_id: participant.id,
    };
    actorAccessMock.resolveActiveHumanParticipant.mockResolvedValue({
      actor: { userId: 'user-a' },
      room,
      participant,
    });
    channelServiceMock.getOrCreateWriteChannelForParticipant.mockResolvedValue(channel);
    safetyRouterMock.activateForRouteWithClient.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(new ChatMessageService().sendMessage(room.id, { userId: 'user-a' }, {
      content: '我現在不安全',
      visibilityScope: 'owner_only' as never,
    })).rejects.toThrow('db unavailable');

    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
    expect(privateAnalystMock.onUserMessage).not.toHaveBeenCalled();
  });

  it('checks the durable safety state in the shared write transaction before persistence', async () => {
    const participant = {
      id: 'participant-a',
      room_id: 'room-shared',
      role_in_room: 'roleB',
      participant_type: 'user',
      user_id: 'user-a',
      is_active: true,
      left_at: null,
    };
    const room = {
      id: 'room-shared',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [participant],
    };
    const channel = {
      id: 'channel-shared',
      room_id: room.id,
      kind: 'shared',
      owner_participant_id: null,
    };
    actorAccessMock.resolveActiveHumanParticipant.mockResolvedValue({
      actor: { userId: 'user-a' },
      room,
      participant,
    });
    channelServiceMock.getOrCreateWriteChannelForParticipant.mockResolvedValue(channel);
    safetyRouterMock.assertSharedMessagingAllowed.mockRejectedValueOnce(
      Object.assign(new Error('共同對話目前暫停'), { code: 'CASE_NOT_EDITABLE' }),
    );

    await expect(new ChatMessageService().sendMessage(room.id, { userId: 'user-a' }, {
      content: 'must not persist',
      visibilityScope: 'all' as never,
    })).rejects.toMatchObject({ code: 'CASE_NOT_EDITABLE' });

    expect(safetyRouterMock.assertSharedMessagingAllowed).toHaveBeenCalledWith(
      room.id,
      prismaMock,
    );
    expect(actorAccessMock.lockActiveHumanParticipants).toHaveBeenCalledWith(
      prismaMock,
      room.id,
    );
    expect(actorAccessMock.lockActiveHumanParticipants.mock.invocationCallOrder[0]).toBeLessThan(
      safetyRouterMock.assertSharedMessagingAllowed.mock.invocationCallOrder[0],
    );
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
    expect(sharedOrchestratorMock.onUserMessage).not.toHaveBeenCalled();
  });
});
