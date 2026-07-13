/**
 * ChatService 單元測試（權限、可見性、安全分流）
 */

function humanParticipant<T extends Record<string, unknown>>(fixture: T) {
  return {
    participant_type: 'user',
    left_at: null,
    ...fixture,
  };
}

function aiParticipant<T extends Record<string, unknown>>(fixture: T) {
  return {
    participant_type: 'ai',
    left_at: null,
    ...fixture,
  };
}

const ANALYSIS_REQUEST_ID = '550e8400-e29b-41d4-a716-446655440020';
const SHARED_ADAPTATION_RESET = {
  shared_adaptation_consent: 'not_set',
  shared_adaptation_policy_version: null,
  shared_adaptation_decided_at: null,
};

function submittedAnalysisEvidence(overrides: Record<string, unknown> = {}) {
  return {
    requestId: ANALYSIS_REQUEST_ID,
    selectionHash: 'selection-hash-v1',
    policyVersion: 'chat-analysis-policy@v1',
    requiredParticipantIds: ['p-a'],
    approvalIds: ['approval-a'],
    messages: [],
    capsules: [],
    ...overrides,
  };
}

const prismaMock: any = {
  chatRoom: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  chatMessage: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  chatToCaseLink: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  chatInvite: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  chatParticipant: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  chatChannel: {
    createMany: jest.fn(),
  },
  chatSafetyRouterState: {
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  case: {
    create: jest.fn(),
    update: jest.fn(),
  },
  pairing: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
};

const sessionServiceMock = {
  getSession: jest.fn(),
};

const pairingServiceMock = {
  getPairingBySessionId: jest.fn(),
  createTempPairing: jest.fn(),
};

const aiServiceMock = {
  detectCaseType: jest.fn(),
};

const judgmentServiceMock = {
  generateJudgment: jest.fn(),
};

const chatAIOrchestratorMock = {
  onUserMessage: jest.fn(),
};

const privateAnalystOrchestratorMock = {
  onUserMessage: jest.fn(),
};

const chatMetricsServiceMock = {
  recordMessage: jest.fn().mockResolvedValue(undefined),
  recordRateLimit: jest.fn().mockResolvedValue(undefined),
  recordJudgmentSuccess: jest.fn().mockResolvedValue(undefined),
  recordJudgmentFailed: jest.fn().mockResolvedValue(undefined),
};

const chatChannelServiceMock = {
  getSharedChannel: jest.fn(),
  getOrCreateWriteChannelForParticipant: jest.fn(),
  resolveChannelForWrite: jest.fn(),
};

const chatAnalysisEvidenceServiceMock = {
  resolveSubmitted: jest.fn(),
  claimSubmittedForProcessing: jest.fn(),
  claimSubmittedForProcessingInTransaction: jest.fn(),
  claimCaseGeneration: jest.fn(),
  claimCaseGenerationInTransaction: jest.fn(),
  markCompleted: jest.fn(),
};

const chatAnalysisRequestServiceMock = {
  cancelActiveForParticipantDeparture: jest.fn(),
};

const chatStreamEntitlementServiceMock = {
  activateParticipant: jest.fn(),
  revokeParticipant: jest.fn(),
};

const lockServiceMock = {
  withLock: jest.fn(async (_key: string, fn: any) => fn()),
};

const safetyRoutingServiceMock = {
  decideRoute: jest.fn(),
};

const safetyAssessmentServiceMock = {
  recordRouteAssessment: jest.fn(),
  getActiveRiskState: jest.fn(),
};

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../src/services/session.service', () => ({
  __esModule: true,
  sessionService: sessionServiceMock,
}));

jest.mock('../../../src/services/pairing.service', () => ({
  __esModule: true,
  pairingService: pairingServiceMock,
}));

jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: aiServiceMock,
}));

jest.mock('../../../src/services/judgment.service', () => ({
  __esModule: true,
  judgmentService: judgmentServiceMock,
}));

jest.mock('../../../src/services/chat-ai-orchestrator.service', () => ({
  __esModule: true,
  chatAIOrchestrator: chatAIOrchestratorMock,
}));

jest.mock('../../../src/services/private-analyst-orchestrator.service', () => ({
  __esModule: true,
  privateAnalystOrchestrator: privateAnalystOrchestratorMock,
}));

jest.mock('../../../src/services/chat-metrics.service', () => ({
  __esModule: true,
  chatMetricsService: chatMetricsServiceMock,
}));

jest.mock('../../../src/services/chat-channel.service', () => ({
  __esModule: true,
  chatChannelService: chatChannelServiceMock,
}));

jest.mock('../../../src/services/chat-analysis-evidence.service', () => ({
  __esModule: true,
  chatAnalysisEvidenceService: chatAnalysisEvidenceServiceMock,
}));

jest.mock('../../../src/services/chat-analysis-request.service', () => ({
  __esModule: true,
  chatAnalysisRequestService: chatAnalysisRequestServiceMock,
}));

jest.mock('../../../src/services/chat-stream-entitlement.service', () => ({
  __esModule: true,
  chatStreamEntitlementService: chatStreamEntitlementServiceMock,
}));

jest.mock('../../../src/utils/lock', () => ({
  __esModule: true,
  lockService: lockServiceMock,
}));

jest.mock('../../../src/services/safety-routing.service', () => ({
  __esModule: true,
  safetyRoutingService: safetyRoutingServiceMock,
}));

jest.mock('../../../src/services/safety-assessment.service', () => ({
  __esModule: true,
  safetyAssessmentService: safetyAssessmentServiceMock,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: loggerMock,
}));

import { ChatService } from '../../../src/services/chat.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ChatService();
    // Most cases model no membership change between the initial access check
    // and the transaction-scoped revalidation. Reuse the latest same-room
    // fixture for that second read; drift tests queue an explicit snapshot.
    prismaMock.chatRoom.findFirst.mockImplementation(async (args: any) => {
      const priorResults = prismaMock.chatRoom.findFirst.mock.results.slice(0, -1).reverse();
      for (const result of priorResults) {
        if (result.type !== 'return') continue;
        const priorRoom = await result.value;
        if (priorRoom?.id === args?.where?.id) return priorRoom;
      }
      return null;
    });
    lockServiceMock.withLock.mockImplementation(async (_key: string, fn: any) => fn());
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'locked-participant' }]);
    chatMetricsServiceMock.recordMessage.mockResolvedValue(undefined);
    chatMetricsServiceMock.recordRateLimit.mockResolvedValue(undefined);
    chatMetricsServiceMock.recordJudgmentSuccess.mockResolvedValue(undefined);
    chatMetricsServiceMock.recordJudgmentFailed.mockResolvedValue(undefined);
    prismaMock.chatMessage.count.mockResolvedValue(0);
    prismaMock.chatSafetyRouterState.findMany.mockResolvedValue([]);
    prismaMock.pairing.create.mockResolvedValue({ id: 'pair-default' });
    prismaMock.chatInvite.findFirst.mockResolvedValue(null);
    prismaMock.chatRoom.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.chatChannel.createMany.mockResolvedValue({ count: 2 });
    chatChannelServiceMock.getSharedChannel.mockResolvedValue({
      id: 'channel-shared',
      kind: 'shared',
      owner_participant_id: null,
    });
    chatChannelServiceMock.getOrCreateWriteChannelForParticipant.mockResolvedValue({
      id: 'channel-shared',
      kind: 'shared',
      owner_participant_id: null,
    });
    chatChannelServiceMock.resolveChannelForWrite.mockResolvedValue({
      room: { id: 'room-default' },
      participant: humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      channel: { id: 'channel-shared', kind: 'shared', owner_participant_id: null },
      visibilityScope: 'all',
    });
    chatAnalysisEvidenceServiceMock.claimSubmittedForProcessing.mockImplementation(
      async (_roomId: string, _requestId: string, _actor: unknown, _hash: string) => (
        chatAnalysisEvidenceServiceMock.resolveSubmitted.mock.results.at(-1)?.value
        ?? submittedAnalysisEvidence()
      ),
    );
    chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction.mockImplementation(
      async () => (
        chatAnalysisEvidenceServiceMock.resolveSubmitted.mock.results.at(-1)?.value
        ?? submittedAnalysisEvidence()
      ),
    );
    chatAnalysisEvidenceServiceMock.claimCaseGeneration.mockResolvedValue(null);
    chatAnalysisEvidenceServiceMock.claimCaseGenerationInTransaction.mockResolvedValue(null);
    chatAnalysisEvidenceServiceMock.markCompleted.mockResolvedValue(undefined);
    chatAnalysisRequestServiceMock.cancelActiveForParticipantDeparture.mockResolvedValue(0);
    prismaMock.chatParticipant.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.chatParticipant.findFirst.mockResolvedValue(null);
    prismaMock.chatParticipant.create.mockResolvedValue(humanParticipant({
      id: 'p-b-created',
      role_in_room: 'roleB',
      user_id: 'u2',
      is_active: true,
    }));
    prismaMock.chatParticipant.update.mockImplementation(async (args: any) => humanParticipant({
      id: args.where.id,
      role_in_room: 'roleB',
      user_id: args.data.user_id,
      is_active: args.data.is_active,
    }));
    safetyAssessmentServiceMock.recordRouteAssessment.mockResolvedValue({ id: 'assessment-1' });
    prismaMock.chatParticipant.findUnique.mockResolvedValue(humanParticipant({
      id: 'p-a',
      role_in_room: 'roleA',
      is_active: true,
    }));
    prismaMock.chatParticipant.findMany.mockImplementation(async (args: any) => ([
      humanParticipant({
        id: 'p-a',
        room_id: args?.where?.room_id ?? 'room-default',
        role_in_room: 'roleA',
        is_active: true,
        user_id: 'u1',
      }),
    ]));
    prismaMock.chatRoom.findUnique.mockResolvedValue({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    safetyAssessmentServiceMock.getActiveRiskState.mockResolvedValue(null);
  });

  it('listMessages 無訊息時應返回 messages 空陣列與 nextCursor null（F07 邊界）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([]);

    const result = await service.listMessages('room-1', { userId: 'u1' }, { limit: 20 });

    expect(result.messages).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('getJudgmentStatus 應套用 case active safety state 隱藏責任比例', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      owner_user_id: 'u1',
      participants: [humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true })],
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-1',
      case: {
        id: 'case-1',
        status: 'completed',
        mode: 'remote',
        submitted_at: null,
        completed_at: null,
      },
      judgment: {
        id: 'j1',
        created_at: new Date('2026-05-03T00:00:00.000Z'),
        plaintiff_ratio: 60,
        defendant_ratio: 40,
      },
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({ status: 'judgment_completed' });
    safetyAssessmentServiceMock.getActiveRiskState.mockResolvedValueOnce({
      id: 'state-1',
      judgment_route: 'safety_support',
      can_show_responsibility_ratio: false,
      reasons: ['active case risk'],
    });

    const result = await service.getJudgmentStatus('room-1', { userId: 'u1' });

    expect(result.latestLink?.judgment).toMatchObject({
      judgment_route: 'safety_support',
      responsibility_ratio_visibility: {
        can_show: false,
        reason: '安全支持路由不得展示責任比例，避免把安全風險對稱化',
      },
    });
  });

  it('listMessages: roleB + share_from_join_time 應只取加入後訊息', async () => {
    const joinedAt = new Date('2026-02-25T10:00:00.000Z');
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true, joined_at: new Date('2026-02-25T09:00:00.000Z') }),
        humanParticipant({ id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true, joined_at: joinedAt }),
      ],
    });
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([]);

    await service.listMessages('room-1', { userId: 'u2' }, { limit: 20 });

    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          room_id: 'room-1',
          OR: [
            {
              visibility_scope: 'all',
              OR: [
                { channel_id: null },
                { channel: { is: { kind: 'shared' } } },
              ],
              created_at: { gte: joinedAt },
            },
            {
              sender_participant_id: 'p-b',
              visibility_scope: { in: ['owner_only', 'summary_only'] },
              channel_id: null,
            },
            { channel: { is: { kind: 'private', owner_participant_id: 'p-b' } } },
          ],
        }),
      })
    );
  });

  it('listMessages: roleA 也只能讀 shared 與自己發出的 private 訊息', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-private-projection',
      status: 'group_active',
      history_visibility_mode: 'share_full_history',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        humanParticipant({ id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
      ],
    });
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([]);

    await service.listMessages('room-private-projection', { userId: 'u1' }, { limit: 20 });

    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          room_id: 'room-private-projection',
          OR: [
            {
              visibility_scope: 'all',
              OR: [
                { channel_id: null },
                { channel: { is: { kind: 'shared' } } },
              ],
            },
            {
              sender_participant_id: 'p-a',
              visibility_scope: { in: ['owner_only', 'summary_only'] },
              channel_id: null,
            },
            { channel: { is: { kind: 'private', owner_participant_id: 'p-a' } } },
          ],
        }),
      }),
    );
  });

  it('sendMessage: legacy summary_only 應 fail closed 且不落庫', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-summary-blocked',
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });

    await expect(service.sendMessage('room-summary-blocked', { userId: 'u1' }, {
      content: '不可假裝是摘要的原文',
      visibilityScope: 'summary_only',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: {
        reason_code: 'CHAT_SUMMARY_ONLY_UNAVAILABLE',
        safe_visibility_scope: 'owner_only',
      },
    });

    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
  });

  it('sendMessage: shared write locks actor and roleB before message create', async () => {
    const room = {
      id: 'room-shared-locks',
      status: 'group_active',
      history_visibility_mode: 'share_full_history',
      participants: [
        humanParticipant({
          id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true,
        }),
        humanParticipant({
          id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true,
        }),
      ],
    };
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce(room);
    prismaMock.chatMessage.create.mockResolvedValueOnce({
      id: 'message-shared-locks',
      room_id: room.id,
      channel_id: 'channel-shared',
      sender_participant_id: 'p-a',
      content: 'shared content',
      message_type: 'user_text',
      visibility_scope: 'all',
      sender_participant: room.participants[0],
      channel: {
        id: 'channel-shared',
        kind: 'shared',
        owner_participant_id: null,
      },
    });

    await service.sendMessage(room.id, { userId: 'u1' }, {
      content: 'shared content',
      visibilityScope: 'all',
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.$queryRaw.mock.invocationCallOrder[1],
    );
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      prismaMock.$queryRaw.mock.invocationCallOrder[2],
    );
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[2]).toBeLessThan(
      prismaMock.chatMessage.create.mock.invocationCallOrder[0],
    );
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'ReadCommitted' },
    );
  });

  it.each([
    ['legacy', undefined],
    ['channelized', 'channel-shared'],
  ] as const)(
    'sendMessage: %s shared send creates zero rows when roleB leave/kick wins the lock race',
    async (_path, channelId) => {
      const room = {
        id: `room-${_path}-leave-first`,
        status: 'group_active',
        history_visibility_mode: 'share_full_history',
        participants: [
          humanParticipant({
            id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true,
          }),
          humanParticipant({
            id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true,
          }),
        ],
      };
      prismaMock.chatRoom.findFirst.mockResolvedValueOnce(room);
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ id: 'p-a' }])
        .mockResolvedValueOnce([{ id: 'p-a' }])
        .mockResolvedValueOnce([]);
      if (channelId) {
        chatChannelServiceMock.resolveChannelForWrite.mockResolvedValueOnce({
          room,
          participant: room.participants[0],
          channel: {
            id: channelId,
            kind: 'shared',
            owner_participant_id: null,
          },
          visibilityScope: 'all',
        });
      }

      await expect(service.sendMessage(room.id, { userId: 'u1' }, {
        content: 'must not persist',
        visibilityScope: 'all',
        channelId,
      })).rejects.toMatchObject({ code: 'CASE_NOT_EDITABLE' });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
      expect(prismaMock.chatMessage.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
    },
  );

  it('sendMessage: reply target 必須對 actor 可見且不得由 private 擴大成 shared link', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-hidden-reply',
      status: 'group_active',
      history_visibility_mode: 'share_full_history',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        humanParticipant({ id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
      ],
    });
    prismaMock.chatMessage.findFirst.mockResolvedValueOnce(null);

    await expect(service.sendMessage('room-hidden-reply', { userId: 'u1' }, {
      content: '嘗試引用隱藏訊息',
      visibilityScope: 'all',
      replyToMessageId: 'hidden-message-id',
    })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(prismaMock.chatMessage.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'hidden-message-id',
        room_id: 'room-hidden-reply',
        visibility_scope: 'all',
        OR: [
          {
            visibility_scope: 'all',
            OR: [
              { channel_id: null },
              { channel: { is: { kind: 'shared' } } },
            ],
          },
          {
            sender_participant_id: 'p-a',
            visibility_scope: { in: ['owner_only', 'summary_only'] },
            channel_id: null,
          },
          { channel: { is: { kind: 'private', owner_participant_id: 'p-a' } } },
        ],
      },
      select: { id: true },
    });
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: roleB 直接觸發應被拒絕', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-2',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        humanParticipant({ id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });

    await expect(service.requestJudgment('room-2', { userId: 'u2' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('requestJudgment: archived 房間應拒絕觸發', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-archived',
      status: 'archived',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'archived',
      history_visibility_mode: 'share_summary_only',
    });

    await expect(service.requestJudgment('room-archived', { userId: 'u1' })).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('requestJudgment: crisis_support 應先中止並寫 safety_notice', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-3',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: 'room-3', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: 'room-3', role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm1',
        content: '我最近真的很痛苦，想傷害自己',
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'crisis_support',
      reasons: ['hit'],
      detectedFlags: ['自傷/自殺風險'],
    });
    prismaMock.chatMessage.create.mockResolvedValueOnce({ id: 'safety-msg-1' });

    await expect(service.requestJudgment('room-3', { userId: 'u1' }, { locale: 'en-US' })).rejects.toMatchObject({
      code: 'CASE_NOT_READY',
    });

    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          room_id: 'room-3',
          message_type: 'safety_notice',
          safety_flag: true,
          content: 'The system detected a high-risk crisis signal, so it has switched to safety support and will not continue into a general Analysis.',
        }),
      })
    );
    expect(safetyAssessmentServiceMock.recordRouteAssessment).toHaveBeenCalledWith(
      { subjectType: 'chat_room', subjectId: 'room-3' },
      'crisis_support',
      expect.objectContaining({
        source: 'chat_judgment_policy',
        reasons: ['hit'],
        assessedByUserId: 'u1',
        updateActiveRiskState: true,
        metadata: expect.objectContaining({
          outcome: 'blocked',
          room_id: 'room-3',
          case_id: null,
          link_id: null,
          judgment_id: null,
          detected_flags: ['自傷/自殺風險'],
          source_message_range: expect.objectContaining({
            first_message_id: 'm1',
            last_message_id: 'm1',
            total_user_messages: 1,
          }),
        }),
      })
    );
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('acceptInvite: 指定邀請人不匹配應拒絕', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-1',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: 'u-target',
      room_id: 'room-4',
      room: {
        id: 'room-4',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });

    await expect(service.acceptInvite('ABC123', { userId: 'u-other' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(prismaMock.chatInvite.updateMany).not.toHaveBeenCalled();
  });

  it('acceptInvite: 競態下 updateMany=0 應回 INVALID_CODE', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-2',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-5',
      room: {
        id: 'room-5',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.acceptInvite('ABC124', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'INVALID_CODE',
    });
  });

  it('acceptInvite: 房間非 invite_pending 應拒絕', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-x',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-x',
      room: {
        id: 'room-x',
        status: 'group_active',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });

    await expect(service.acceptInvite('ABC888', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('declineInvite: 成功拒絕後無 pending 應回退房間狀態', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-3',
      room_id: 'room-7',
      status: 'pending',
      invited_user_id: 'u-b',
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-7', status: 'invite_pending' },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatInvite.count.mockResolvedValueOnce(0);
    prismaMock.chatInvite.findUnique.mockResolvedValueOnce({
      id: 'inv-3',
      room_id: 'room-7',
      status: 'declined',
    });

    const invite = await service.declineInvite('ABC125', { userId: 'u-b' });
    expect(invite?.status).toBe('declined');
    expect(prismaMock.chatRoom.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'room-7' }),
        data: { status: 'solo_active' },
      })
    );
  });

  it('declineInvite: 房間非 invite_pending 應拒絕', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-y',
      room_id: 'room-y',
      status: 'pending',
      invited_user_id: 'u-b',
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-y', status: 'group_active' },
    });

    await expect(service.declineInvite('ABC777', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('declineInvite: 指定邀請不可由匿名 session 處理', async () => {
    const sessionId = 'guest_1700000000002_cdefghijklmnopq';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: sessionId });
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-spec-anon',
      room_id: 'room-spec-anon',
      status: 'pending',
      invited_user_id: 'u-target',
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-spec-anon', status: 'invite_pending', owner_user_id: 'u-owner' },
    });

    await expect(service.declineInvite('ABC778', { sessionId })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('declineInvite: 公開邀請僅房主可撤回（第三方應拒絕）', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-z',
      room_id: 'room-z',
      status: 'pending',
      invited_user_id: null,
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-z', status: 'invite_pending', owner_user_id: 'u-owner' },
    });

    await expect(service.declineInvite('ABC776', { userId: 'u-other' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('declineInvite: 公開邀請房主可撤回', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-owner',
      room_id: 'room-owner',
      status: 'pending',
      invited_user_id: null,
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-owner', status: 'invite_pending', owner_user_id: 'u-owner' },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatInvite.count.mockResolvedValueOnce(0);
    prismaMock.chatInvite.findUnique.mockResolvedValueOnce({
      id: 'inv-owner',
      room_id: 'room-owner',
      status: 'revoked',
    });

    const invite = await service.declineInvite('ABC775', { userId: 'u-owner' });
    expect(invite?.status).toBe('revoked');
    expect(prismaMock.chatInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'revoked',
          invited_user_id: null,
        }),
      })
    );
  });

  it('declineInvite: 匿名房主（session）可撤回公開邀請', async () => {
    const ownerSessionId = 'guest_1700000000000_abcdefghijklmnop';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: ownerSessionId });
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-anon-owner',
      room_id: 'room-anon-owner',
      status: 'pending',
      invited_user_id: null,
      expires_at: new Date(Date.now() + 60000),
      room: {
        id: 'room-anon-owner',
        status: 'invite_pending',
        owner_user_id: null,
        session_id: ownerSessionId,
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatInvite.count.mockResolvedValueOnce(0);
    prismaMock.chatInvite.findUnique.mockResolvedValueOnce({
      id: 'inv-anon-owner',
      room_id: 'room-anon-owner',
      status: 'revoked',
    });

    const invite = await service.declineInvite('ABC774', { sessionId: ownerSessionId });
    expect(invite?.status).toBe('revoked');
  });

  it('declineInvite: 匿名非房主（session）不可撤回公開邀請', async () => {
    const ownerSessionId = 'guest_1700000000000_abcdefghijklmnop';
    const otherSessionId = 'guest_1700000000001_bcdefghijklmnop';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: otherSessionId });
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-anon-other',
      room_id: 'room-anon-other',
      status: 'pending',
      invited_user_id: null,
      expires_at: new Date(Date.now() + 60000),
      room: {
        id: 'room-anon-other',
        status: 'invite_pending',
        owner_user_id: null,
        session_id: ownerSessionId,
      },
    });

    await expect(service.declineInvite('ABC773', { sessionId: otherSessionId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('acceptInvite: 房間狀態 CAS 失敗時應拒絕（避免競態）', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-cas-0',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-cas-0',
      room: {
        id: 'room-cas-0',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.acceptInvite('CAS000', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('acceptInvite: 交易內若已存在其他 active roleB 應拒絕（避免覆寫）', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-roleb-conflict',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-roleb-conflict',
      room: {
        id: 'room-roleb-conflict',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatParticipant.findFirst.mockResolvedValueOnce(humanParticipant({
      id: 'p-roleb-existing',
      room_id: 'room-roleb-conflict',
      role_in_room: 'roleB',
      is_active: true,
      user_id: 'u-other',
    }));

    await expect(service.acceptInvite('CAS001', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prismaMock.chatParticipant.create).not.toHaveBeenCalled();
  });

  it('acceptInvite: B1 私聊後離房時不得把歷史 participant/private owner 重綁給 B2', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-roleb-reuse',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-roleb-reuse',
      room: {
        id: 'room-roleb-reuse',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatParticipant.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.chatParticipant.create.mockResolvedValueOnce(humanParticipant({
      id: 'p-roleb-b2',
      room_id: 'room-roleb-reuse',
      role_in_room: 'roleB',
      is_active: true,
      user_id: 'u-b2',
    }));
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      id: 'room-roleb-reuse',
      status: 'group_active',
      participants: [humanParticipant({
        id: 'p-roleb-b2',
        room_id: 'room-roleb-reuse',
        role_in_room: 'roleB',
        is_active: true,
        user_id: 'u-b2',
      })],
    });

    const room = await service.acceptInvite('CAS002', { userId: 'u-b2' });
    expect(room.status).toBe('group_active');
    expect(prismaMock.chatParticipant.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          room_id: 'room-roleb-reuse',
          role_in_room: 'roleB',
          user_id: 'u-b2',
        }),
      }),
    );
    expect(prismaMock.chatParticipant.update).not.toHaveBeenCalled();
    expect(prismaMock.chatParticipant.create).toHaveBeenCalledWith({
      data: {
        room_id: 'room-roleb-reuse',
        participant_type: 'user',
        user_id: 'u-b2',
        role_in_room: 'roleB',
      },
    });
    expect(prismaMock.chatChannel.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ owner_participant_id: 'p-roleb-b2', kind: 'private' }),
      ]),
    }));
    expect(chatStreamEntitlementServiceMock.activateParticipant)
      .toHaveBeenCalledWith('p-roleb-b2');
    expect(chatStreamEntitlementServiceMock.activateParticipant)
      .not.toHaveBeenCalledWith('p-roleb-b1');
    expect(prismaMock.chatParticipant.updateMany).toHaveBeenCalledWith({
      where: {
        room_id: 'room-roleb-reuse',
        id: { not: 'p-roleb-b2' },
        participant_type: 'user',
        role_in_room: { in: ['roleA', 'roleB'] },
        is_active: true,
        left_at: null,
      },
      data: SHARED_ADAPTATION_RESET,
    });
  });

  it('acceptInvite: 同一 user rejoin 才可復用自己的歷史 participant/private channel', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-roleb-same-user',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-roleb-same-user',
      room: {
        id: 'room-roleb-same-user',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatParticipant.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(humanParticipant({
        id: 'p-roleb-same-user',
        room_id: 'room-roleb-same-user',
        role_in_room: 'roleB',
        is_active: false,
        user_id: 'u-b',
        left_at: new Date('2026-07-01T00:00:00.000Z'),
      }));
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      id: 'room-roleb-same-user',
      status: 'group_active',
      participants: [humanParticipant({
        id: 'p-roleb-same-user',
        room_id: 'room-roleb-same-user',
        role_in_room: 'roleB',
        is_active: true,
        user_id: 'u-b',
      })],
    });

    await service.acceptInvite('CAS-SAME', { userId: 'u-b' });

    expect(prismaMock.chatParticipant.update).toHaveBeenCalledWith({
      where: { id: 'p-roleb-same-user' },
      data: expect.objectContaining({
        user_id: 'u-b',
        is_active: true,
        left_at: null,
        joined_at: expect.any(Date),
        ...SHARED_ADAPTATION_RESET,
      }),
    });
    expect(prismaMock.chatParticipant.updateMany).toHaveBeenCalledWith({
      where: {
        room_id: 'room-roleb-same-user',
        id: { not: 'p-roleb-same-user' },
        participant_type: 'user',
        role_in_room: { in: ['roleA', 'roleB'] },
        is_active: true,
        left_at: null,
      },
      data: SHARED_ADAPTATION_RESET,
    });
    expect(prismaMock.chatParticipant.create).not.toHaveBeenCalled();
    expect(chatStreamEntitlementServiceMock.activateParticipant)
      .toHaveBeenCalledWith('p-roleb-same-user');
  });

  it('acceptInvite: 命中資料庫唯一鍵衝突時應映射為 CONFLICT', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-roleb-p2002',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-roleb-p2002',
      room: {
        id: 'room-roleb-p2002',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatParticipant.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const p2002Error = Object.assign(new Error('unique conflict'), { code: 'P2002' });
    prismaMock.chatParticipant.create.mockRejectedValueOnce(p2002Error);

    await expect(service.acceptInvite('CAS003', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('requestJudgment: completed 且短時間重試應命中冪等返回既有 link', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-8',
      status: 'judgment_completed',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_completed',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a',
      room_id: 'room-8',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-8',
      room_id: 'room-8',
      case_id: 'case-8',
      created_at: new Date(),
      judgment: { id: 'judgment-8' },
    });

    const result = await service.requestJudgment('room-8', { userId: 'u1' });
    expect(result).toMatchObject({
      roomId: 'room-8',
      caseId: 'case-8',
      judgmentId: 'judgment-8',
      linkId: 'link-8',
      status: 'judgment_completed',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: completed 且無新訊息（超過短窗）仍應復用既有結果', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-8b',
      status: 'judgment_completed',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true })],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_completed',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a',
      room_id: 'room-8b',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-8b',
      room_id: 'room-8b',
      case_id: 'case-8b',
      created_at: new Date(Date.now() - 10 * 60_000),
      judgment: { id: 'judgment-8b' },
      case: { id: 'case-8b', status: 'completed' },
    });
    prismaMock.chatMessage.count.mockResolvedValueOnce(0);

    const result = await service.requestJudgment('room-8b', { userId: 'u1' });
    expect(result).toMatchObject({
      roomId: 'room-8b',
      caseId: 'case-8b',
      judgmentId: 'judgment-8b',
      linkId: 'link-8b',
      status: 'judgment_completed',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: completed 但有新訊息（即使短窗內）應進入新流程', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-8c',
      status: 'judgment_completed',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-8c',
      room_id: 'room-8c',
      case_id: 'case-8c-old',
      created_at: new Date(Date.now() - 5_000),
      judgment: { id: 'judgment-8c-old' },
      case: {
        id: 'case-8c-old',
        status: 'completed',
        judgment: { id: 'judgment-8c-old' },
      },
    });
    prismaMock.chatMessage.count.mockResolvedValueOnce(1);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-new-1',
        content: '我還有新補充，昨天又發生一次',
        created_at: new Date('2026-02-26T11:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.create.mockResolvedValueOnce({ id: 'pair-8c' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-8c', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-8c-new' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-8c-new' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-8c-new' });
    prismaMock.chatToCaseLink.update.mockResolvedValue({ id: 'link-8c-new', judgment_id: 'judgment-8c-new' });

    const result = await service.requestJudgment('room-8c', { userId: 'u1' });

    expect(result.caseId).toBe('case-8c-new');
    expect(prismaMock.case.create).toHaveBeenCalled();
    expect(prismaMock.chatToCaseLink.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'link-8c' },
      data: { judgment_id: 'judgment-8c-old' },
    });
    expect(prismaMock.chatToCaseLink.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'link-8c-new' },
      data: { judgment_id: 'judgment-8c-new' },
    });
  });

  it('requestJudgment: 單人登入房應復用 owner 既有 active/pending normal pairing', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-solo-pairing-reuse',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a',
      room_id: 'room-solo-pairing-reuse',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce(null);
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: 'room-solo-pairing-reuse', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: 'room-solo-pairing-reuse', role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      { id: 'm-a', content: '我希望把這段聊天整理成判決建議', created_at: new Date(), sender_participant: { role_in_room: 'roleA' } },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.findFirst.mockResolvedValueOnce({
      id: 'pair-solo-existing',
      user1_id: 'u1',
      user2_id: 'u2',
      status: 'active',
    });
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-solo-reuse' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-solo-reuse' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-solo-reuse' });
    prismaMock.chatRoom.update.mockResolvedValueOnce({ id: 'room-solo-pairing-reuse', status: 'judgment_completed' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-solo-reuse', judgment_id: 'judgment-solo-reuse' });

    const result = await service.requestJudgment('room-solo-pairing-reuse', { userId: 'u1' });

    expect(result.caseId).toBe('case-solo-reuse');
    expect(prismaMock.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pairing_id: 'pair-solo-existing',
          title: expect.stringMatching(/^聊天室轉梳理結果-\d{4}-\d{2}-\d{2}$/),
        }),
      })
    );
    expect(prismaMock.case.create.mock.calls[0][0].data.title).not.toContain('判決');
    expect(prismaMock.pairing.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 單人 live pairing 建立遇 P2002 時應整體重試並復用', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-solo-pairing-race',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a',
      room_id: 'room-solo-pairing-race',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce(null);
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: 'room-solo-pairing-race', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: 'room-solo-pairing-race', role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValue([
      { id: 'm-a', content: '我希望把這段聊天整理成判決建議', created_at: new Date(), sender_participant: { role_in_room: 'roleA' } },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValue({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'pair-solo-raced', user1_id: 'u1', user2_id: 'u2', status: 'active' });
    prismaMock.pairing.create.mockRejectedValueOnce(Object.assign(new Error('unique conflict'), { code: 'P2002' }));
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-solo-race' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-solo-race' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-solo-race' });
    prismaMock.chatRoom.update.mockResolvedValueOnce({ id: 'room-solo-pairing-race', status: 'judgment_completed' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-solo-race', judgment_id: 'judgment-solo-race' });

    const result = await service.requestJudgment('room-solo-pairing-race', { userId: 'u1' });

    expect(result.caseId).toBe('case-solo-race');
    expect(prismaMock.pairing.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pairing_id: 'pair-solo-raced' }),
      })
    );
  });

  it.each(['judgment_failed', 'judgment_requested'])(
    'requestJudgment: %s crash/retry 應復用既有 case/link，不重複建案',
    async (roomStatus) => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-retry',
      status: roomStatus,
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: roomStatus,
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a',
      room_id: 'room-retry',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-retry',
      room_id: 'room-retry',
      case_id: 'case-retry',
      created_at: new Date(Date.now() - 30_000),
      judgment: null,
      case: { id: 'case-retry', status: 'submitted' },
    });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-retry', status: 'judgment_requested' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-retry' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-retry', judgment_id: 'judgment-retry' });

    const result = await service.requestJudgment('room-retry', { userId: 'u1' });

    expect(result).toEqual({
      roomId: 'room-retry',
      caseId: 'case-retry',
      judgmentId: 'judgment-retry',
      linkId: 'link-retry',
      status: 'judgment_completed',
    });
    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledWith('case-retry', {
      userId: 'u1',
      sessionId: undefined,
      locale: undefined,
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    },
  );

  it('requestJudgment: processing recovery raw integrity 失敗時應轉 judgment_failed 而非永久卡住', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-recovery-tampered',
      status: 'judgment_requested',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_requested',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a',
      room_id: 'room-recovery-tampered',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-recovery-tampered',
      room_id: 'room-recovery-tampered',
      case_id: 'case-recovery-tampered',
      created_at: new Date(Date.now() - 30_000),
      judgment: null,
      case: { id: 'case-recovery-tampered', status: 'submitted' },
      conversion_snapshot: { included_message_ids: ['tampered-message'] },
    });
    chatAnalysisEvidenceServiceMock.claimCaseGenerationInTransaction.mockRejectedValueOnce(
      Object.assign(new Error('Consumed Analysis message source 已變更'), { code: 'CONFLICT' }),
    );

    await expect(service.requestJudgment(
      'room-recovery-tampered',
      { userId: 'u1' },
    )).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(prismaMock.chatRoom.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'room-recovery-tampered',
        status: 'judgment_requested',
      },
      data: { status: 'judgment_failed' },
    });
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('requestJudgment: judgment_failed 但有新訊息時應走新建案流程', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-retry-new',
      status: 'judgment_failed',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      session_id: null,
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-old',
      room_id: 'room-retry-new',
      case_id: 'case-old',
      created_at: new Date(Date.now() - 60_000),
      judgment: null,
      case: { id: 'case-old', status: 'judgment_failed' },
    });
    prismaMock.chatMessage.count.mockResolvedValueOnce(2);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      { id: 'm-a', content: '昨天我們又吵了', sender_participant: { role_in_room: 'roleA' } },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.create.mockResolvedValueOnce({ id: 'pair-new' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-retry-new', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-new' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-new' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-new' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-new', judgment_id: 'judgment-new' });

    const result = await service.requestJudgment('room-retry-new', { userId: 'u1' });
    expect(result.caseId).toBe('case-new');
    expect(prismaMock.case.create).toHaveBeenCalled();
  });

  it('requestJudgment: safety_support 應寫入 pre_route 與分層分析到 snapshot', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-6',
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        humanParticipant({ id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: 'room-6', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      humanParticipant({ id: 'p-b', room_id: 'room-6', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: 'room-6', role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm1',
        content: '昨天你對我大吼，我真的很害怕也很難過',
        created_at: new Date('2026-02-26T10:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
      {
        id: 'm2',
        content: '我承認那天語氣很差，但我當時也很焦慮',
        created_at: new Date('2026-02-26T10:05:00.000Z'),
        sender_participant: { role_in_room: 'roleB' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'safety_support',
      reasons: ['IPV-like signal'],
      detectedFlags: ['控制/暴力/威脅風險'],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('情感需求衝突');
    prismaMock.case.update.mockRejectedValueOnce(new Error('case type update failed'));
    prismaMock.pairing.findFirst.mockResolvedValueOnce({
      id: 'pair-1',
      status: 'active',
    });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-6', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-6' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-6' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-6' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-6', judgment_id: 'judgment-6' });
    prismaMock.chatMessage.create.mockResolvedValue({ id: 'notice-6' });
    chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction.mockResolvedValueOnce(submittedAnalysisEvidence({
      requiredParticipantIds: ['p-a', 'p-b'],
      approvalIds: ['approval-a', 'approval-b'],
      messages: [
        { id: 'm1', content: '昨天你對我大吼，我真的很害怕也很難過', senderParticipantId: 'p-a', senderRole: 'roleA', createdAt: new Date('2026-02-26T10:00:00.000Z') },
        { id: 'm2', content: '我承認那天語氣很差，但我當時也很焦慮', senderParticipantId: 'p-b', senderRole: 'roleB', createdAt: new Date('2026-02-26T10:05:00.000Z') },
      ],
    }));

    const result = await service.requestJudgment('room-6', { userId: 'u1' }, {
      analysisRequestId: ANALYSIS_REQUEST_ID,
    });

    expect(result.caseId).toBe('case-6');
    expect(prismaMock.case.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: '其他衝突' }),
    }));
    expect(prismaMock.case.update).toHaveBeenCalledWith({
      where: { id: 'case-6' },
      data: { type: '情感需求衝突' },
    });
    expect(prismaMock.chatToCaseLink.create.mock.invocationCallOrder[0]).toBeLessThan(
      aiServiceMock.detectCaseType.mock.invocationCallOrder[0],
    );
    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledWith(
      'case-6',
      expect.objectContaining({ expectedChatAnalysisRequestId: ANALYSIS_REQUEST_ID }),
    );
    expect(prismaMock.chatToCaseLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversion_snapshot: expect.objectContaining({
            pre_route: 'safety_support',
            pre_route_flags: expect.arrayContaining(['控制/暴力/威脅風險']),
            safety_gate: expect.objectContaining({
              can_request_chat_judgment: true,
              should_create_safety_notice: true,
              reasons: ['IPV-like signal'],
            }),
            source_message_range: expect.objectContaining({
              first_message_id: 'm1',
              last_message_id: 'm2',
              total_user_messages: 2,
            }),
            emotion_highlights: expect.any(Array),
            fact_highlights: expect.any(Array),
            information_gaps: expect.any(Array),
            transform_confidence: expect.stringMatching(/low|medium|high/),
            layer_usability: expect.objectContaining({
              emotion: expect.objectContaining({
                level: expect.stringMatching(/insufficient|partial|usable|rich/),
              }),
              fact: expect.objectContaining({
                level: expect.stringMatching(/insufficient|partial|usable|rich/),
              }),
              interaction: expect.objectContaining({
                level: expect.stringMatching(/insufficient|partial|usable|rich/),
              }),
            }),
            gap_details: expect.any(Array),
            signal_stats: expect.objectContaining({
              totalUserMessages: 2,
              roleAMessages: 1,
              roleBMessages: 1,
            }),
            participant_consent: expect.objectContaining({
              role_b_messages_included: true,
              role_b_inclusion_consent_asserted: true,
              role_b_consent_required: true,
              role_b_participant_id: 'p-b',
              role_b_user_id: 'u2',
            }),
            conversion_version: 'v2-layered-2026-02',
          }),
        }),
      })
    );
    expect(safetyAssessmentServiceMock.recordRouteAssessment).toHaveBeenCalledWith(
      { subjectType: 'chat_room', subjectId: 'room-6' },
      'safety_support',
      expect.objectContaining({
        source: 'chat_judgment_policy',
        reasons: ['IPV-like signal'],
        assessedByUserId: 'u1',
        updateActiveRiskState: true,
        metadata: expect.objectContaining({
          outcome: 'judgment_completed',
          room_id: 'room-6',
          case_id: 'case-6',
          link_id: 'link-6',
          judgment_id: 'judgment-6',
          detected_flags: ['控制/暴力/威脅風險'],
          participant_consent: expect.objectContaining({
            role_b_messages_included: true,
            role_b_inclusion_consent_asserted: true,
            role_b_consent_required: true,
            role_b_participant_id: 'p-b',
            role_b_user_id: 'u2',
          }),
          layer_summary: expect.objectContaining({
            role_a_messages: 1,
            role_b_messages: 1,
          }),
        }),
      })
    );
  });

  it('requestJudgment: legacy caller consent 無效，B 方內容缺 analysis request 應 fail closed', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-b-consent',
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        humanParticipant({ id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: 'room-b-consent', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      humanParticipant({ id: 'p-b', room_id: 'room-b-consent', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: 'room-b-consent', role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-a-consent',
        content: '我想整理我們的對話',
        created_at: new Date('2026-02-26T10:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
      {
        id: 'm-b-consent',
        content: '我也說一下我的看法',
        created_at: new Date('2026-02-26T10:05:00.000Z'),
        sender_participant: { role_in_room: 'roleB' },
      },
    ]);

    await expect(service.requestJudgment(
      'room-b-consent',
      { userId: 'u1' },
      { participantConsent: { roleBIncludedMessages: true } } as never,
    )).rejects.toMatchObject({
      code: 'CASE_NOT_READY',
      details: { reason_code: 'CHAT_ANALYSIS_APPROVAL_REQUIRED' },
    });
    expect(chatAnalysisEvidenceServiceMock.resolveSubmitted).not.toHaveBeenCalled();
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(prismaMock.chatToCaseLink.create).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('requestJudgment: exact submitted bundle 可納入 B 方與 capsule 並記錄 approval refs', async () => {
    const roomId = 'room-exact-analysis';
    const messageAAt = new Date('2026-07-12T12:00:00.000Z');
    const messageBAt = new Date('2026-07-12T12:01:00.000Z');
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: roomId,
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_full_history',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        humanParticipant({ id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'group_active',
      history_visibility_mode: 'share_full_history',
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: roomId, role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      humanParticipant({ id: 'p-b', room_id: roomId, role_in_room: 'roleB', user_id: 'u2', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: roomId, role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce(null);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-exact-a',
        content: 'A 方納入的共同內容',
        created_at: messageAAt,
        sender_participant: { role_in_room: 'roleA' },
      },
      {
        id: 'm-exact-b',
        content: 'B 方納入的共同內容',
        created_at: messageBAt,
        sender_participant: { role_in_room: 'roleB' },
      },
    ]);
    chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction.mockResolvedValueOnce(submittedAnalysisEvidence({
      requiredParticipantIds: ['p-a', 'p-b'],
      approvalIds: ['approval-b', 'approval-a'],
      messages: [
        { id: 'm-exact-a', content: 'A 方納入的共同內容', senderParticipantId: 'p-a', senderRole: 'roleA', createdAt: messageAAt },
        { id: 'm-exact-b', content: 'B 方納入的共同內容', senderParticipantId: 'p-b', senderRole: 'roleB', createdAt: messageBAt },
      ],
      capsules: [
        {
          id: 'capsule-b',
          summary: 'B 方已批准的摘要',
          ownerParticipantId: 'p-b',
          ownerRole: 'roleB',
          contentHash: 'capsule-hash-b',
        },
      ],
    }));
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    let preparationCommitted = false;
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => {
      const result = await callback(prismaMock);
      if (prismaMock.chatToCaseLink.create.mock.calls.length > 0) {
        preparationCommitted = true;
      }
      return result;
    });
    aiServiceMock.detectCaseType.mockImplementationOnce(async () => {
      expect(preparationCommitted).toBe(true);
      return '其他衝突';
    });
    prismaMock.pairing.findFirst.mockResolvedValueOnce({ id: 'pair-exact', status: 'active' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-exact' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-exact' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-exact' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({
      id: 'link-exact',
      judgment_id: 'judgment-exact',
    });

    const result = await service.requestJudgment(roomId, { userId: 'u1' }, {
      analysisRequestId: ANALYSIS_REQUEST_ID,
    });

    expect(result).toMatchObject({ caseId: 'case-exact', judgmentId: 'judgment-exact' });
    expect(chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction).toHaveBeenCalledWith(
      prismaMock,
      roomId,
      ANALYSIS_REQUEST_ID,
      { userId: 'u1', sessionId: undefined },
    );
    expect(chatAnalysisEvidenceServiceMock.markCompleted).toHaveBeenCalledWith(
      ANALYSIS_REQUEST_ID,
      prismaMock,
    );
    expect(prismaMock.case.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        defendant_statement: expect.stringContaining('B 方已批准的摘要'),
      }),
    }));
    expect(prismaMock.chatToCaseLink.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        conversion_snapshot: expect.objectContaining({
          participant_consent: expect.objectContaining({
            role_b_inclusion_consent_asserted: true,
          }),
          analysis_request: {
            id: ANALYSIS_REQUEST_ID,
            selection_hash: 'selection-hash-v1',
            policy_version: 'chat-analysis-policy@v1',
            approval_ids: ['approval-b', 'approval-a'],
            capsule_ids: ['capsule-b'],
            capsule_content_hashes: ['capsule-hash-b'],
          },
        }),
      }),
    }));
  });

  it('requestJudgment: exact bundle 生成失敗時應保留 processing 供 original recovery', async () => {
    const roomId = 'room-exact-retry';
    const messageAt = new Date('2026-07-12T13:00:00.000Z');
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: roomId,
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_full_history',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_full_history',
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: roomId, role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: roomId, role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce(null);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-exact-retry',
        content: 'A 方納入的內容',
        created_at: messageAt,
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction.mockResolvedValueOnce(submittedAnalysisEvidence({
      messages: [
        { id: 'm-exact-retry', content: 'A 方納入的內容', senderParticipantId: 'p-a', senderRole: 'roleA', createdAt: messageAt },
      ],
    }));
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.create.mockResolvedValueOnce({ id: 'pair-exact-retry' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-exact-retry' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-exact-retry' });
    judgmentServiceMock.generateJudgment.mockRejectedValueOnce(new Error('judgment provider failed'));
    prismaMock.chatRoom.update.mockResolvedValue({ id: roomId, status: 'judgment_failed' });

    await expect(service.requestJudgment(roomId, { userId: 'u1' }, {
      analysisRequestId: ANALYSIS_REQUEST_ID,
    })).rejects.toThrow('judgment provider failed');

    expect(chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction).toHaveBeenCalledWith(
      prismaMock,
      roomId,
      ANALYSIS_REQUEST_ID,
      { userId: 'u1', sessionId: undefined },
    );
    expect(chatAnalysisEvidenceServiceMock.markCompleted).not.toHaveBeenCalled();
  });

  it('requestJudgment: Judgment 已持久化但 outer finalize 連續失敗時，下次請求應補鏈且不得重複建案', async () => {
    const roomId = 'room-outer-finalize-recovery';
    const caseId = 'case-outer-finalize-recovery';
    const linkId = 'link-outer-finalize-recovery';
    const judgmentId = 'judgment-outer-finalize-recovery';
    const messageAt = new Date('2026-07-12T14:00:00.000Z');
    const participant = humanParticipant({
      id: 'p-a',
      room_id: roomId,
      role_in_room: 'roleA',
      user_id: 'u1',
      is_active: true,
    });
    const room = {
      id: roomId,
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_full_history',
      participants: [participant],
    };
    prismaMock.chatRoom.findFirst
      .mockResolvedValueOnce(room)
      .mockResolvedValueOnce({ ...room, status: 'judgment_requested' });
    prismaMock.chatRoom.findUnique
      .mockResolvedValueOnce({
        status: 'solo_active',
        history_visibility_mode: 'share_full_history',
      })
      .mockResolvedValueOnce({
        status: 'judgment_requested',
        history_visibility_mode: 'share_full_history',
      });
    prismaMock.chatParticipant.findUnique.mockResolvedValue(participant);
    prismaMock.chatParticipant.findMany.mockResolvedValue([participant]);
    prismaMock.chatToCaseLink.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: linkId,
        room_id: roomId,
        case_id: caseId,
        created_at: messageAt,
        judgment: null,
        conversion_snapshot: {
          included_message_ids: ['m-outer-finalize'],
          analysis_request: {
            id: ANALYSIS_REQUEST_ID,
            selection_hash: 'selection-hash-v1',
            policy_version: 'chat-analysis-policy@v1',
            approval_ids: ['approval-a'],
            capsule_ids: [],
            capsule_content_hashes: [],
          },
        },
        case: {
          id: caseId,
          status: 'completed',
          judgment: { id: judgmentId },
        },
      });
    prismaMock.chatMessage.count.mockResolvedValueOnce(0);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([{
      id: 'm-outer-finalize',
      content: 'A 方已批准的內容',
      created_at: messageAt,
      sender_participant: { role_in_room: 'roleA' },
    }]);
    chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction.mockResolvedValueOnce(
      submittedAnalysisEvidence({
        messages: [{
          id: 'm-outer-finalize',
          content: 'A 方已批准的內容',
          senderParticipantId: participant.id,
          senderRole: 'roleA',
          createdAt: messageAt,
        }],
      }),
    );
    safetyRoutingServiceMock.decideRoute.mockReturnValue({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValue('其他衝突');
    prismaMock.pairing.create.mockResolvedValue({ id: 'pair-outer-finalize' });
    prismaMock.case.create.mockResolvedValue({ id: caseId });
    prismaMock.chatToCaseLink.create.mockResolvedValue({ id: linkId });
    judgmentServiceMock.generateJudgment.mockResolvedValue({ id: judgmentId });

    let transactionCall = 0;
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      transactionCall += 1;
      if (transactionCall === 2 || transactionCall === 3) {
        throw new Error(`outer finalize unavailable ${transactionCall}`);
      }
      return fn(prismaMock);
    });

    await expect(service.requestJudgment(roomId, { userId: 'u1' }, {
      analysisRequestId: ANALYSIS_REQUEST_ID,
    })).rejects.toThrow('Judgment 已持久化，但 Chat 狀態尚未完成對齊');

    expect(prismaMock.chatRoom.update).not.toHaveBeenCalledWith({
      where: { id: roomId },
      data: { status: 'judgment_failed' },
    });
    expect(chatMetricsServiceMock.recordJudgmentFailed).not.toHaveBeenCalled();

    const recovered = await service.requestJudgment(roomId, { userId: 'u1' }, {
      analysisRequestId: ANALYSIS_REQUEST_ID,
    });

    expect(recovered).toMatchObject({
      roomId,
      caseId,
      linkId,
      judgmentId,
      status: 'judgment_completed',
    });
    expect(prismaMock.case.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.chatToCaseLink.create).toHaveBeenCalledTimes(1);
    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledTimes(1);
    expect(prismaMock.chatToCaseLink.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.chatToCaseLink.update).toHaveBeenCalledWith({
      where: { id: linkId },
      data: { judgment_id: judgmentId },
    });
    expect(chatAnalysisEvidenceServiceMock.markCompleted).toHaveBeenCalledWith(
      ANALYSIS_REQUEST_ID,
      prismaMock,
    );
  });

  it('requestJudgment: preparation 建案失敗應 rollback 且不可先送任何 approved evidence 給 AI', async () => {
    const roomId = 'room-prepare-rollback';
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: roomId,
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_full_history',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: roomId, role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: roomId, role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([{
      id: 'm-prepare',
      content: 'approved content must not leave before commit',
      created_at: new Date('2026-07-12T13:00:00.000Z'),
      sender_participant: { role_in_room: 'roleA' },
    }]);
    chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction.mockResolvedValueOnce(
      submittedAnalysisEvidence({
        messages: [{
          id: 'm-prepare',
          content: 'approved content must not leave before commit',
          senderParticipantId: 'p-a',
          senderRole: 'roleA',
          createdAt: new Date('2026-07-12T13:00:00.000Z'),
        }],
      }),
    );
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    prismaMock.case.create.mockRejectedValueOnce(new Error('case insert failed'));

    await expect(service.requestJudgment(roomId, { userId: 'u1' }, {
      analysisRequestId: ANALYSIS_REQUEST_ID,
    })).rejects.toThrow('case insert failed');

    expect(chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction).toHaveBeenCalled();
    expect(aiServiceMock.detectCaseType).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('requestJudgment: 單邊陳述時應標記 interaction/fact 高風險缺口', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-gap',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: 'room-gap', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: 'room-gap', role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-gap-1',
        content: '我真的很難過',
        created_at: new Date('2026-02-26T15:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.create.mockResolvedValueOnce({ id: 'pair-gap' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-gap', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-gap' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-gap' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-gap' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-gap', judgment_id: 'judgment-gap' });
    safetyAssessmentServiceMock.recordRouteAssessment.mockRejectedValueOnce(new Error('missing safety table'));

    await service.requestJudgment('room-gap', { userId: 'u1' });

    expect(prismaMock.chatToCaseLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversion_snapshot: expect.objectContaining({
            layer_usability: expect.objectContaining({
              interaction: expect.objectContaining({ level: 'insufficient' }),
            }),
            gap_details: expect.arrayContaining([
              expect.objectContaining({ code: 'MISSING_ROLE_B_STATEMENT', severity: 'high' }),
              expect.objectContaining({ code: 'INSUFFICIENT_EVENT_CHAIN', severity: 'high' }),
            ]),
          }),
        }),
      })
    );
    expect(safetyAssessmentServiceMock.recordRouteAssessment).toHaveBeenCalledWith(
      { subjectType: 'chat_room', subjectId: 'room-gap' },
      'standard',
      expect.objectContaining({
        source: 'chat_judgment_policy',
        updateActiveRiskState: false,
        metadata: expect.objectContaining({
          outcome: 'judgment_completed',
          case_id: 'case-gap',
          link_id: 'link-gap',
          judgment_id: 'judgment-gap',
        }),
      })
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Chat route safety assessment persistence failed',
      expect.objectContaining({
        roomId: 'room-gap',
        route: 'standard',
        outcome: 'judgment_completed',
      })
    );
  });

  it('requestJudgment: 英文訊息也應被分層規則辨識（避免語言偏差）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-en',
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        humanParticipant({ id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a', room_id: 'room-en', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      humanParticipant({ id: 'p-b', room_id: 'room-en', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
      aiParticipant({ id: 'p-ai', room_id: 'room-en', role_in_room: 'aiMediator', user_id: null, is_active: true }),
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-en-1',
        content:
          'Yesterday at 9pm you said I was overreacting, I felt sad and anxious because this happened again. I need to feel understood.',
        created_at: new Date('2026-02-27T09:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
      {
        id: 'm-en-2',
        content: 'I did ignore your message. Last week we argued again after work.',
        created_at: new Date('2026-02-27T09:05:00.000Z'),
        sender_participant: { role_in_room: 'roleB' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.findFirst.mockResolvedValueOnce({
      id: 'pair-en',
      status: 'active',
    });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-en', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-en' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-en' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-en' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-en', judgment_id: 'judgment-en' });
    chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction.mockResolvedValueOnce(submittedAnalysisEvidence({
      requiredParticipantIds: ['p-a', 'p-b'],
      approvalIds: ['approval-a', 'approval-b'],
      messages: [
        { id: 'm-en-1', content: 'English A', senderParticipantId: 'p-a', senderRole: 'roleA', createdAt: new Date('2026-02-27T09:00:00.000Z') },
        { id: 'm-en-2', content: 'English B', senderParticipantId: 'p-b', senderRole: 'roleB', createdAt: new Date('2026-02-27T09:05:00.000Z') },
      ],
    }));

    await service.requestJudgment('room-en', { userId: 'u1' }, {
      locale: 'en-US',
      analysisRequestId: ANALYSIS_REQUEST_ID,
    });

    const createCallArg = prismaMock.chatToCaseLink.create.mock.calls[0][0];
    const snapshot = createCallArg.data.conversion_snapshot;
    expect(snapshot.signal_stats.emotionSignalCount).toBeGreaterThan(0);
    expect(snapshot.signal_stats.needSignalCount).toBeGreaterThan(0);
    expect(snapshot.signal_stats.timeSignalCount).toBeGreaterThan(0);
    expect(snapshot.signal_stats.eventSignalCount).toBeGreaterThan(0);
    expect(snapshot.signal_stats.causalSignalCount).toBeGreaterThan(0);
    expect(snapshot.layer_usability.emotion.level).toMatch(/partial|usable|rich/);
    expect(snapshot.layer_usability.fact.level).toMatch(/partial|usable|rich/);
    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledWith('case-en', {
      userId: 'u1',
      sessionId: undefined,
      locale: 'en-US',
      expectedChatAnalysisRequestId: ANALYSIS_REQUEST_ID,
    });
    expect(prismaMock.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: expect.stringMatching(/^Chat to Analysis-\d{4}-\d{2}-\d{2}$/),
        }),
      })
    );
    expect(snapshot.gap_details).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_EMOTION_SIGNAL' }),
        expect.objectContaining({ code: 'MISSING_TIME_ANCHOR' }),
        expect.objectContaining({ code: 'MISSING_CAUSAL_LINK' }),
      ])
    );
  });

  it('requestJudgment: 完成後重複觸發（2分鐘內）應走冪等返回', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-7',
      status: 'judgment_completed',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_completed',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a',
      room_id: 'room-7',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-7',
      room_id: 'room-7',
      case_id: 'case-7',
      created_at: new Date(Date.now() - 10_000),
      judgment: { id: 'judgment-7' },
    });

    const result = await service.requestJudgment('room-7', { userId: 'u1' });

    expect(result).toEqual({
      roomId: 'room-7',
      caseId: 'case-7',
      judgmentId: 'judgment-7',
      linkId: 'link-7',
      status: 'judgment_completed',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('createInvite: 匿名房主 canonical session 匹配時可建立邀請', async () => {
    const ownerSessionId = 'guest_1700000000000_abcdefghijklmnop';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: ownerSessionId });
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: ownerSessionId,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.chatInvite.create.mockResolvedValueOnce({
      id: 'inv-anon-owner',
      room_id: 'room-anon-owner',
      status: 'pending',
      invite_code: 'ANON123',
    });

    const invite = await service.createInvite(
      'room-anon-owner',
      { sessionId: ownerSessionId },
      { expiresInHours: 12 }
    );

    expect(invite.invite_code).toBe('ANON123');
  });

  it('createInvite: 匿名房主 canonical session 不匹配時應拒絕', async () => {
    const otherSessionId = 'guest_1700000000001_bcdefghijklmnop';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: otherSessionId });
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createInvite('room-anon-owner', { sessionId: otherSessionId }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(prismaMock.chatRoom.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'room-anon-owner',
          session_id: otherSessionId,
        }),
      })
    );
  });

  it('createInvite: 匿名 actor 缺少 session 時應拒絕', async () => {
    await expect(
      service.createInvite('room-anon-owner', {}, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'SESSION_ID_REQUIRED',
    });
  });

  it('createInvite: 房間已有 active roleB 應拒絕重複邀請', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-8',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        humanParticipant({ id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
      ],
    });

    await expect(
      service.createInvite('room-8', { userId: 'u1' }, { expiresInHours: 24 })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('createInvite: 發新邀請前應回收同房 pending 邀請', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-9',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 2 });
    prismaMock.chatInvite.create.mockResolvedValueOnce({
      id: 'inv-new',
      room_id: 'room-9',
      status: 'pending',
      invite_code: 'ABC999',
    });

    const invite = await service.createInvite('room-9', { userId: 'u1' }, { expiresInHours: 12 });

    expect(invite.id).toBe('inv-new');
    expect(prismaMock.chatInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          room_id: 'room-9',
          status: 'pending',
        }),
        data: expect.objectContaining({
          status: 'revoked',
        }),
      })
    );
  });

  it('createInvite: 同房間短時間重複邀請應被限流', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-invite-cooldown',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-recent',
      created_at: new Date(),
    });

    await expect(
      service.createInvite('room-invite-cooldown', { userId: 'u1' }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
    });
    expect(prismaMock.chatInvite.create).not.toHaveBeenCalled();
  });

  it('createInvite: B 方剛拒絕邀請後應禁止 A 立即再邀', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-declined-cooldown',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatInvite.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'inv-declined',
        responded_at: new Date(Date.now() - 60_000),
      });

    await expect(
      service.createInvite('room-declined-cooldown', { userId: 'u1' }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.chatInvite.create).not.toHaveBeenCalled();
  });

  it('createInvite: 房間狀態 CAS 失敗時應拒絕（避免競態）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-cas-invite',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true })],
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.createInvite('room-cas-invite', { userId: 'u1' }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('createInvite: 交易內若已出現 active roleB 應拒絕（避免併發誤邀請）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-tx-race',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true })],
    });
    prismaMock.chatParticipant.findFirst.mockResolvedValueOnce(humanParticipant({
      id: 'p-b',
      room_id: 'room-tx-race',
      role_in_room: 'roleB',
      is_active: true,
      user_id: 'u2',
    }));

    await expect(
      service.createInvite('room-tx-race', { userId: 'u1' }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('createInvite: 邀請碼唯一鍵衝突時應自動重試並成功', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-code-retry',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true })],
    });
    prismaMock.chatInvite.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValue({ count: 1 });
    const p2002Error = Object.assign(new Error('unique conflict'), { code: 'P2002' });
    prismaMock.chatInvite.create
      .mockRejectedValueOnce(p2002Error)
      .mockResolvedValueOnce({
        id: 'inv-code-retry',
        room_id: 'room-code-retry',
        status: 'pending',
        invite_code: 'ABC777',
      });

    const invite = await service.createInvite('room-code-retry', { userId: 'u1' }, { expiresInHours: 12 });
    expect(invite.id).toBe('inv-code-retry');
    expect(prismaMock.chatInvite.create).toHaveBeenCalledTimes(2);
  });

  it('requestJudgment: 同房間並發請求應共用 in-flight 任務（僅建一次案）', async () => {
    const room = {
      id: 'room-concurrent',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    };
    prismaMock.chatRoom.findFirst.mockResolvedValue(room);
    prismaMock.chatToCaseLink.findFirst.mockResolvedValue(null);
    prismaMock.chatMessage.count.mockResolvedValue(0);
    prismaMock.chatMessage.findMany.mockResolvedValue([
      {
        id: 'm-c1',
        content: '昨天我們又吵架，我希望有一個明確建議。',
        created_at: new Date('2026-02-26T12:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValue({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValue('其他衝突');
    prismaMock.pairing.create.mockResolvedValue({ id: 'pair-c' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-concurrent', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValue({ id: 'case-c' });
    prismaMock.chatToCaseLink.create.mockResolvedValue({ id: 'link-c' });
    judgmentServiceMock.generateJudgment.mockResolvedValue({ id: 'judgment-c' });
    prismaMock.chatToCaseLink.update.mockResolvedValue({ id: 'link-c', judgment_id: 'judgment-c' });

    const [r1, r2] = await Promise.all([
      service.requestJudgment('room-concurrent', { userId: 'u1' }),
      service.requestJudgment('room-concurrent', { userId: 'u1' }),
    ]);

    expect(r1.caseId).toBe('case-c');
    expect(r2.caseId).toBe('case-c');
    expect(prismaMock.case.create).toHaveBeenCalledTimes(1);
    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledTimes(1);
  });

  it('requestJudgment: in-flight 存在時未授權用戶不可搭車獲取結果', async () => {
    let resolveJudgment: ((value: { id: string }) => void) | undefined;
    const judgmentPromise = new Promise<{ id: string }>((resolve) => {
      resolveJudgment = resolve;
    });

    const roomForOwner = {
      id: 'room-race-auth',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    };

    prismaMock.chatRoom.findFirst.mockImplementation(async (args: any) => {
      const isOwnerQuery = Boolean(
        args?.where?.OR?.some?.((c: any) => c.owner_user_id === 'u1') ||
        args?.where?.owner_user_id === 'u1'
      );
      if (isOwnerQuery) return roomForOwner;
      return null;
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValue(null);
    prismaMock.chatMessage.count.mockResolvedValue(0);
    prismaMock.chatMessage.findMany.mockResolvedValue([
      {
        id: 'm-r1',
        content: '我希望重新判決',
        created_at: new Date('2026-02-26T12:30:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValue({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValue('其他衝突');
    prismaMock.pairing.create.mockResolvedValue({ id: 'pair-race-auth' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-race-auth', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValue({ id: 'case-race-auth' });
    prismaMock.chatToCaseLink.create.mockResolvedValue({ id: 'link-race-auth' });
    judgmentServiceMock.generateJudgment.mockReturnValue(judgmentPromise);
    prismaMock.chatToCaseLink.update.mockResolvedValue({ id: 'link-race-auth', judgment_id: 'judgment-race-auth' });

    const ownerRequest = service.requestJudgment('room-race-auth', { userId: 'u1' });
    const unauthorizedRequest = service.requestJudgment('room-race-auth', { userId: 'uX' });

    await expect(unauthorizedRequest).rejects.toMatchObject({ code: 'FORBIDDEN' });

    if (resolveJudgment) {
      resolveJudgment({ id: 'judgment-race-auth' });
    }
    const ownerResult = await ownerRequest;
    expect(ownerResult.caseId).toBe('case-race-auth');
  });

  it('requestJudgment: 鎖內若狀態已更新為 completed 應走冪等返回，避免重複建案', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-stale',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [humanParticipant({ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true })],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_completed',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a',
      room_id: 'room-stale',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-stale',
      room_id: 'room-stale',
      case_id: 'case-stale',
      created_at: new Date(Date.now() - 30_000),
      judgment: { id: 'judgment-stale' },
      case: { id: 'case-stale', status: 'completed' },
    });
    prismaMock.chatMessage.count.mockResolvedValueOnce(0);

    const result = await service.requestJudgment('room-stale', { userId: 'u1' });
    expect(result).toMatchObject({
      roomId: 'room-stale',
      caseId: 'case-stale',
      judgmentId: 'judgment-stale',
      linkId: 'link-stale',
      status: 'judgment_completed',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 鎖內若觸發者已失效應拒絕（避免排隊期間權限漂移）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-participant-stale',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [humanParticipant({ id: 'p-a-stale', role_in_room: 'roleA', user_id: 'u1', is_active: true })],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a-stale',
      room_id: 'room-participant-stale',
      role_in_room: 'roleA',
      is_active: false,
      user_id: 'u1',
      left_at: new Date('2026-07-12T00:00:00.000Z'),
    }));

    await expect(service.requestJudgment('room-participant-stale', { userId: 'u1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 鎖內若觸發者房間不匹配應拒絕（避免極端資料漂移越權）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-participant-room-mismatch',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [humanParticipant({ id: 'p-a-mismatch', role_in_room: 'roleA', user_id: 'u1', is_active: true })],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a-mismatch',
      room_id: 'room-other',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));

    await expect(service.requestJudgment('room-participant-room-mismatch', { userId: 'u1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 鎖內無 active participants 時應拒絕（避免使用鎖外舊快照）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-no-active',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [humanParticipant({ id: 'p-a-no-active', role_in_room: 'roleA', user_id: 'u1', is_active: true })],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a-no-active',
      room_id: 'room-no-active',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([]);

    await expect(service.requestJudgment('room-no-active', { userId: 'u1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 鎖內 participants 已更新時應採用新快照（含 roleB）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-participants-refresh',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a-old', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        aiParticipant({ id: 'p-ai-old', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'group_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a-old',
      room_id: 'room-participants-refresh',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a-new', room_id: 'room-participants-refresh', role_in_room: 'roleA', is_active: true, user_id: 'u1' }),
      humanParticipant({ id: 'p-b-new', room_id: 'room-participants-refresh', role_in_room: 'roleB', is_active: true, user_id: 'u2' }),
      aiParticipant({ id: 'p-ai-new', room_id: 'room-participants-refresh', role_in_room: 'aiMediator', is_active: true, user_id: null }),
    ]);
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-participants-refresh',
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a-new', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
        humanParticipant({ id: 'p-b-new', role_in_room: 'roleB', user_id: 'u2', is_active: true }),
        aiParticipant({ id: 'p-ai-new', role_in_room: 'aiMediator', user_id: null, is_active: true }),
      ],
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce(null);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-a',
        content: '我希望好好解決',
        created_at: new Date('2026-02-26T13:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
      {
        id: 'm-b',
        content: '我願意聽建議',
        created_at: new Date('2026-02-26T13:01:00.000Z'),
        sender_participant: { role_in_room: 'roleB' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.findFirst.mockResolvedValueOnce({
      id: 'pair-existing-u1-u2',
      status: 'active',
    });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-participants-refresh', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-participants-refresh' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-participants-refresh' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-participants-refresh' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({
      id: 'link-participants-refresh',
      judgment_id: 'judgment-participants-refresh',
    });
    chatAnalysisEvidenceServiceMock.claimSubmittedForProcessingInTransaction.mockResolvedValueOnce(submittedAnalysisEvidence({
      requiredParticipantIds: ['p-a-new', 'p-b-new'],
      approvalIds: ['approval-a', 'approval-b'],
      messages: [
        { id: 'm-a', content: '我希望好好解決', senderParticipantId: 'p-a-new', senderRole: 'roleA', createdAt: new Date('2026-02-26T13:00:00.000Z') },
        { id: 'm-b', content: '我願意聽建議', senderParticipantId: 'p-b-new', senderRole: 'roleB', createdAt: new Date('2026-02-26T13:01:00.000Z') },
      ],
    }));

    const result = await service.requestJudgment('room-participants-refresh', { userId: 'u1' }, {
      analysisRequestId: ANALYSIS_REQUEST_ID,
    });
    expect(result.caseId).toBe('case-participants-refresh');
    expect(prismaMock.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defendant_id: 'u2',
        }),
      })
    );
  });

  it('requestJudgment: 鎖內若存在多個 active roleA 應拒絕（避免角色歧義）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-rolea-duplicate',
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        humanParticipant({ id: 'p-a1', role_in_room: 'roleA', user_id: 'u1', is_active: true }),
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'group_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce(humanParticipant({
      id: 'p-a1',
      room_id: 'room-rolea-duplicate',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    }));
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      humanParticipant({ id: 'p-a1', room_id: 'room-rolea-duplicate', role_in_room: 'roleA', is_active: true, user_id: 'u1' }),
      humanParticipant({ id: 'p-a2', room_id: 'room-rolea-duplicate', role_in_room: 'roleA', is_active: true, user_id: 'u1' }),
      aiParticipant({ id: 'p-ai', room_id: 'room-rolea-duplicate', role_in_room: 'aiMediator', is_active: true, user_id: null }),
    ]);

    await expect(service.requestJudgment('room-rolea-duplicate', { userId: 'u1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('leaveRoom: 同一 transaction 取消未開始的 exact approvals 並 teardown open streams', async () => {
    const participantB = humanParticipant({
      id: 'p-b-leaving',
      room_id: 'room-leave',
      role_in_room: 'roleB',
      user_id: 'u-b',
      is_active: true,
    });
    const activeRoom = {
      id: 'room-leave',
      status: 'group_active',
      owner_user_id: 'u-a',
      participants: [participantB],
    };
    prismaMock.chatRoom.findFirst
      .mockResolvedValueOnce(activeRoom)
      .mockResolvedValueOnce(activeRoom);
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      id: 'room-leave',
      status: 'solo_active',
      participants: [{ ...participantB, is_active: false, left_at: new Date() }],
    });

    const result = await service.leaveRoom('room-leave', { userId: 'u-b' });

    expect(result).toMatchObject({ id: 'room-leave', status: 'solo_active' });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0])
      .toBeLessThan(prismaMock.chatParticipant.updateMany.mock.invocationCallOrder[0]);
    expect(prismaMock.chatParticipant.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        room_id: 'room-leave',
        participant_type: 'user',
        role_in_room: { in: ['roleA', 'roleB'] },
        is_active: true,
        left_at: null,
      },
      data: SHARED_ADAPTATION_RESET,
    });
    expect(chatAnalysisRequestServiceMock.cancelActiveForParticipantDeparture)
      .toHaveBeenCalledWith(
        prismaMock,
        'room-leave',
        'p-b-leaving',
        expect.any(Date),
      );
    expect(chatStreamEntitlementServiceMock.revokeParticipant)
      .toHaveBeenCalledWith('p-b-leaving');
  });

  it('kickParticipantB: membership 變更應重設其餘 active humans 的 adaptation consent', async () => {
    const participantA = humanParticipant({
      id: 'p-a-kicking',
      room_id: 'room-kick',
      role_in_room: 'roleA',
      user_id: 'u-a',
      is_active: true,
    });
    const participantB = humanParticipant({
      id: 'p-b-kicked',
      room_id: 'room-kick',
      role_in_room: 'roleB',
      user_id: 'u-b',
      is_active: true,
    });
    const activeRoom = {
      id: 'room-kick',
      status: 'group_active',
      owner_user_id: 'u-a',
      participants: [participantA, participantB],
    };
    prismaMock.chatRoom.findFirst
      .mockResolvedValueOnce(activeRoom)
      .mockResolvedValueOnce(activeRoom);
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      id: 'room-kick',
      status: 'solo_active',
      participants: [participantA, { ...participantB, is_active: false, left_at: new Date() }],
    });

    const result = await service.kickParticipantB('room-kick', { userId: 'u-a' });

    expect(result).toMatchObject({ id: 'room-kick', status: 'solo_active' });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0])
      .toBeLessThan(prismaMock.chatParticipant.updateMany.mock.invocationCallOrder[0]);
    expect(prismaMock.chatParticipant.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        room_id: 'room-kick',
        participant_type: 'user',
        role_in_room: { in: ['roleA', 'roleB'] },
        is_active: true,
        left_at: null,
      },
      data: SHARED_ADAPTATION_RESET,
    });
    expect(chatAnalysisRequestServiceMock.cancelActiveForParticipantDeparture)
      .toHaveBeenCalledWith(
        prismaMock,
        'room-kick',
        'p-b-kicked',
        expect.any(Date),
      );
    expect(chatStreamEntitlementServiceMock.revokeParticipant)
      .toHaveBeenCalledWith('p-b-kicked');
  });

  it('kickParticipantB: 鎖內發起方權限已失效時不得寫入 membership', async () => {
    const participantA = humanParticipant({
      id: 'p-a-stale',
      room_id: 'room-kick-stale',
      role_in_room: 'roleA',
      user_id: 'u-a',
      is_active: true,
    });
    const participantB = humanParticipant({
      id: 'p-b-stale',
      room_id: 'room-kick-stale',
      role_in_room: 'roleB',
      user_id: 'u-b',
      is_active: true,
    });
    prismaMock.chatRoom.findFirst
      .mockResolvedValueOnce({
        id: 'room-kick-stale',
        status: 'group_active',
        owner_user_id: 'u-a',
        participants: [participantA, participantB],
      })
      .mockResolvedValueOnce({
        id: 'room-kick-stale',
        status: 'group_active',
        owner_user_id: 'u-a',
        participants: [{ ...participantA, is_active: false, left_at: new Date() }, participantB],
      });

    await expect(service.kickParticipantB('room-kick-stale', { userId: 'u-a' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.chatParticipant.updateMany).not.toHaveBeenCalled();
    expect(chatStreamEntitlementServiceMock.revokeParticipant).not.toHaveBeenCalled();
  });
});
