const mockPrisma = {
  chatRoom: { findUnique: jest.fn() },
  chatParticipant: { findFirst: jest.fn() },
  chatMessage: { findMany: jest.fn() },
  contextCapsule: { findMany: jest.fn() },
  contextUseAudit: { create: jest.fn() },
};

const mockExtractAggregatedControlsWithOutcome = jest.fn();

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
  },
  ContextTargetType: { chat_room: 'chat_room' },
  ContextUseDecision: { allowed: 'allowed', denied: 'denied' },
  PrivateContextUseMode: {
    private_only: 'private_only',
    shared_process_controls: 'shared_process_controls',
  },
  Prisma: {},
}));

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/services/mediation-strategy.service', () => ({
  __esModule: true,
  mediationStrategyService: {
    extractAggregatedControlsWithOutcome: mockExtractAggregatedControlsWithOutcome,
  },
}));

import { ChatContextPolicyService } from '../../../src/services/chat-context-policy.service';
import { CHAT_CONTEXT_POLICY_VERSION } from '../../../src/utils/chat-context-validation';

const ROOM_ID = 'room-1';
const PARTICIPANT_A = 'participant-a';
const PARTICIPANT_B = 'participant-b';
const FUTURE = new Date('2099-01-01T00:00:00.000Z');
const PAST = new Date('2000-01-01T00:00:00.000Z');

function participant(
  id: string,
  role: 'roleA' | 'roleB',
  mode: 'private_only' | 'shared_process_controls'
) {
  return {
    id,
    role_in_room: role,
    participant_type: 'user',
    is_active: true,
    left_at: null,
    joined_at: new Date('2026-07-12T12:00:00.000Z'),
    private_context_use_mode: mode,
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
    mockPrisma.contextUseAudit.create.mockResolvedValue({ id: 'audit-1' });
    mockPrisma.contextCapsule.findMany.mockResolvedValue([]);
    mockExtractAggregatedControlsWithOutcome.mockResolvedValue({
      controls: {
        pace: 'slower',
        ask_permission_before_depth: true,
        offer_pause: true,
        question_style: 'gentle',
        max_questions: 1,
      },
      outcome: 'emitted',
    });
  });

  it('shared mediation 只讀 opted-in 本人私訊，bundle 與 audit 不洩漏 private raw', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue(
      room([
        participant(PARTICIPANT_A, 'roleA', 'shared_process_controls'),
        participant(PARTICIPANT_B, 'roleB', 'private_only'),
      ])
    );
    mockPrisma.chatMessage.findMany.mockResolvedValueOnce([sharedMessage()]).mockResolvedValueOnce([
      {
        id: 'private-a',
        content: 'PRIVATE-A-RAW',
        sender_participant_id: PARTICIPANT_A,
        channel: { owner_participant_id: PARTICIPANT_A },
      },
      {
        id: 'private-b',
        content: 'PRIVATE-B-RAW',
        sender_participant_id: PARTICIPANT_B,
        channel: { owner_participant_id: PARTICIPANT_B },
      },
      {
        id: 'private-cross-owner',
        content: 'PRIVATE-CROSS-RAW',
        sender_participant_id: PARTICIPANT_B,
        channel: { owner_participant_id: PARTICIPANT_A },
      },
    ]);

    const bundle = await new ChatContextPolicyService().resolveSharedMediation({
      roomId: ROOM_ID,
    });

    expect(mockPrisma.chatMessage.findMany.mock.calls[1][0].where).toMatchObject({
      room_id: ROOM_ID,
      message_type: 'user_text',
      ai_context_eligible: true,
      sender_participant_id: { in: [PARTICIPANT_A] },
    });
    expect(mockExtractAggregatedControlsWithOutcome).toHaveBeenCalledWith(ROOM_ID, [
      { participantId: PARTICIPANT_A, messages: ['PRIVATE-A-RAW'] },
    ]);
    expect(mockPrisma.contextUseAudit.create.mock.invocationCallOrder[0]).toBeLessThan(
      mockExtractAggregatedControlsWithOutcome.mock.invocationCallOrder[0],
    );
    expect(mockPrisma.contextUseAudit.create).toHaveBeenCalledTimes(2);
    expect(bundle.messages.map(message => message.id)).toEqual(['shared-message']);
    expect(bundle.sourceRefs).toEqual(['shared-message']);
    expect(JSON.stringify(bundle)).not.toMatch(/PRIVATE-|private-a|private-b|private-cross-owner/);
    expect(JSON.stringify(mockPrisma.contextUseAudit.create.mock.calls)).not.toMatch(
      /PRIVATE-[ABC]/
    );
  });

  it('durable pre-disclosure audit failure prevents every private provider call', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue(
      room([participant(PARTICIPANT_A, 'roleA', 'shared_process_controls')])
    );
    mockPrisma.chatMessage.findMany
      .mockResolvedValueOnce([sharedMessage()])
      .mockResolvedValueOnce([{
        id: 'private-a',
        content: 'PRIVATE-A-RAW',
        sender_participant_id: PARTICIPANT_A,
        channel: { owner_participant_id: PARTICIPANT_A },
      }]);
    mockPrisma.contextUseAudit.create.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(new ChatContextPolicyService().resolveSharedMediation({
      roomId: ROOM_ID,
    })).rejects.toThrow('audit unavailable');

    expect(mockExtractAggregatedControlsWithOutcome).not.toHaveBeenCalled();
    expect(JSON.stringify(mockPrisma.contextUseAudit.create.mock.calls)).not.toContain(
      'PRIVATE-A-RAW'
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
      includePrivateControls: false,
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
});
