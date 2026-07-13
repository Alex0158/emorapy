import type { Prisma, PrismaClient } from '@prisma/client';
import type { ChatActorAccessService } from '../../../src/services/chat-actor-access.service';
import { ContextCapsuleService } from '../../../src/services/context-capsule.service';
import {
  CHAT_CONTEXT_POLICY_VERSION,
  computeCapsuleContentHash,
  textSha256,
} from '../../../src/utils/chat-context-validation';

const NOW = new Date('2026-07-12T20:00:00.000Z');
const ROOM_ID = '550e8400-e29b-41d4-a716-446655440000';
const PARTICIPANT_ID = '550e8400-e29b-41d4-a716-446655440001';
const CHANNEL_ID = '550e8400-e29b-41d4-a716-446655440002';
const MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440003';
const CAPSULE_ID = '550e8400-e29b-41d4-a716-446655440004';
const AUTHORIZATION_ID = '550e8400-e29b-41d4-a716-446655440005';
const REQUEST_ID = '550e8400-e29b-41d4-a716-446655440012';

function createDbMock() {
  const holder: { current?: Prisma.TransactionClient } = {};
  const db = {
    chatChannel: { findFirst: jest.fn() },
    chatMessage: { findMany: jest.fn() },
    contextCapsule: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    contextAuthorization: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    chatAnalysisRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    contextUseAudit: { create: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(holder.current as Prisma.TransactionClient)
    ),
  };
  holder.current = db as unknown as Prisma.TransactionClient;
  return db;
}

function createActorAccessMock() {
  return {
    resolveActiveHumanParticipant: jest.fn().mockResolvedValue({
      actor: { userId: 'user-a' },
      room: { id: ROOM_ID, participants: [] },
      participant: { id: PARTICIPANT_ID },
    }),
  };
}

function createService() {
  const db = createDbMock();
  const actorAccess = createActorAccessMock();
  const service = new ContextCapsuleService(
    db as unknown as PrismaClient,
    actorAccess as unknown as Pick<ChatActorAccessService, 'resolveActiveHumanParticipant'>,
    () => NOW
  );
  return { db, actorAccess, service };
}

function capsuleRecord(overrides: Record<string, unknown> = {}) {
  const expiresAt = new Date('2026-07-19T20:00:00.000Z');
  const sourceRefs = [
    {
      kind: 'chat_message',
      id: MESSAGE_ID,
      content_hash: textSha256('private source'),
    },
  ];
  const base = {
    id: CAPSULE_ID,
    room_id: ROOM_ID,
    owner_participant_id: PARTICIPANT_ID,
    source_channel_id: CHANNEL_ID,
    lineage_id: '550e8400-e29b-41d4-a716-446655440006',
    version: 1,
    summary: 'safe summary',
    source_refs: sourceRefs,
    policy_version: CHAT_CONTEXT_POLICY_VERSION,
    sensitivity_class: 'sensitive',
    status: 'draft',
    expires_at: expiresAt,
    revoked_at: null,
    created_at: NOW,
  };
  return {
    ...base,
    content_hash: computeCapsuleContentHash({
      expiresAt,
      lineageId: base.lineage_id,
      ownerParticipantId: base.owner_participant_id,
      policyVersion: base.policy_version,
      roomId: base.room_id,
      sourceChannelId: base.source_channel_id,
      sourceRefs,
      summary: base.summary,
      version: base.version,
    }),
    ...overrides,
  };
}

describe('ContextCapsuleService', () => {
  it('creates a canonical draft only from the actor-owned private channel', async () => {
    const { db, service } = createService();
    db.chatChannel.findFirst.mockResolvedValue({ id: CHANNEL_ID });
    db.chatMessage.findMany.mockResolvedValue([{ id: MESSAGE_ID, content: 'private source' }]);
    db.contextCapsule.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: CAPSULE_ID,
        ...args.data,
      })
    );
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-1' });

    const result = await service.createDraft(
      ROOM_ID,
      { userId: 'user-a' },
      {
        source_channel_id: CHANNEL_ID,
        source_message_ids: [MESSAGE_ID],
        summary: ' safe summary ',
        expires_at: '2026-07-19T20:00:00.000Z',
      }
    );

    expect(db.chatChannel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: CHANNEL_ID,
          room_id: ROOM_ID,
          kind: 'private',
          owner_participant_id: PARTICIPANT_ID,
        }),
      })
    );
    const createData = db.contextCapsule.create.mock.calls[0][0].data;
    expect(createData.summary).toBe('safe summary');
    expect(createData.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(createData.source_refs).toEqual([
      {
        kind: 'chat_message',
        id: MESSAGE_ID,
        content_hash: textSha256('private source'),
      },
    ]);
    expect(JSON.stringify(db.contextUseAudit.create.mock.calls[0][0])).not.toContain(
      'private source'
    );
    expect(result.id).toBe(CAPSULE_ID);
  });

  it('fails closed when any requested source is outside the owned private channel', async () => {
    const { db, service } = createService();
    db.chatChannel.findFirst.mockResolvedValue({ id: CHANNEL_ID });
    db.chatMessage.findMany.mockResolvedValue([]);

    await expect(
      service.createDraft(
        ROOM_ID,
        { userId: 'user-a' },
        {
          source_channel_id: CHANNEL_ID,
          source_message_ids: [MESSAGE_ID],
          summary: 'safe summary',
        }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.contextCapsule.create).not.toHaveBeenCalled();
  });

  it('opens a new version and revokes prior grants instead of mutating approved content', async () => {
    const { db, service } = createService();
    const previous = capsuleRecord({ status: 'approved' });
    db.contextCapsule.findFirst.mockResolvedValue(previous);
    db.chatChannel.findFirst.mockResolvedValue({ id: CHANNEL_ID });
    db.chatMessage.findMany.mockResolvedValue([{ id: MESSAGE_ID, content: 'private source' }]);
    db.contextCapsule.updateMany.mockResolvedValue({ count: 1 });
    db.contextAuthorization.updateMany.mockResolvedValue({ count: 1 });
    db.chatAnalysisRequest.findMany.mockResolvedValue([
      {
        id: REQUEST_ID,
        selection_snapshot: { capsule_refs: [{ id: CAPSULE_ID }] },
      },
    ]);
    db.chatAnalysisRequest.updateMany.mockResolvedValue({ count: 1 });
    db.contextCapsule.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: '550e8400-e29b-41d4-a716-446655440007',
        ...args.data,
      })
    );
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-2' });

    const revised = await service.reviseDraft(
      ROOM_ID,
      CAPSULE_ID,
      { userId: 'user-a' },
      {
        source_channel_id: CHANNEL_ID,
        source_message_ids: [MESSAGE_ID],
        summary: 'revised safe summary',
      }
    );

    expect(db.contextCapsule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'revoked', revoked_at: NOW },
      })
    );
    expect(db.contextAuthorization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { revoked_at: NOW, revocation_reason_code: 'capsule_superseded' },
      })
    );
    expect(db.chatAnalysisRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [REQUEST_ID] } }),
        data: { status: 'cancelled', cancelled_at: NOW },
      })
    );
    expect(revised).toMatchObject({ lineage_id: previous.lineage_id, version: 2, status: 'draft' });
  });

  it('binds an authorization to the exact canonical capsule hash and policy', async () => {
    const { db, service } = createService();
    const capsule = capsuleRecord();
    db.contextCapsule.findFirst.mockResolvedValue(capsule);
    db.contextCapsule.updateMany.mockResolvedValue({ count: 1 });
    db.contextAuthorization.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: AUTHORIZATION_ID,
        ...args.data,
      })
    );
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-3' });

    const authorization = await service.grantAuthorization(
      ROOM_ID,
      CAPSULE_ID,
      { userId: 'user-a' },
      {
        capsule_content_hash: capsule.content_hash,
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
        target_type: 'chat_room',
        target_id: ROOM_ID,
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
      }
    );

    expect(db.contextAuthorization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          capsule_content_hash: capsule.content_hash,
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
          subject_participant_id: PARTICIPANT_ID,
        }),
      })
    );
    expect(authorization.id).toBe(AUTHORIZATION_ID);
  });

  it.each(['P2002', 'P2034'])(
    'concurrent exact grant %s returns the durable active authorization idempotently',
    async (conflictCode) => {
    const { actorAccess, db, service } = createService();
    const capsule = capsuleRecord();
    const existing = {
      id: AUTHORIZATION_ID,
      capsule_id: CAPSULE_ID,
      subject_participant_id: PARTICIPANT_ID,
      purpose: 'formal_analysis_evidence',
      audience: 'analysis_participants',
      target_type: 'chat_room',
      target_id: ROOM_ID,
      capsule_content_hash: capsule.content_hash,
      policy_version: CHAT_CONTEXT_POLICY_VERSION,
      granted_at: NOW,
      expires_at: new Date('2026-07-13T20:00:00.000Z'),
      revoked_at: null,
      revocation_reason_code: null,
    };
    db.contextCapsule.findFirst.mockResolvedValue(capsule);
    db.contextCapsule.updateMany.mockResolvedValue({ count: 1 });
    db.contextAuthorization.updateMany.mockResolvedValue({ count: 0 });
    db.contextAuthorization.create.mockRejectedValue(
      Object.assign(new Error('active grant concurrent conflict'), { code: conflictCode })
    );
    db.contextAuthorization.findFirst.mockResolvedValue(existing);

    const result = await service.grantAuthorization(
      ROOM_ID,
      CAPSULE_ID,
      { userId: 'user-a' },
      {
        capsule_content_hash: capsule.content_hash,
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
        target_type: 'chat_room',
        target_id: ROOM_ID,
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
      }
    );

    expect(result).toEqual(existing);
    expect(actorAccess.resolveActiveHumanParticipant).toHaveBeenCalledTimes(2);
    expect(db.contextAuthorization.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        capsule_id: CAPSULE_ID,
        subject_participant_id: PARTICIPANT_ID,
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
        target_type: 'chat_room',
        target_id: ROOM_ID,
        capsule_content_hash: capsule.content_hash,
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
        revoked_at: null,
        expires_at: { gt: NOW },
      }),
    });
    expect(db.contextUseAudit.create).not.toHaveBeenCalled();
    },
  );

  it('never recovers a revoked exact grant after a concurrent unique conflict', async () => {
    const { db, service } = createService();
    const capsule = capsuleRecord();
    db.contextCapsule.findFirst.mockResolvedValue(capsule);
    db.contextCapsule.updateMany.mockResolvedValue({ count: 1 });
    db.contextAuthorization.updateMany.mockResolvedValue({ count: 0 });
    db.contextAuthorization.create.mockRejectedValue(
      Object.assign(new Error('active grant unique conflict'), { code: 'P2002' })
    );
    db.contextAuthorization.findFirst.mockResolvedValue({
      id: AUTHORIZATION_ID,
      capsule_id: CAPSULE_ID,
      subject_participant_id: PARTICIPANT_ID,
      purpose: 'formal_analysis_evidence',
      audience: 'analysis_participants',
      target_type: 'chat_room',
      target_id: ROOM_ID,
      capsule_content_hash: capsule.content_hash,
      policy_version: CHAT_CONTEXT_POLICY_VERSION,
      granted_at: NOW,
      expires_at: new Date('2026-07-13T20:00:00.000Z'),
      revoked_at: NOW,
      revocation_reason_code: 'user_revoked',
    });

    await expect(
      service.grantAuthorization(
        ROOM_ID,
        CAPSULE_ID,
        { userId: 'user-a' },
        {
          capsule_content_hash: capsule.content_hash,
          purpose: 'formal_analysis_evidence',
          audience: 'analysis_participants',
          target_type: 'chat_room',
          target_id: ROOM_ID,
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
        }
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('preserves a non-concurrency CONFLICT without idempotent active-grant recovery', async () => {
    const { db, service } = createService();
    const capsule = capsuleRecord();
    db.contextCapsule.findFirst.mockResolvedValue(capsule);
    db.contextCapsule.updateMany.mockResolvedValue({ count: 0 });
    db.contextAuthorization.findFirst.mockResolvedValue({
      id: AUTHORIZATION_ID,
      capsule_id: CAPSULE_ID,
      subject_participant_id: PARTICIPANT_ID,
      purpose: 'formal_analysis_evidence',
      audience: 'analysis_participants',
      target_type: 'chat_room',
      target_id: ROOM_ID,
      capsule_content_hash: capsule.content_hash,
      policy_version: CHAT_CONTEXT_POLICY_VERSION,
      granted_at: NOW,
      expires_at: new Date('2026-07-13T20:00:00.000Z'),
      revoked_at: null,
      revocation_reason_code: null,
    });

    await expect(service.grantAuthorization(
      ROOM_ID,
      CAPSULE_ID,
      { userId: 'user-a' },
      {
        capsule_content_hash: capsule.content_hash,
        purpose: 'formal_analysis_evidence',
        audience: 'analysis_participants',
        target_type: 'chat_room',
        target_id: ROOM_ID,
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
      }
    )).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Capsule 版本已變更，請重新載入',
    });
    expect(db.contextAuthorization.findFirst).not.toHaveBeenCalled();
  });

  it('rejects stale hashes and only lets the granting participant revoke', async () => {
    const { db, service } = createService();
    const capsule = capsuleRecord();
    db.contextCapsule.findFirst.mockResolvedValue(capsule);

    await expect(
      service.grantAuthorization(
        ROOM_ID,
        CAPSULE_ID,
        { userId: 'user-a' },
        {
          capsule_content_hash: 'a'.repeat(64),
          purpose: 'formal_analysis_evidence',
          audience: 'analysis_participants',
          target_type: 'chat_room',
          target_id: ROOM_ID,
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
        }
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    db.contextAuthorization.findFirst.mockResolvedValue(null);
    await expect(
      service.revokeAuthorization(
        ROOM_ID,
        AUTHORIZATION_ID,
        { userId: 'user-a' },
        { reason_code: 'user_revoked' }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.contextAuthorization.updateMany).not.toHaveBeenCalled();
  });

  it('revocation cancels every not-yet-processing request that references the capsule', async () => {
    const { db, service } = createService();
    const capsule = capsuleRecord({ status: 'approved' });
    const authorization = {
      id: AUTHORIZATION_ID,
      capsule_id: CAPSULE_ID,
      subject_participant_id: PARTICIPANT_ID,
      purpose: 'formal_analysis_evidence',
      audience: 'analysis_participants',
      target_type: 'chat_room',
      target_id: ROOM_ID,
      capsule_content_hash: capsule.content_hash,
      policy_version: CHAT_CONTEXT_POLICY_VERSION,
      granted_at: NOW,
      expires_at: new Date('2026-07-13T20:00:00.000Z'),
      revoked_at: null,
      revocation_reason_code: null,
      capsule,
    };
    db.contextAuthorization.findFirst.mockResolvedValue(authorization);
    db.contextAuthorization.updateMany.mockResolvedValue({ count: 1 });
    db.contextAuthorization.findUniqueOrThrow.mockResolvedValue({
      ...authorization,
      capsule: undefined,
      revoked_at: NOW,
      revocation_reason_code: 'user_revoked',
    });
    db.chatAnalysisRequest.findMany.mockResolvedValue([
      {
        id: REQUEST_ID,
        selection_snapshot: { capsule_refs: [{ id: CAPSULE_ID }] },
      },
    ]);
    db.chatAnalysisRequest.updateMany.mockResolvedValue({ count: 1 });
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-revoke' });

    const result = await service.revokeAuthorization(
      ROOM_ID,
      AUTHORIZATION_ID,
      { userId: 'user-a' },
      { reason_code: 'user_revoked' }
    );

    expect(db.chatAnalysisRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [REQUEST_ID] } }),
        data: { status: 'cancelled', cancelled_at: NOW },
      })
    );
    expect(result).toMatchObject({
      revoked_at: NOW,
      revocation_reason_code: 'user_revoked',
    });
  });
});
