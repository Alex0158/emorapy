const mockPrisma = {
  chatRoom: { findUnique: jest.fn() },
  chatParticipant: { findFirst: jest.fn() },
  chatMessage: { findMany: jest.fn() },
  contextCapsule: { findMany: jest.fn() },
  contextUseAudit: { create: jest.fn() },
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
  });

  it('private controls on/off 的 shared mediation bundle byte-identical，且不查詢 private raw', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue(
      room([
        participant(PARTICIPANT_A, 'roleA', 'shared_process_controls'),
        participant(PARTICIPANT_B, 'roleB', 'private_only'),
      ])
    );
    mockPrisma.chatMessage.findMany.mockResolvedValue([sharedMessage()]);

    const service = new ChatContextPolicyService();
    const optedInBundle = await service.resolveSharedMediation({
      roomId: ROOM_ID,
    });
    mockPrisma.chatRoom.findUnique.mockResolvedValue(
      room([
        participant(PARTICIPANT_A, 'roleA', 'private_only'),
        participant(PARTICIPANT_B, 'roleB', 'private_only'),
      ])
    );
    const privateOnlyBundle = await service.resolveSharedMediation({
      roomId: ROOM_ID,
    });

    expect(optedInBundle).toEqual(privateOnlyBundle);
    expect(optedInBundle.controls).toBeNull();
    expect(optedInBundle.messages.map(message => message.id)).toEqual(['shared-message']);
    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mockPrisma.chatMessage.findMany.mock.calls)).not.toMatch(
      /owner_only|summary_only|owned_channels|private_context_use_mode/
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
});
