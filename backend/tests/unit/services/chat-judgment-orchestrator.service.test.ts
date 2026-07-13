const prismaMock = {
  chatRoom: {
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  chatMessage: { findMany: jest.fn() },
  case: { create: jest.fn(), update: jest.fn() },
  pairing: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  chatToCaseLink: { create: jest.fn(), update: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};
const judgmentServiceMock = { generateJudgment: jest.fn() };
const safetyRouterMock = { assertFormalAnalysisAllowed: jest.fn() };
const actorAccessMock = {
  ensureActor: jest.fn(),
  getAccessibleRoom: jest.fn(),
  getCurrentParticipant: jest.fn(),
  lockActiveHumanParticipants: jest.fn(),
};
const lockServiceMock = { withLock: jest.fn() };
const aiServiceMock = { detectCaseType: jest.fn() };
const chatMetricsServiceMock = {
  recordJudgmentSuccess: jest.fn(),
  recordJudgmentFailed: jest.fn(),
};
const evidenceServiceMock = {
  markCompleted: jest.fn(),
  claimCaseGenerationInTransaction: jest.fn(),
  claimSubmittedForProcessingInTransaction: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/services/judgment.service', () => ({
  judgmentService: judgmentServiceMock,
}));
jest.mock('../../../src/services/chat-safety-router.service', () => ({
  chatSafetyRouterService: safetyRouterMock,
}));
jest.mock('../../../src/services/chat-actor-access.service', () => ({
  chatActorAccessService: actorAccessMock,
}));
jest.mock('../../../src/utils/lock', () => ({
  lockService: lockServiceMock,
}));
jest.mock('../../../src/services/ai.service', () => ({
  CRISIS_SIGNAL_REGEX: /自傷|自殺/,
  IPV_SIGNAL_REGEX: /控制|威脅|暴力/,
  aiService: aiServiceMock,
}));
jest.mock('../../../src/services/chat-metrics.service', () => ({
  chatMetricsService: chatMetricsServiceMock,
}));
jest.mock('../../../src/services/chat-analysis-evidence.service', () => ({
  chatAnalysisEvidenceService: evidenceServiceMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { ChatJudgmentOrchestrator } from '../../../src/services/chat-judgment-orchestrator.service';

type JudgmentLifecycleAccess = {
  claimFormalAnalysisProviderUseInTransaction(
    tx: typeof prismaMock,
    roomId: string,
  ): Promise<void>;
  finalizeJudgment(input: {
    roomId: string;
    caseId: string;
    linkId: string;
    evidence: {
      requestId: string;
      selectionHash: string;
      policyVersion: string;
      requiredParticipantIds: string[];
      approvalIds: string[];
      messages: never[];
      capsules: never[];
    } | null;
    actor: { userId?: string; sessionId?: string };
    locale?: 'en-US' | 'zh-TW';
  }): Promise<string | undefined>;
  markJudgmentFailed(
    roomId: string,
    options?: { onlyIfRequested?: boolean },
  ): Promise<void>;
  retryExistingJudgment(input: {
    room: { id: string };
    link: {
      id: string;
      case_id: string;
      conversion_snapshot: null;
    };
    actor: { userId: string };
  }): Promise<unknown>;
  ensurePairingForRoom(
    room: unknown,
    roleBUserId?: string | null,
    client?: typeof prismaMock,
  ): Promise<string>;
  createNewJudgment(input: {
    room: {
      id: string;
      owner_user_id: string | null;
      session_id: string | null;
    };
    participant: {
      id: string;
      role_in_room: string;
      user_id: string | null;
    };
    participants: Array<{
      id: string;
      role_in_room: string;
      user_id: string | null;
    }>;
    actor: { userId: string };
  }): Promise<unknown>;
  recordRouteSafetyAssessmentBestEffort(input: unknown): Promise<void>;
};

describe('ChatJudgmentOrchestrator lifecycle', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async callback => callback(prismaMock));
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-1' });
    prismaMock.chatRoom.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.chatMessage.findMany.mockResolvedValue([]);
    prismaMock.chatToCaseLink.update.mockResolvedValue({ id: 'link-1' });
    prismaMock.pairing.findFirst.mockResolvedValue(null);
    prismaMock.$queryRaw.mockResolvedValue([]);
    evidenceServiceMock.markCompleted.mockResolvedValue(undefined);
    safetyRouterMock.assertFormalAnalysisAllowed.mockResolvedValue(undefined);
    actorAccessMock.ensureActor.mockImplementation(async actor => actor);
    const roleA = {
      id: 'participant-a',
      room_id: 'room-1',
      participant_type: 'user',
      role_in_room: 'roleA',
      user_id: 'user-a',
      is_active: true,
      left_at: null,
    };
    actorAccessMock.getAccessibleRoom.mockResolvedValue({
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'user-a',
      session_id: null,
      history_visibility_mode: 'share_from_join_time',
      participants: [roleA],
    });
    actorAccessMock.getCurrentParticipant.mockReturnValue(roleA);
    actorAccessMock.lockActiveHumanParticipants.mockResolvedValue(undefined);
    aiServiceMock.detectCaseType.mockResolvedValue('其他衝突');
    chatMetricsServiceMock.recordJudgmentSuccess.mockResolvedValue(undefined);
    chatMetricsServiceMock.recordJudgmentFailed.mockResolvedValue(undefined);
  });

  it('directly uses one finalize boundary for judgment, room, link and exact evidence', async () => {
    judgmentServiceMock.generateJudgment.mockResolvedValue({ id: 'judgment-1' });
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;
    const evidence = {
      requestId: 'request-1',
      selectionHash: 'selection-hash',
      policyVersion: 'policy-v1',
      requiredParticipantIds: ['participant-a'],
      approvalIds: ['approval-a'],
      messages: [] as never[],
      capsules: [] as never[],
    };

    await expect(service.finalizeJudgment({
      roomId: 'room-1',
      caseId: 'case-1',
      linkId: 'link-1',
      evidence,
      actor: { userId: 'user-a' },
      locale: 'en-US',
    })).resolves.toBe('judgment-1');

    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledWith('case-1', {
      userId: 'user-a',
      sessionId: undefined,
      locale: 'en-US',
      expectedChatAnalysisRequestId: 'request-1',
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.chatRoom.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: { status: 'judgment_completed' },
    });
    expect(prismaMock.chatToCaseLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { judgment_id: 'judgment-1' },
    });
    expect(evidenceServiceMock.markCompleted).toHaveBeenCalledWith('request-1', prismaMock);
  });

  it('directly keeps recovery failure transition conditional on requested state', async () => {
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await service.markJudgmentFailed('room-1', { onlyIfRequested: true });

    expect(prismaMock.chatRoom.updateMany).toHaveBeenCalledWith({
      where: { id: 'room-1', status: 'judgment_requested' },
      data: { status: 'judgment_failed' },
    });
    expect(prismaMock.chatRoom.update).not.toHaveBeenCalled();
  });

  it('claims formal provider use behind participant locks and transaction-scoped safety state', async () => {
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await service.claimFormalAnalysisProviderUseInTransaction(prismaMock, 'room-1');

    expect(actorAccessMock.lockActiveHumanParticipants).toHaveBeenCalledWith(
      prismaMock,
      'room-1',
    );
    expect(safetyRouterMock.assertFormalAnalysisAllowed).toHaveBeenCalledWith(
      'room-1',
      prismaMock,
    );
    expect(actorAccessMock.lockActiveHumanParticipants.mock.invocationCallOrder[0]).toBeLessThan(
      safetyRouterMock.assertFormalAnalysisAllowed.mock.invocationCallOrder[0],
    );
  });

  it('rechecks transaction-scoped safety before a retry consumes evidence or reaches the provider', async () => {
    safetyRouterMock.assertFormalAnalysisAllowed.mockRejectedValueOnce(
      Object.assign(new Error('共同梳理目前暫停'), { code: 'CASE_NOT_READY' }),
    );
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await expect(service.retryExistingJudgment({
      room: { id: 'room-1' },
      link: { id: 'link-1', case_id: 'case-1', conversion_snapshot: null },
      actor: { userId: 'user-a' },
    })).rejects.toMatchObject({ code: 'CASE_NOT_READY' });

    expect(safetyRouterMock.assertFormalAnalysisAllowed).toHaveBeenCalledWith(
      'room-1',
      prismaMock,
    );
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'ReadCommitted' },
    );
    expect(evidenceServiceMock.claimCaseGenerationInTransaction).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('uses ReadCommitted for a new formal-analysis claim transaction', async () => {
    safetyRouterMock.assertFormalAnalysisAllowed.mockRejectedValueOnce(
      Object.assign(new Error('共同梳理目前暫停'), { code: 'CASE_NOT_READY' }),
    );
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;
    const ensurePairingSpy = jest
      .spyOn(service, 'ensurePairingForRoom')
      .mockResolvedValue('pairing-1');
    const roleA = {
      id: 'participant-a',
      role_in_room: 'roleA',
      user_id: 'user-a',
    };

    await expect(service.createNewJudgment({
      room: {
        id: 'room-1',
        owner_user_id: 'user-a',
        session_id: null,
      },
      participant: roleA,
      participants: [roleA],
      actor: { userId: 'user-a' },
    })).rejects.toMatchObject({ code: 'CASE_NOT_READY' });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'ReadCommitted' },
    );
    expect(safetyRouterMock.assertFormalAnalysisAllowed).toHaveBeenCalledWith(
      'room-1',
      prismaMock,
    );
    expect(ensurePairingSpy).not.toHaveBeenCalled();
    expect(prismaMock.pairing.create).not.toHaveBeenCalled();
    expect(prismaMock.pairing.update).not.toHaveBeenCalled();
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(prismaMock.chatToCaseLink.create).not.toHaveBeenCalled();
    expect(evidenceServiceMock.claimSubmittedForProcessingInTransaction).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('revalidates the triggering role after the ordered participant lock', async () => {
    actorAccessMock.getCurrentParticipant.mockReturnValueOnce(null);
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;
    const roleA = {
      id: 'participant-a',
      role_in_room: 'roleA',
      user_id: 'user-a',
    };

    await expect(service.createNewJudgment({
      room: {
        id: 'room-1',
        owner_user_id: 'user-a',
        session_id: null,
      },
      participant: roleA,
      participants: [roleA],
      actor: { userId: 'user-a' },
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(actorAccessMock.lockActiveHumanParticipants.mock.invocationCallOrder[0])
      .toBeLessThan(actorAccessMock.getAccessibleRoom.mock.invocationCallOrder[0]);
    expect(prismaMock.pairing.create).not.toHaveBeenCalled();
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(prismaMock.chatToCaseLink.create).not.toHaveBeenCalled();
  });

  it('uses the post-lock participant snapshot when roleB has already left', async () => {
    const roleA = {
      id: 'participant-a',
      role_in_room: 'roleA',
      user_id: 'user-a',
    };
    const staleRoleB = {
      id: 'participant-b',
      role_in_room: 'roleB',
      user_id: 'user-b',
    };
    prismaMock.chatMessage.findMany.mockResolvedValue([{
      id: 'message-1',
      content: '我想先整理自己的想法和下一步',
      created_at: new Date('2026-07-13T12:00:00.000Z'),
      sender_participant: roleA,
    }]);
    prismaMock.pairing.findFirst.mockResolvedValue({ id: 'pairing-owner' });
    prismaMock.case.create.mockResolvedValue({ id: 'case-1' });
    prismaMock.chatToCaseLink.create.mockResolvedValue({ id: 'link-1' });
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;
    jest.spyOn(service, 'finalizeJudgment').mockResolvedValue('judgment-1');
    jest.spyOn(service, 'recordRouteSafetyAssessmentBestEffort').mockResolvedValue(undefined);

    await expect(service.createNewJudgment({
      room: {
        id: 'room-1',
        owner_user_id: 'user-a',
        session_id: null,
        status: 'group_active',
        history_visibility_mode: 'share_from_join_time',
      } as never,
      participant: roleA,
      participants: [roleA, staleRoleB],
      actor: { userId: 'user-a' },
    })).resolves.toMatchObject({ caseId: 'case-1' });

    expect(prismaMock.case.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pairing_id: 'pairing-owner',
        plaintiff_id: 'user-a',
        defendant_id: null,
      }),
    }));
  });

  it('upgrades the Chat owner-only pending pairing instead of creating a conflicting second row', async () => {
    prismaMock.pairing.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'pairing-pending',
        user1_id: 'user-a',
        user2_id: null,
        invite_code: null,
        status: 'pending',
      });
    prismaMock.pairing.update.mockResolvedValue({ id: 'pairing-pending' });
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await expect(service.ensurePairingForRoom({
      id: 'room-1',
      owner_user_id: 'user-a',
      session_id: null,
    }, 'user-b', prismaMock)).resolves.toBe('pairing-pending');

    expect(prismaMock.pairing.update).toHaveBeenCalledWith({
      where: { id: 'pairing-pending' },
      data: {
        status: 'active',
        user2_id: 'user-b',
        confirmed_at: expect.any(Date),
        cancelled_at: null,
        expires_at: null,
      },
    });
    expect(prismaMock.pairing.create).not.toHaveBeenCalled();
  });

  it('reopens a swapped historical pairing without rewriting participant orientation', async () => {
    prismaMock.pairing.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'pairing-history',
        user1_id: 'user-b',
        user2_id: 'user-a',
        status: 'cancelled',
      });
    prismaMock.pairing.update.mockResolvedValue({ id: 'pairing-history' });
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await expect(service.ensurePairingForRoom({
      id: 'room-1',
      owner_user_id: 'user-a',
      session_id: null,
    }, 'user-b', prismaMock)).resolves.toBe('pairing-history');

    expect(prismaMock.pairing.update).toHaveBeenCalledWith({
      where: { id: 'pairing-history' },
      data: {
        status: 'active',
        confirmed_at: expect.any(Date),
        cancelled_at: null,
        expires_at: null,
      },
    });
  });

  it('fails closed when the Chat owner already has an unrelated live pairing', async () => {
    prismaMock.pairing.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'pairing-other',
        user1_id: 'user-a',
        user2_id: 'user-c',
        invite_code: null,
        status: 'active',
      });
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await expect(service.ensurePairingForRoom({
      id: 'room-1',
      owner_user_id: 'user-a',
      session_id: null,
    }, 'user-b', prismaMock)).rejects.toMatchObject({ code: 'ALREADY_PAIRED' });

    expect(prismaMock.pairing.update).not.toHaveBeenCalled();
    expect(prismaMock.pairing.create).not.toHaveBeenCalled();
  });

  it('retries the whole prepared transaction once when the normal pairing trigger reports P2002', async () => {
    const roleA = {
      id: 'participant-a',
      role_in_room: 'roleA',
      user_id: 'user-a',
    };
    prismaMock.chatMessage.findMany.mockResolvedValue([{
      id: 'message-1',
      content: '我想和對方好好溝通並找到可行下一步',
      created_at: new Date('2026-07-13T12:00:00.000Z'),
      sender_participant: roleA,
    }]);
    prismaMock.pairing.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'pairing-winner' });
    prismaMock.pairing.create.mockRejectedValueOnce(
      Object.assign(new Error('normal pairing race'), { code: 'P2002' }),
    );
    prismaMock.case.create.mockResolvedValue({ id: 'case-1' });
    prismaMock.chatToCaseLink.create.mockResolvedValue({ id: 'link-1' });
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;
    jest.spyOn(service, 'finalizeJudgment').mockResolvedValue('judgment-1');
    jest.spyOn(service, 'recordRouteSafetyAssessmentBestEffort').mockResolvedValue(undefined);

    await expect(service.createNewJudgment({
      room: {
        id: 'room-1',
        owner_user_id: 'user-a',
        session_id: null,
        status: 'group_active',
        history_visibility_mode: 'share_from_join_time',
      } as never,
      participant: roleA,
      participants: [roleA],
      actor: { userId: 'user-a' },
    })).resolves.toMatchObject({
      caseId: 'case-1',
      linkId: 'link-1',
      judgmentId: 'judgment-1',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(safetyRouterMock.assertFormalAnalysisAllowed).toHaveBeenCalledTimes(2);
    expect(prismaMock.pairing.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.case.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.chatToCaseLink.create).toHaveBeenCalledTimes(1);
    expect(safetyRouterMock.assertFormalAnalysisAllowed.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.pairing.create.mock.invocationCallOrder[0],
    );
    expect(prismaMock.pairing.create.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.case.create.mock.invocationCallOrder[0],
    );
  });

  it('does not retry a P2002 raised outside normal pairing resolution', async () => {
    const roleA = {
      id: 'participant-a',
      role_in_room: 'roleA',
      user_id: 'user-a',
    };
    prismaMock.chatMessage.findMany.mockRejectedValueOnce(
      Object.assign(new Error('unrelated unique conflict'), { code: 'P2002' }),
    );
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await expect(service.createNewJudgment({
      room: {
        id: 'room-1',
        owner_user_id: 'user-a',
        session_id: null,
        status: 'group_active',
        history_visibility_mode: 'share_from_join_time',
      } as never,
      participant: roleA,
      participants: [roleA],
      actor: { userId: 'user-a' },
    })).rejects.toMatchObject({ code: 'P2002' });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.pairing.create).not.toHaveBeenCalled();
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(prismaMock.chatToCaseLink.create).not.toHaveBeenCalled();
  });

  it('directly retries Chat state finalization once after Judgment persistence', async () => {
    judgmentServiceMock.generateJudgment.mockResolvedValue({ id: 'judgment-retry-finalize' });
    prismaMock.$transaction
      .mockRejectedValueOnce(new Error('outer transaction unavailable'))
      .mockImplementationOnce(async callback => callback(prismaMock));
    const service = new ChatJudgmentOrchestrator() as unknown as JudgmentLifecycleAccess;

    await expect(service.finalizeJudgment({
      roomId: 'room-1',
      caseId: 'case-1',
      linkId: 'link-1',
      evidence: null,
      actor: { userId: 'user-a' },
    })).resolves.toBe('judgment-retry-finalize');

    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.chatRoom.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: { status: 'judgment_completed' },
    });
    expect(prismaMock.chatToCaseLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { judgment_id: 'judgment-retry-finalize' },
    });
  });

  it('fails closed on durable safety state before opening the judgment lock', async () => {
    safetyRouterMock.assertFormalAnalysisAllowed.mockRejectedValueOnce(
      Object.assign(new Error('共同梳理目前暫停'), { code: 'CASE_NOT_READY' }),
    );

    await expect(new ChatJudgmentOrchestrator().requestJudgment(
      'room-1',
      { userId: 'user-a' },
    )).rejects.toMatchObject({ code: 'CASE_NOT_READY' });

    expect(safetyRouterMock.assertFormalAnalysisAllowed).toHaveBeenCalledWith('room-1');
    expect(lockServiceMock.withLock).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });
});
