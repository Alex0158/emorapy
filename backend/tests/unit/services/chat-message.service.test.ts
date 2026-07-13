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
  lockActiveRoleB: jest.fn(),
};
const channelServiceMock = {
  resolveChannelForWrite: jest.fn(),
  getOrCreateWriteChannelForParticipant: jest.fn(),
};
const privateAnalystMock = { onUserMessage: jest.fn() };
const sharedOrchestratorMock = { onUserMessage: jest.fn() };
const metricsMock = {
  recordMessage: jest.fn(),
  recordRateLimit: jest.fn(),
};

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
jest.mock('../../../src/services/chat-metrics.service', () => ({
  chatMetricsService: metricsMock,
}));

import { ChatMessageService } from '../../../src/services/chat-message.service';

describe('ChatMessageService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    actorAccessMock.ensureActor.mockImplementation(async actor => actor);
    actorAccessMock.lockActiveParticipant.mockResolvedValue(undefined);
    actorAccessMock.lockActiveRoleB.mockResolvedValue(undefined);
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
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        channel_id: channel.id,
        visibility_scope: 'owner_only',
        ai_context_eligible: true,
      }),
    }));
    expect(privateAnalystMock.onUserMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        privateChannelId: channel.id,
        ownerParticipantId: participant.id,
      }),
      { id: 'message-private', content: 'only me and AI' },
    );
    expect(sharedOrchestratorMock.onUserMessage).not.toHaveBeenCalled();
  });
});
