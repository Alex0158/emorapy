import type { Prisma, PrismaClient } from '@prisma/client';
import type { ChatActorAccessService } from '../../../src/services/chat-actor-access.service';
import { parseChatAnalysisSelectionSnapshot } from '../../../src/services/chat-analysis-selection.validator';
import { ChatContextReadService } from '../../../src/services/chat-context-read.service';
import {
  CHAT_CONTEXT_POLICY_VERSION,
  computeAnalysisSelectionHash,
  computeCapsuleContentHash,
  textSha256,
} from '../../../src/utils/chat-context-validation';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {},
}));

const NOW = new Date('2026-07-12T20:00:00.000Z');
const FUTURE = new Date('2026-07-15T20:00:00.000Z');
const ROOM_ID = 'room-1';
const PARTICIPANT_A = 'participant-a';
const PARTICIPANT_B = 'participant-b';

function createDbMock() {
  const holder: { current?: Prisma.TransactionClient } = {};
  const db = {
    contextCapsule: { findMany: jest.fn() },
    chatAnalysisRequest: { findMany: jest.fn() },
    chatMessage: { findMany: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(holder.current as Prisma.TransactionClient)
    ),
  };
  holder.current = db as unknown as Prisma.TransactionClient;
  return db;
}

function createActorAccessMock(input: {
  participantId?: string;
  roleInRoom?: 'roleA' | 'roleB';
  joinedAt?: Date;
  historyVisibilityMode?: 'share_from_join_time' | 'share_full_history';
} = {}) {
  return {
    resolveActiveHumanParticipant: jest.fn().mockResolvedValue({
      participant: {
        id: input.participantId ?? PARTICIPANT_A,
        role_in_room: input.roleInRoom ?? 'roleA',
        joined_at: input.joinedAt ?? NOW,
      },
      room: {
        id: ROOM_ID,
        history_visibility_mode: input.historyVisibilityMode ?? 'share_from_join_time',
      },
    }),
  };
}

function createService(input: Parameters<typeof createActorAccessMock>[0] = {}) {
  const db = createDbMock();
  const actorAccess = createActorAccessMock(input);
  const service = new ChatContextReadService(
    db as unknown as PrismaClient,
    actorAccess as unknown as Pick<ChatActorAccessService, 'resolveActiveHumanParticipant'>,
    () => NOW
  );
  return { actorAccess, db, service };
}

function capsuleRecord(id: string, summary: string, authorizationHash?: string) {
  const sourceRefs = [
    {
      kind: 'chat_message',
      id: `private-source-${id}`,
      content_hash: textSha256(`private-${id}`),
    },
  ];
  const base = {
    id,
    room_id: ROOM_ID,
    owner_participant_id: PARTICIPANT_A,
    source_channel_id: 'private-channel-a',
    lineage_id: `lineage-${id}`,
    version: 1,
    summary,
    source_refs: sourceRefs,
    policy_version: CHAT_CONTEXT_POLICY_VERSION,
    sensitivity_class: 'sensitive',
    status: 'approved',
    expires_at: FUTURE,
    revoked_at: null,
    created_at: NOW,
    owner_participant: {
      participant_type: 'user',
      role_in_room: 'roleA',
      is_active: true,
      left_at: null,
    },
  };
  const contentHash = computeCapsuleContentHash({
    expiresAt: FUTURE,
    lineageId: base.lineage_id,
    ownerParticipantId: base.owner_participant_id,
    policyVersion: base.policy_version,
    roomId: base.room_id,
    sourceChannelId: base.source_channel_id,
    sourceRefs,
    summary,
    version: base.version,
  });
  return {
    ...base,
    content_hash: contentHash,
    authorizations: [
      {
        id: `authorization-${id}`,
        capsule_id: id,
        subject_participant_id: PARTICIPANT_A,
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
        target_type: 'chat_room',
        target_id: ROOM_ID,
        capsule_content_hash: authorizationHash ?? contentHash,
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
        granted_at: NOW,
        expires_at: FUTURE,
        revoked_at: null,
        revocation_reason_code: null,
      },
    ],
  };
}

function requestWithSharedMessage(messageId: string, content: string) {
  const selectionSnapshot = parseChatAnalysisSelectionSnapshot({
    message_refs: [{
      kind: 'chat_message',
      id: messageId,
      content_hash: textSha256(content),
    }],
    capsule_refs: [],
  } as never);
  const requiredParticipantIds = [PARTICIPANT_A, PARTICIPANT_B];
  return {
    id: `request-${messageId}`,
    room_id: ROOM_ID,
    requested_by_participant_id: PARTICIPANT_A,
    status: 'pending_approval',
    selection_snapshot: selectionSnapshot,
    selection_hash: computeAnalysisSelectionHash({
      policyVersion: CHAT_CONTEXT_POLICY_VERSION,
      requiredParticipantIds,
      roomId: ROOM_ID,
      selectionSnapshot,
    }),
    required_participant_ids: requiredParticipantIds,
    policy_version: CHAT_CONTEXT_POLICY_VERSION,
    expires_at: FUTURE,
    submitted_at: null,
    cancelled_at: null,
    created_at: NOW,
    updated_at: NOW,
    participant_approvals: [],
  };
}

describe('ChatContextReadService', () => {
  it.each([
    ['roleB replacement', 'roleB', 'share_from_join_time', false],
    ['roleA', 'roleA', 'share_from_join_time', true],
    ['roleB full history', 'roleB', 'share_full_history', true],
  ] as const)(
    '%s source preview applies the participant shared-history boundary',
    async (_label, roleInRoom, historyVisibilityMode, shouldPreview) => {
      const joinedAt = new Date('2026-07-12T20:00:00.000Z');
      const content = 'pre-join shared content';
      const { db, service } = createService({
        participantId: roleInRoom === 'roleB' ? PARTICIPANT_B : PARTICIPANT_A,
        roleInRoom,
        joinedAt,
        historyVisibilityMode,
      });
      db.chatAnalysisRequest.findMany.mockResolvedValue([
        requestWithSharedMessage('message-prejoin', content),
      ]);
      db.chatMessage.findMany.mockResolvedValue([{
        id: 'message-prejoin',
        room_id: ROOM_ID,
        content,
        message_type: 'user_text',
        visibility_scope: 'all',
        ai_context_eligible: true,
        safety_flag: false,
        sender_participant_id: PARTICIPANT_A,
        created_at: new Date('2026-07-12T19:59:59.000Z'),
        channel: { room_id: ROOM_ID, kind: 'shared' },
        sender_participant: {
          participant_type: 'user',
          role_in_room: 'roleA',
          is_active: true,
          left_at: null,
        },
      }]);

      const result = await service.listAnalysisRequests(ROOM_ID, {
        userId: roleInRoom === 'roleB' ? 'user-b' : 'user-a',
      });

      expect(result[0].source_previews.messages).toHaveLength(shouldPreview ? 1 : 0);
      const queryWhere = db.chatMessage.findMany.mock.calls[0][0].where;
      if (roleInRoom === 'roleB' && historyVisibilityMode !== 'share_full_history') {
        expect(queryWhere.created_at).toEqual({ gte: joinedAt });
      } else {
        expect(queryWhere.created_at).toBeUndefined();
      }
    },
  );

  it('capsule list 只回傳 actor 本人的 capsules 與本人 authorizations', async () => {
    const { actorAccess, db, service } = createService();
    const own = capsuleRecord('capsule-own', 'owner summary');
    own.source_refs.push({
      kind: 'chat_message',
      id: 'malformed-ref',
      content_hash: textSha256('malformed'),
      raw_content: 'must not escape',
    } as never);
    own.authorizations.push({
      ...own.authorizations[0],
      id: 'authorization-other-subject',
      subject_participant_id: PARTICIPANT_B,
    });
    const other = {
      ...capsuleRecord('capsule-other', 'other private summary'),
      owner_participant_id: PARTICIPANT_B,
    };
    const otherRoom = {
      ...capsuleRecord('capsule-other-room', 'other room private summary'),
      room_id: 'room-2',
    };
    db.contextCapsule.findMany.mockResolvedValue([own, other, otherRoom]);

    const result = await service.listOwnCapsules(ROOM_ID, { userId: 'user-a' });

    expect(actorAccess.resolveActiveHumanParticipant).toHaveBeenCalledWith(
      ROOM_ID,
      { userId: 'user-a' },
      db
    );
    expect(db.contextCapsule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { room_id: ROOM_ID, owner_participant_id: PARTICIPANT_A },
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('capsule-own');
    expect(result[0].authorizations.map(item => item.id)).toEqual(['authorization-capsule-own']);
    expect(JSON.stringify(result)).not.toMatch(
      /other private summary|other room private summary|must not escape/
    );
  });

  it('analysis list 只回 required participant，並逐項 fail closed 建立 previews', async () => {
    const { db, service } = createService();
    const validMessageContent = 'shared exact message';
    const privateMessageContent = 'PRIVATE RAW MESSAGE';
    const validCapsule = capsuleRecord('capsule-valid', 'approved shared summary');
    const invalidCapsule = capsuleRecord(
      'capsule-invalid',
      'UNAUTHORIZED PRIVATE SUMMARY',
      'f'.repeat(64)
    );
    const selectionSnapshot = {
      message_refs: [
        {
          kind: 'chat_message' as const,
          id: 'message-valid',
          content_hash: textSha256(validMessageContent),
        },
        {
          kind: 'chat_message' as const,
          id: 'message-private',
          content_hash: textSha256(privateMessageContent),
        },
        {
          kind: 'chat_message' as const,
          id: 'message-tampered',
          content_hash: textSha256('expected content'),
        },
      ],
      capsule_refs: [
        {
          kind: 'context_capsule' as const,
          id: validCapsule.id,
          version: validCapsule.version,
          content_hash: validCapsule.content_hash,
        },
        {
          kind: 'context_capsule' as const,
          id: invalidCapsule.id,
          version: invalidCapsule.version,
          content_hash: invalidCapsule.content_hash,
        },
      ],
    };
    const storedSelectionSnapshot = parseChatAnalysisSelectionSnapshot(selectionSnapshot as never);
    const requiredParticipantIds = [PARTICIPANT_A, PARTICIPANT_B];
    const selectionHash = computeAnalysisSelectionHash({
      policyVersion: CHAT_CONTEXT_POLICY_VERSION,
      requiredParticipantIds,
      roomId: ROOM_ID,
      selectionSnapshot: storedSelectionSnapshot,
    });
    const request = {
      id: 'request-visible',
      room_id: ROOM_ID,
      requested_by_participant_id: PARTICIPANT_A,
      status: 'pending_approval',
      selection_snapshot: storedSelectionSnapshot,
      selection_hash: selectionHash,
      required_participant_ids: requiredParticipantIds,
      policy_version: CHAT_CONTEXT_POLICY_VERSION,
      expires_at: FUTURE,
      submitted_at: null,
      cancelled_at: null,
      created_at: NOW,
      updated_at: NOW,
      participant_approvals: [
        {
          id: 'approval-a',
          analysis_request_id: 'request-visible',
          participant_id: PARTICIPANT_A,
          decision: 'approved',
          selection_hash: selectionHash,
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
          decision_at: NOW,
          expires_at: FUTURE,
          revoked_at: null,
        },
        {
          id: 'approval-outsider',
          analysis_request_id: 'request-visible',
          participant_id: 'participant-outsider',
          decision: 'approved',
          selection_hash: selectionHash,
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
          decision_at: NOW,
          expires_at: FUTURE,
          revoked_at: null,
        },
      ],
    };
    db.chatAnalysisRequest.findMany.mockResolvedValue([
      request,
      { ...request, id: 'request-not-required', required_participant_ids: [PARTICIPANT_B] },
      { ...request, id: 'request-other-room', room_id: 'room-2' },
    ]);
    db.chatMessage.findMany.mockResolvedValue([
      {
        id: 'message-valid',
        room_id: ROOM_ID,
        content: validMessageContent,
        message_type: 'user_text',
        visibility_scope: 'all',
        ai_context_eligible: true,
        safety_flag: false,
        sender_participant_id: PARTICIPANT_A,
        created_at: NOW,
        channel: { room_id: ROOM_ID, kind: 'shared' },
        sender_participant: {
          participant_type: 'user',
          role_in_room: 'roleA',
          is_active: true,
          left_at: null,
        },
      },
      {
        id: 'message-private',
        room_id: ROOM_ID,
        content: privateMessageContent,
        message_type: 'user_text',
        visibility_scope: 'owner_only',
        ai_context_eligible: true,
        safety_flag: false,
        sender_participant_id: PARTICIPANT_A,
        created_at: NOW,
        channel: { room_id: ROOM_ID, kind: 'private' },
        sender_participant: {
          participant_type: 'user',
          role_in_room: 'roleA',
          is_active: true,
          left_at: null,
        },
      },
      {
        id: 'message-tampered',
        room_id: ROOM_ID,
        content: 'changed content',
        message_type: 'user_text',
        visibility_scope: 'all',
        ai_context_eligible: true,
        safety_flag: false,
        sender_participant_id: PARTICIPANT_B,
        created_at: NOW,
        channel: { room_id: ROOM_ID, kind: 'shared' },
        sender_participant: {
          participant_type: 'user',
          role_in_room: 'roleB',
          is_active: true,
          left_at: null,
        },
      },
    ]);
    db.contextCapsule.findMany.mockResolvedValue([validCapsule, invalidCapsule]);

    const result = await service.listAnalysisRequests(ROOM_ID, { userId: 'user-a' });

    expect(db.chatAnalysisRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          room_id: ROOM_ID,
          required_participant_ids: { has: PARTICIPANT_A },
        },
      })
    );
    expect(db.chatMessage.findMany.mock.calls[0][0].where).toMatchObject({
      room_id: ROOM_ID,
      message_type: 'user_text',
      visibility_scope: 'all',
      ai_context_eligible: true,
      safety_flag: false,
      channel: { is: { room_id: ROOM_ID, kind: 'shared' } },
    });
    expect(db.contextCapsule.findMany.mock.calls[0][0].where.authorizations).toEqual({
      some: expect.objectContaining({
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
        target_type: 'chat_room',
        target_id: ROOM_ID,
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].participant_approvals.map(item => item.id)).toEqual(['approval-a']);
    expect(result[0].source_previews.messages).toEqual([
      expect.objectContaining({
        id: 'message-valid',
        content: validMessageContent,
      }),
    ]);
    expect(result[0].source_previews.capsules).toEqual([
      expect.objectContaining({
        id: 'capsule-valid',
        summary: 'approved shared summary',
      }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE RAW MESSAGE|UNAUTHORIZED PRIVATE SUMMARY|private-source-capsule/
    );
  });

  it('public selection parser rejects raw or extra fields instead of forwarding them', () => {
    expect(() =>
      parseChatAnalysisSelectionSnapshot({
        message_refs: [
          {
            kind: 'chat_message',
            id: 'message-1',
            content_hash: 'a'.repeat(64),
            raw_content: 'PRIVATE RAW',
          },
        ],
        capsule_refs: [],
      } as never)
    ).toThrow('Analysis selection snapshot 包含無效 source ref');
  });
});
