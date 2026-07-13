const mockPrisma = {
  chatRoom: { findUnique: jest.fn() },
  chatParticipant: { findFirst: jest.fn() },
  chatMessage: { findMany: jest.fn() },
  contextCapsule: { findMany: jest.fn() },
  contextUseAudit: { create: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

const mockExtractOwnerControls = jest.fn();
const mockSafetyRouter = {
  assertSharedMessagingAllowed: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  ChatChannelKind: { shared: 'shared', private: 'private' },
  ChatHistoryVisibilityMode: {
    share_full_history: 'share_full_history',
    share_summary_only: 'share_summary_only',
    share_from_join_time: 'share_from_join_time',
  },
  ChatMessageType: {
    user_text: 'user_text',
    ai_reflection: 'ai_reflection',
    ai_mediation: 'ai_mediation',
    ai_summary: 'ai_summary',
    system_event: 'system_event',
    safety_notice: 'safety_notice',
  },
  ChatRoleInRoom: {
    roleA: 'roleA',
    roleB: 'roleB',
    aiMediator: 'aiMediator',
    system: 'system',
  },
  ChatVisibilityScope: {
    all: 'all',
    owner_only: 'owner_only',
    summary_only: 'summary_only',
  },
  ContextAudience: {
    private_owner: 'private_owner',
    room_participants: 'room_participants',
  },
  ContextPurpose: {
    private_support: 'private_support',
    shared_mediation: 'shared_mediation',
    shared_mediation_adaptation: 'shared_mediation_adaptation',
  },
  ContextTargetType: { chat_room: 'chat_room' },
  ContextUseDecision: { allowed: 'allowed', denied: 'denied' },
  PrivateContextUseMode: {
    private_only: 'private_only',
    shared_process_controls: 'shared_process_controls',
  },
  SharedAdaptationConsentDecision: {
    not_set: 'not_set',
    accepted: 'accepted',
    declined: 'declined',
  },
  Prisma: {},
}));

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/services/mediation-strategy.service', () => ({
  mediationStrategyService: {
    extractOwnerControlsWithOutcome: (...args: unknown[]) => mockExtractOwnerControls(...args),
  },
}));

jest.mock('../../../src/services/chat-safety-router.service', () => ({
  chatSafetyRouterService: mockSafetyRouter,
}));

import { ChatContextPolicyService } from '../../../src/services/chat-context-policy.service';
import {
  CHAT_ADAPTATION_POLICY_VERSION,
  CHAT_CONTEXT_POLICY_VERSION,
} from '../../../src/utils/chat-context-validation';

const ROOM_ID = 'room-1';
const PARTICIPANT_A = 'participant-a';
const PARTICIPANT_B = 'participant-b';
const FUTURE = new Date('2099-01-01T00:00:00.000Z');
const PAST = new Date('2000-01-01T00:00:00.000Z');

function participant(
  id: string,
  role: 'roleA' | 'roleB',
  mode: 'private_only' | 'shared_process_controls',
  adaptation: 'not_set' | 'accepted' | 'declined' = 'not_set',
) {
  return {
    id,
    role_in_room: role,
    participant_type: 'user',
    is_active: true,
    left_at: null,
    joined_at: new Date('2026-07-12T12:00:00.000Z'),
    private_context_use_mode: mode,
    private_context_policy_version: mode === 'shared_process_controls'
      ? CHAT_ADAPTATION_POLICY_VERSION
      : null,
    private_context_preference_updated_at: mode === 'shared_process_controls'
      ? new Date('2026-07-13T19:00:00.000Z')
      : null,
    shared_adaptation_consent: adaptation,
    shared_adaptation_policy_version: adaptation === 'not_set'
      ? null
      : CHAT_ADAPTATION_POLICY_VERSION,
    shared_adaptation_decided_at: adaptation === 'not_set'
      ? null
      : new Date('2026-07-13T19:00:00.000Z'),
  };
}

function room(participants: ReturnType<typeof participant>[]) {
  return {
    id: ROOM_ID,
    history_visibility_mode: 'share_full_history',
    participants,
  };
}

function sharedMessage() {
  return {
    id: 'shared-message',
    content: 'shared text',
    message_type: 'user_text',
    visibility_scope: 'all',
    ai_context_eligible: true,
    created_at: new Date('2026-07-12T12:30:00.000Z'),
    sender_participant: {
      role_in_room: 'roleA',
      is_active: true,
    },
  };
}

function authorization(id: string, contentHash: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    subject_participant_id: PARTICIPANT_A,
    purpose: 'shared_mediation',
    audience: 'room_participants',
    target_type: 'chat_room',
    target_id: ROOM_ID,
    capsule_content_hash: contentHash,
    policy_version: CHAT_CONTEXT_POLICY_VERSION,
    expires_at: FUTURE,
    revoked_at: null,
    ...overrides,
  };
}

function capsule(
  id: string,
  contentHash: string,
  authorizations: ReturnType<typeof authorization>[],
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    room_id: ROOM_ID,
    owner_participant_id: PARTICIPANT_A,
    summary: `summary-${id}`,
    content_hash: contentHash,
    policy_version: CHAT_CONTEXT_POLICY_VERSION,
    status: 'approved',
    expires_at: FUTURE,
    revoked_at: null,
    authorizations,
    ...overrides,
  };
}

describe('ChatContextPolicyService privacy firewall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSafetyRouter.assertSharedMessagingAllowed.mockResolvedValue(undefined);
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => (
      (callback as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma)
    ));
    mockPrisma.contextUseAudit.create.mockResolvedValue({ id: 'audit-1' });
    mockPrisma.contextCapsule.findMany.mockResolvedValue([]);
    mockExtractOwnerControls.mockResolvedValue({ controls: null, outcome: 'no_source' });
  });

  it('任一 active participant 未接受 adaptation mode 時不查詢 private raw', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue(
      room([
        participant(PARTICIPANT_A, 'roleA', 'shared_process_controls', 'accepted'),
        participant(PARTICIPANT_B, 'roleB', 'private_only'),
      ])
    );
    mockPrisma.chatMessage.findMany.mockResolvedValue([sharedMessage()]);

    const service = new ChatContextPolicyService();
    const bundle = await service.resolveSharedMediation({
      roomId: ROOM_ID,
    });

    expect(bundle.controls).toBeNull();
    expect(bundle.messages.map(message => message.id)).toEqual(['shared-message']);
    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockPrisma.chatMessage.findMany.mock.calls)).not.toMatch(
      /owner_only|summary_only|owned_channels|private_context_use_mode/
    );
    expect(mockExtractOwnerControls).not.toHaveBeenCalled();
  });

  it('全員接受後只逐 owner 編譯，並以 deterministic controls 回傳', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue(
      room([
        participant(PARTICIPANT_A, 'roleA', 'shared_process_controls', 'accepted'),
        participant(PARTICIPANT_B, 'roleB', 'private_only', 'accepted'),
      ])
    );
    mockPrisma.chatMessage.findMany
      .mockResolvedValueOnce([sharedMessage()])
      .mockResolvedValueOnce([
        { id: 'private-a-1', content: 'PRIVATE-A-CANARY' },
      ]);
    mockExtractOwnerControls.mockResolvedValue({
      controls: {
        pace: 'slower',
        ask_permission_before_depth: true,
        offer_pause: true,
        question_style: 'gentle',
        max_questions: 1,
      },
      outcome: 'emitted',
    });

    const bundle = await new ChatContextPolicyService().resolveSharedMediation({
      roomId: ROOM_ID,
    });

    expect(mockExtractOwnerControls).toHaveBeenCalledTimes(1);
    expect(mockExtractOwnerControls).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      ownerParticipantId: PARTICIPANT_A,
      messages: ['PRIVATE-A-CANARY'],
    });
    expect(bundle.controls).toEqual({
      pace: 'slower',
      ask_permission_before_depth: true,
      offer_pause: true,
      question_style: 'gentle',
      max_questions: 1,
    });
    expect(JSON.stringify(mockPrisma.contextUseAudit.create.mock.calls)).not.toContain(
      'PRIVATE-A-CANARY'
    );
  });

  it('owner consent 在 private provider claim 前被撤回時 provider invocation 為零', async () => {
    const acceptedRoom = room([
      participant(PARTICIPANT_A, 'roleA', 'shared_process_controls', 'accepted'),
      participant(PARTICIPANT_B, 'roleB', 'private_only', 'accepted'),
    ]);
    const revokedRoom = room([
      participant(PARTICIPANT_A, 'roleA', 'private_only', 'accepted'),
      participant(PARTICIPANT_B, 'roleB', 'private_only', 'accepted'),
    ]);
    mockPrisma.chatRoom.findUnique
      .mockResolvedValueOnce(acceptedRoom)
      .mockResolvedValueOnce(revokedRoom);
    mockPrisma.chatMessage.findMany
      .mockResolvedValueOnce([sharedMessage()])
      .mockResolvedValueOnce([{ id: 'private-a-1', content: 'PRIVATE-A-CANARY' }]);

    const bundle = await new ChatContextPolicyService().resolveSharedMediation({
      roomId: ROOM_ID,
    });

    expect(bundle.controls).toBeNull();
    expect(mockExtractOwnerControls).not.toHaveBeenCalled();
    expect(JSON.stringify(mockPrisma.contextUseAudit.create.mock.calls)).not.toContain(
      'owner_strategy_compilation_requested'
    );
  });

  it('private Safety 在 owner compiler claim 前生效時 provider invocation 為零', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue(
      room([
        participant(PARTICIPANT_A, 'roleA', 'shared_process_controls', 'accepted'),
        participant(PARTICIPANT_B, 'roleB', 'private_only', 'accepted'),
      ])
    );
    mockPrisma.chatMessage.findMany
      .mockResolvedValueOnce([sharedMessage()])
      .mockResolvedValueOnce([{ id: 'private-a-1', content: 'PRIVATE-A-CANARY' }]);
    mockSafetyRouter.assertSharedMessagingAllowed.mockRejectedValueOnce(Object.assign(
      new Error('共同對話目前暫停'),
      { code: 'CASE_NOT_EDITABLE' },
    ));

    await expect(new ChatContextPolicyService().resolveSharedMediation({
      roomId: ROOM_ID,
    })).rejects.toMatchObject({ code: 'CASE_NOT_EDITABLE' });

    expect(mockExtractOwnerControls).not.toHaveBeenCalled();
    expect(JSON.stringify(mockPrisma.contextUseAudit.create.mock.calls)).not.toContain(
      'owner_strategy_compilation_requested'
    );
  });

  it('consent 在 owner compiler 後改變時捨棄 controls，不把 stale strategy 交給 Shared Mediator', async () => {
    const acceptedRoom = room([
      participant(PARTICIPANT_A, 'roleA', 'shared_process_controls', 'accepted'),
      participant(PARTICIPANT_B, 'roleB', 'private_only', 'accepted'),
    ]);
    const resetRoom = room([
      participant(PARTICIPANT_A, 'roleA', 'shared_process_controls', 'not_set'),
      participant(PARTICIPANT_B, 'roleB', 'private_only', 'not_set'),
    ]);
    mockPrisma.chatRoom.findUnique
      .mockResolvedValueOnce(acceptedRoom)
      .mockResolvedValueOnce(acceptedRoom)
      .mockResolvedValueOnce(resetRoom);
    mockPrisma.chatMessage.findMany
      .mockResolvedValueOnce([sharedMessage()])
      .mockResolvedValueOnce([{ id: 'private-a-1', content: 'PRIVATE-A-CANARY' }]);
    mockExtractOwnerControls.mockResolvedValue({
      controls: {
        pace: 'slower',
        ask_permission_before_depth: true,
        offer_pause: true,
        question_style: 'gentle',
        max_questions: 1,
      },
      outcome: 'emitted',
    });

    const bundle = await new ChatContextPolicyService().resolveSharedMediation({
      roomId: ROOM_ID,
    });

    expect(mockExtractOwnerControls).toHaveBeenCalledTimes(1);
    expect(bundle.controls).toBeNull();
    expect(JSON.stringify(mockPrisma.contextUseAudit.create.mock.calls)).not.toContain(
      'owner_strategy_controls_merged'
    );
  });

  it('formal delivery resolver 即使 legacy opt-in 存在也只回傳 disabled controls', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue({ id: ROOM_ID });

    const result = await new ChatContextPolicyService().resolveFormalAnalysisDelivery(ROOM_ID);

    expect(result).toEqual({
      controls: null,
      policyVersion: CHAT_CONTEXT_POLICY_VERSION,
    });
    expect(mockPrisma.chatRoom.findUnique).toHaveBeenCalledWith({
      where: { id: ROOM_ID },
      select: { id: true },
    });
    expect(mockPrisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it('Private Analyst 保留 owner-scoped private support context', async () => {
    mockPrisma.chatParticipant.findFirst.mockResolvedValue({
      ...participant(PARTICIPANT_A, 'roleA', 'private_only'),
      room: { history_visibility_mode: 'share_full_history' },
    });
    mockPrisma.chatMessage.findMany.mockResolvedValue([{
      id: 'private-owner-message',
      content: 'OWNER-PRIVATE-CONTEXT',
      message_type: 'user_text',
      created_at: new Date('2026-07-12T12:30:00.000Z'),
      visibility_scope: 'owner_only',
      sender_participant: { role_in_room: 'roleA' },
      channel: { kind: 'private' },
    }]);

    const result = await new ChatContextPolicyService().resolvePrivateSupport({
      roomId: ROOM_ID,
      privateChannelId: 'private-channel-a',
      ownerParticipantId: PARTICIPANT_A,
    });

    expect(result.audience).toBe('private_owner');
    expect(result.messages).toEqual([
      expect.objectContaining({
        id: 'private-owner-message',
        content: 'OWNER-PRIVATE-CONTEXT',
        audience: 'private_owner',
      }),
    ]);
    expect(mockPrisma.chatParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: PARTICIPANT_A,
          room_id: ROOM_ID,
          owned_channels: {
            some: { id: 'private-channel-a', kind: 'private' },
          },
        }),
      }),
    );
  });

  it('shared capsule 必須具有 current-policy、exact、未撤回且未過期的本人授權', async () => {
    const validHash = 'a'.repeat(64);
    const mismatchedHash = 'b'.repeat(64);
    const oldPolicy = '2026-07-01.v0';
    mockPrisma.chatRoom.findUnique.mockResolvedValue(
      room([
        participant(PARTICIPANT_A, 'roleA', 'private_only'),
        participant(PARTICIPANT_B, 'roleB', 'private_only'),
      ])
    );
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);
    mockPrisma.contextCapsule.findMany.mockResolvedValue([
      capsule('capsule-valid', validHash, [authorization('auth-valid', validHash)]),
      capsule('capsule-wrong-hash', validHash, [authorization('auth-wrong-hash', mismatchedHash)]),
      capsule('capsule-wrong-owner', validHash, [
        authorization('auth-wrong-owner', validHash, {
          subject_participant_id: PARTICIPANT_B,
        }),
      ]),
      capsule('capsule-revoked-auth', validHash, [
        authorization('auth-revoked', validHash, { revoked_at: PAST }),
      ]),
      capsule('capsule-expired-auth', validHash, [
        authorization('auth-expired', validHash, { expires_at: PAST }),
      ]),
      capsule(
        'capsule-old-policy',
        validHash,
        [authorization('auth-old-policy', validHash, { policy_version: oldPolicy })],
        { policy_version: oldPolicy }
      ),
    ]);

    const bundle = await new ChatContextPolicyService().resolveSharedMediation({
      roomId: ROOM_ID,
    });

    expect(mockPrisma.contextCapsule.findMany.mock.calls[0][0].where).toMatchObject({
      policy_version: CHAT_CONTEXT_POLICY_VERSION,
      authorizations: {
        some: {
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
          purpose: 'shared_mediation',
          audience: 'room_participants',
          target_type: 'chat_room',
          target_id: ROOM_ID,
          revoked_at: null,
        },
      },
    });
    expect(bundle.capsules).toEqual([
      {
        id: 'capsule-valid',
        summary: 'summary-capsule-valid',
        contentHash: validHash,
        authorizationIds: ['auth-valid'],
      },
    ]);
    expect(bundle.authorizationRefs).toEqual(['auth-valid']);
    expect(JSON.stringify(mockPrisma.contextUseAudit.create.mock.calls)).not.toContain(
      'summary-capsule-valid'
    );
  });

  it('capsule authorization 在 final provider claim 前被撤回時不會進入 shared bundle', async () => {
    const validHash = 'a'.repeat(64);
    mockPrisma.chatRoom.findUnique.mockResolvedValue(
      room([
        participant(PARTICIPANT_A, 'roleA', 'private_only'),
        participant(PARTICIPANT_B, 'roleB', 'private_only'),
      ])
    );
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);
    mockPrisma.contextCapsule.findMany
      .mockResolvedValueOnce([
        capsule('capsule-valid', validHash, [authorization('auth-valid', validHash)]),
      ])
      .mockResolvedValueOnce([]);

    const bundle = await new ChatContextPolicyService().resolveSharedMediation({
      roomId: ROOM_ID,
    });

    expect(bundle.capsules).toEqual([]);
    expect(bundle.authorizationRefs).toEqual([]);
    expect(JSON.stringify(mockPrisma.contextUseAudit.create.mock.calls)).not.toContain(
      'approved_capsule_exact_authorization'
    );
  });
});
