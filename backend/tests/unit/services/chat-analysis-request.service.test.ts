import type { Prisma, PrismaClient } from '@prisma/client';
import type { ChatActorAccessService } from '../../../src/services/chat-actor-access.service';
import { ChatAnalysisRequestService } from '../../../src/services/chat-analysis-request.service';
import {
  CHAT_CONTEXT_POLICY_VERSION,
  computeAnalysisSelectionHash,
  computeCapsuleContentHash,
  textSha256,
} from '../../../src/utils/chat-context-validation';

const NOW = new Date('2026-07-12T20:00:00.000Z');
const EXPIRES_AT = new Date('2026-07-13T20:00:00.000Z');
const ROOM_ID = '550e8400-e29b-41d4-a716-446655440000';
const PARTICIPANT_A = '550e8400-e29b-41d4-a716-446655440001';
const PARTICIPANT_B = '550e8400-e29b-41d4-a716-446655440002';
const MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440003';
const REQUEST_ID = '550e8400-e29b-41d4-a716-446655440004';
const APPROVAL_A = '550e8400-e29b-41d4-a716-446655440005';
const APPROVAL_B = '550e8400-e29b-41d4-a716-446655440006';
const CAPSULE_ID = '550e8400-e29b-41d4-a716-446655440007';
const AUTHORIZATION_ID = '550e8400-e29b-41d4-a716-446655440008';
const PRIVATE_CHANNEL_ID = '550e8400-e29b-41d4-a716-446655440009';

function createDbMock() {
  const holder: { current?: Prisma.TransactionClient } = {};
  const db = {
    chatParticipant: { findMany: jest.fn() },
    chatRoom: {
      findUnique: jest.fn().mockResolvedValue({
        history_visibility_mode: 'share_from_join_time',
      }),
    },
    chatMessage: { findMany: jest.fn() },
    contextCapsule: { findMany: jest.fn() },
    chatAnalysisRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    chatAnalysisParticipantApproval: {
      create: jest.fn(),
      count: jest.fn(),
      findUniqueOrThrow: jest.fn(),
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

function createActorAccessMock(participantId = PARTICIPANT_A, roleInRoom = 'roleA') {
  return {
    resolveActiveHumanParticipant: jest.fn().mockResolvedValue({
      actor: { userId: `user-${participantId}` },
      room: { id: ROOM_ID, participants: [] },
      participant: { id: participantId, role_in_room: roleInRoom },
    }),
  };
}

function createService(participantId = PARTICIPANT_A, roleInRoom = 'roleA') {
  const db = createDbMock();
  const actorAccess = createActorAccessMock(participantId, roleInRoom);
  const service = new ChatAnalysisRequestService(
    db as unknown as PrismaClient,
    actorAccess as unknown as Pick<ChatActorAccessService, 'resolveActiveHumanParticipant'>,
    () => NOW
  );
  return { db, actorAccess, service };
}

function messageSelection() {
  return {
    message_refs: [
      {
        kind: 'chat_message' as const,
        id: MESSAGE_ID,
        content_hash: textSha256('shared statement'),
      },
    ],
    capsule_refs: [],
  };
}

function requestRecord(
  input: {
    approvals?: Array<Record<string, unknown>>;
    selectionHash?: string;
    status?: string;
  } = {}
) {
  const selectionSnapshot = messageSelection();
  const selectionHash =
    input.selectionHash ??
    computeAnalysisSelectionHash({
      policyVersion: CHAT_CONTEXT_POLICY_VERSION,
      requiredParticipantIds: [PARTICIPANT_A, PARTICIPANT_B],
      roomId: ROOM_ID,
      selectionSnapshot,
    });
  return {
    id: REQUEST_ID,
    room_id: ROOM_ID,
    requested_by_participant_id: PARTICIPANT_A,
    status: input.status ?? 'pending_approval',
    selection_snapshot: selectionSnapshot,
    selection_hash: selectionHash,
    required_participant_ids: [PARTICIPANT_A, PARTICIPANT_B],
    policy_version: CHAT_CONTEXT_POLICY_VERSION,
    expires_at: EXPIRES_AT,
    submitted_at: null,
    cancelled_at: null,
    created_at: NOW,
    updated_at: NOW,
    participant_approvals: input.approvals ?? [],
  };
}

function approvalRecord(participantId: string, id: string) {
  const request = requestRecord();
  return {
    id,
    analysis_request_id: REQUEST_ID,
    participant_id: participantId,
    decision: 'approved',
    selection_hash: request.selection_hash,
    policy_version: CHAT_CONTEXT_POLICY_VERSION,
    decision_at: NOW,
    expires_at: EXPIRES_AT,
    revoked_at: null,
  };
}

function mockEligibleSharedMessage(db: ReturnType<typeof createDbMock>) {
  db.chatParticipant.findMany.mockResolvedValue([
    { id: PARTICIPANT_A, role_in_room: 'roleA', joined_at: NOW },
    { id: PARTICIPANT_B, role_in_room: 'roleB', joined_at: NOW },
  ]);
  db.chatMessage.findMany.mockResolvedValue([
    {
      id: MESSAGE_ID,
      content: 'shared statement',
      sender_participant_id: PARTICIPANT_A,
      created_at: NOW,
    },
  ]);
}

function approvedCapsuleRecord(includeAuthorization = true) {
  const expiresAt = new Date('2026-07-15T20:00:00.000Z');
  const sourceRefs = [
    {
      kind: 'chat_message',
      id: '550e8400-e29b-41d4-a716-446655440010',
      content_hash: textSha256('private source'),
    },
  ];
  const base = {
    id: CAPSULE_ID,
    room_id: ROOM_ID,
    owner_participant_id: PARTICIPANT_A,
    source_channel_id: PRIVATE_CHANNEL_ID,
    lineage_id: '550e8400-e29b-41d4-a716-446655440011',
    version: 1,
    summary: 'approved summary',
    source_refs: sourceRefs,
    policy_version: CHAT_CONTEXT_POLICY_VERSION,
    sensitivity_class: 'sensitive',
    status: 'approved',
    expires_at: expiresAt,
    revoked_at: null,
    created_at: NOW,
  };
  const contentHash = computeCapsuleContentHash({
    expiresAt,
    lineageId: base.lineage_id,
    ownerParticipantId: base.owner_participant_id,
    policyVersion: base.policy_version,
    roomId: base.room_id,
    sourceChannelId: base.source_channel_id,
    sourceRefs,
    summary: base.summary,
    version: base.version,
  });
  return {
    ...base,
    content_hash: contentHash,
    authorizations: includeAuthorization
      ? [
          {
            id: AUTHORIZATION_ID,
            capsule_id: CAPSULE_ID,
            subject_participant_id: PARTICIPANT_A,
            purpose: 'formal_analysis_evidence',
            audience: 'analysis_participants',
            target_type: 'chat_room',
            target_id: ROOM_ID,
            capsule_content_hash: contentHash,
            policy_version: CHAT_CONTEXT_POLICY_VERSION,
            granted_at: NOW,
            expires_at: new Date('2026-07-14T20:00:00.000Z'),
            revoked_at: null,
            revocation_reason_code: null,
          },
        ]
      : [],
  };
}

describe('ChatAnalysisRequestService', () => {
  it('rejects roleB as an Analysis request initiator', async () => {
    const { db, service } = createService(PARTICIPANT_B, 'roleB');

    await expect(service.createRequest(
      ROOM_ID,
      { userId: 'user-b' },
      { selected_message_ids: [MESSAGE_ID], selected_capsule_ids: [] },
    )).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.chatMessage.findMany).not.toHaveBeenCalled();
    expect(db.chatAnalysisRequest.create).not.toHaveBeenCalled();
  });

  it('replacement B cutoff rejects a pre-join shared row from exact request selection', async () => {
    const { db, service } = createService();
    const b2JoinedAt = new Date('2026-07-12T19:00:00.000Z');
    db.chatParticipant.findMany.mockResolvedValue([
      { id: PARTICIPANT_A, role_in_room: 'roleA', joined_at: NOW },
      { id: PARTICIPANT_B, role_in_room: 'roleB', joined_at: b2JoinedAt },
    ]);
    db.chatMessage.findMany.mockResolvedValue([{
      id: MESSAGE_ID,
      content: 'shared statement',
      sender_participant_id: PARTICIPANT_A,
      created_at: new Date('2026-07-12T18:59:59.000Z'),
    }]);

    await expect(service.createRequest(
      ROOM_ID,
      { userId: 'user-a' },
      { selected_message_ids: [MESSAGE_ID], selected_capsule_ids: [] },
    )).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.chatMessage.findMany.mock.calls[0][0].where).toMatchObject({
      created_at: { gte: b2JoinedAt },
    });
    expect(db.chatAnalysisRequest.create).not.toHaveBeenCalled();
  });

  it('share_full_history permits exact selection of a shared row before roleB joined', async () => {
    const { db, service } = createService();
    db.chatRoom.findUnique.mockResolvedValueOnce({
      history_visibility_mode: 'share_full_history',
    });
    db.chatParticipant.findMany.mockResolvedValue([
      { id: PARTICIPANT_A, role_in_room: 'roleA', joined_at: NOW },
      { id: PARTICIPANT_B, role_in_room: 'roleB', joined_at: NOW },
    ]);
    db.chatMessage.findMany.mockResolvedValue([{
      id: MESSAGE_ID,
      content: 'shared statement',
      sender_participant_id: PARTICIPANT_A,
      created_at: new Date('2026-07-11T20:00:00.000Z'),
    }]);
    db.chatAnalysisRequest.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({ id: REQUEST_ID, ...args.data }),
    );
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-full-history' });

    await expect(service.createRequest(
      ROOM_ID,
      { userId: 'user-a' },
      { selected_message_ids: [MESSAGE_ID], selected_capsule_ids: [] },
    )).resolves.toMatchObject({ id: REQUEST_ID });
    expect(db.chatMessage.findMany.mock.calls[0][0].where.created_at).toBeUndefined();
  });

  it('server-builds the exact selection hash and requires every active human participant', async () => {
    const { db, service } = createService();
    mockEligibleSharedMessage(db);
    db.chatAnalysisRequest.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: REQUEST_ID,
        ...args.data,
      })
    );
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-1' });

    const result = await service.createRequest(
      ROOM_ID,
      { userId: 'user-a' },
      {
        selected_message_ids: [MESSAGE_ID],
        selected_capsule_ids: [],
      }
    );

    const createData = db.chatAnalysisRequest.create.mock.calls[0][0].data;
    expect(createData.required_participant_ids).toEqual([PARTICIPANT_A, PARTICIPANT_B]);
    expect(createData.selection_hash).toBe(
      computeAnalysisSelectionHash({
        policyVersion: CHAT_CONTEXT_POLICY_VERSION,
        requiredParticipantIds: [PARTICIPANT_A, PARTICIPANT_B],
        roomId: ROOM_ID,
        selectionSnapshot: messageSelection(),
      })
    );
    expect(JSON.stringify(db.contextUseAudit.create.mock.calls[0][0])).not.toContain(
      'shared statement'
    );
    expect(result.id).toBe(REQUEST_ID);
  });

  it('expires stale unprocessed requests before creating a replacement', async () => {
    const { db, service } = createService();
    mockEligibleSharedMessage(db);
    db.chatAnalysisRequest.updateMany.mockResolvedValue({ count: 1 });
    db.chatAnalysisRequest.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({ id: REQUEST_ID, ...args.data }),
    );
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-expired-replacement' });

    await service.createRequest(
      ROOM_ID,
      { userId: 'user-a' },
      { selected_message_ids: [MESSAGE_ID], selected_capsule_ids: [] },
    );

    expect(db.chatAnalysisRequest.updateMany).toHaveBeenCalledWith({
      where: {
        room_id: ROOM_ID,
        status: { in: ['pending_approval', 'approved', 'submitted'] },
        expires_at: { lte: NOW },
      },
      data: { status: 'expired' },
    });
    expect(
      db.chatAnalysisRequest.updateMany.mock.invocationCallOrder[0]
    ).toBeLessThan(db.chatAnalysisRequest.create.mock.invocationCallOrder[0]);
  });

  it('maps the durable one-active-request invariant to a conflict', async () => {
    const { db, service } = createService();
    mockEligibleSharedMessage(db);
    db.chatAnalysisRequest.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.createRequest(
      ROOM_ID,
      { userId: 'user-a' },
      { selected_message_ids: [MESSAGE_ID], selected_capsule_ids: [] },
    )).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.contextUseAudit.create).not.toHaveBeenCalled();
  });

  it('rejects message IDs that are not eligible shared human messages', async () => {
    const { db, service } = createService();
    db.chatParticipant.findMany.mockResolvedValue([{ id: PARTICIPANT_A }, { id: PARTICIPANT_B }]);
    db.chatMessage.findMany.mockResolvedValue([]);

    await expect(
      service.createRequest(
        ROOM_ID,
        { userId: 'user-a' },
        {
          selected_message_ids: [MESSAGE_ID],
          selected_capsule_ids: [],
        }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.chatAnalysisRequest.create).not.toHaveBeenCalled();
  });

  it('accepts only canonical approved capsules with an active exact-purpose authorization', async () => {
    const { db, service } = createService();
    db.chatParticipant.findMany.mockResolvedValue([{ id: PARTICIPANT_A }, { id: PARTICIPANT_B }]);
    db.contextCapsule.findMany.mockResolvedValue([approvedCapsuleRecord()]);
    db.chatAnalysisRequest.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: REQUEST_ID,
        ...args.data,
      })
    );
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-capsule' });

    await service.createRequest(
      ROOM_ID,
      { userId: 'user-a' },
      {
        selected_message_ids: [],
        selected_capsule_ids: [CAPSULE_ID],
      }
    );

    expect(db.chatAnalysisRequest.create.mock.calls[0][0].data.selection_snapshot).toEqual({
      message_refs: [],
      capsule_refs: [
        expect.objectContaining({
          kind: 'context_capsule',
          id: CAPSULE_ID,
          version: 1,
        }),
      ],
    });
    expect(db.contextUseAudit.create.mock.calls[0][0].data.authorization_refs).toEqual([
      {
        id: AUTHORIZATION_ID,
        capsule_id: CAPSULE_ID,
        capsule_content_hash: approvedCapsuleRecord().content_hash,
      },
    ]);
  });

  it('rejects a capsule when its exact authorization is missing or revoked', async () => {
    const { db, service } = createService();
    db.chatParticipant.findMany.mockResolvedValue([{ id: PARTICIPANT_A }, { id: PARTICIPANT_B }]);
    db.contextCapsule.findMany.mockResolvedValue([approvedCapsuleRecord(false)]);

    await expect(
      service.createRequest(
        ROOM_ID,
        { userId: 'user-a' },
        {
          selected_message_ids: [],
          selected_capsule_ids: [CAPSULE_ID],
        }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.chatAnalysisRequest.create).not.toHaveBeenCalled();
  });

  it('records approval only for the resolved actor and never accepts a participant ID from the caller', async () => {
    const { db, service } = createService(PARTICIPANT_B);
    const request = requestRecord();
    db.chatAnalysisRequest.findFirst.mockResolvedValue(request);
    mockEligibleSharedMessage(db);
    db.chatAnalysisParticipantApproval.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({ id: APPROVAL_B, ...args.data })
    );
    db.chatAnalysisParticipantApproval.count.mockResolvedValue(1);
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-2' });

    await service.decideRequest(
      ROOM_ID,
      REQUEST_ID,
      { userId: 'user-b' },
      {
        selection_hash: request.selection_hash,
        decision: 'approved',
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
      }
    );

    expect(db.chatAnalysisParticipantApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ participant_id: PARTICIPANT_B }),
      })
    );
  });

  it('fails closed on canonical hash drift before persisting an approval', async () => {
    const { db, service } = createService();
    const request = requestRecord({ selectionHash: 'a'.repeat(64) });
    db.chatAnalysisRequest.findFirst.mockResolvedValue(request);

    await expect(
      service.decideRequest(
        ROOM_ID,
        REQUEST_ID,
        { userId: 'user-a' },
        {
          selection_hash: request.selection_hash,
          decision: 'approved',
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
        }
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.chatAnalysisParticipantApproval.create).not.toHaveBeenCalled();
  });

  it('blocks submit until every required participant has an active exact-hash approval', async () => {
    const { db, service } = createService();
    const onlyA = approvalRecord(PARTICIPANT_A, APPROVAL_A);
    const request = requestRecord({ approvals: [onlyA] });
    db.chatAnalysisRequest.findFirst.mockResolvedValue(request);
    mockEligibleSharedMessage(db);

    await expect(
      service.submitRequest(ROOM_ID, REQUEST_ID, { userId: 'user-a' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.chatAnalysisRequest.updateMany).not.toHaveBeenCalled();
  });

  it('lets each participant revoke only their own approval and cancels future use', async () => {
    const { db, service } = createService();
    const approval = approvalRecord(PARTICIPANT_A, APPROVAL_A);
    const request = requestRecord({ approvals: [approval], status: 'submitted' });
    db.chatAnalysisRequest.findFirst.mockResolvedValue(request);
    db.chatAnalysisParticipantApproval.updateMany.mockResolvedValue({ count: 1 });
    db.chatAnalysisParticipantApproval.findUniqueOrThrow.mockResolvedValue({
      ...approval,
      revoked_at: NOW,
    });
    db.chatAnalysisRequest.updateMany.mockResolvedValue({ count: 1 });
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-revoke' });

    const result = await service.revokeApproval(
      ROOM_ID,
      REQUEST_ID,
      { userId: 'user-a' },
      {
        selection_hash: request.selection_hash,
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
      }
    );

    expect(db.chatAnalysisParticipantApproval.updateMany).toHaveBeenCalledWith({
      where: { id: APPROVAL_A, participant_id: PARTICIPANT_A, revoked_at: null },
      data: { revoked_at: NOW },
    });
    expect(db.chatAnalysisRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: REQUEST_ID }),
        data: { status: 'cancelled', cancelled_at: NOW },
      })
    );
    expect(result.revoked_at).toEqual(NOW);
  });

  it('rejects roleB revocation after the exact request has atomically entered processing', async () => {
    const { db, service } = createService(PARTICIPANT_B, 'roleB');
    const request = requestRecord({
      approvals: [approvalRecord(PARTICIPANT_B, APPROVAL_B)],
      status: 'processing',
    });
    db.chatAnalysisRequest.findFirst.mockResolvedValue(request);

    await expect(service.revokeApproval(
      ROOM_ID,
      REQUEST_ID,
      { userId: 'user-b' },
      {
        selection_hash: request.selection_hash,
        policy_version: CHAT_CONTEXT_POLICY_VERSION,
      },
    )).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(db.chatAnalysisParticipantApproval.updateMany).not.toHaveBeenCalled();
    expect(db.chatAnalysisRequest.updateMany).not.toHaveBeenCalled();
  });

  it('submits only after source, participants, expiry, hash, and both approvals revalidate', async () => {
    const { db, service } = createService();
    const approvals = [
      approvalRecord(PARTICIPANT_A, APPROVAL_A),
      approvalRecord(PARTICIPANT_B, APPROVAL_B),
    ];
    const request = requestRecord({ approvals });
    db.chatAnalysisRequest.findFirst.mockResolvedValue(request);
    mockEligibleSharedMessage(db);
    db.chatAnalysisRequest.updateMany.mockResolvedValue({ count: 1 });
    db.chatAnalysisRequest.findUniqueOrThrow.mockResolvedValue({ ...request, status: 'submitted' });
    db.contextUseAudit.create.mockResolvedValue({ id: 'audit-3' });

    const result = await service.submitRequest(ROOM_ID, REQUEST_ID, { userId: 'user-a' });

    expect(db.chatAnalysisRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          selection_hash: request.selection_hash,
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
        }),
        data: { status: 'submitted', submitted_at: NOW },
      })
    );
    expect(result.status).toBe('submitted');
  });

  it('participant departure cancels every not-yet-processing request that requires them', async () => {
    const { db, service } = createService();
    db.chatAnalysisRequest.updateMany.mockResolvedValue({ count: 2 });

    const count = await service.cancelActiveForParticipantDeparture(
      db as unknown as Prisma.TransactionClient,
      ROOM_ID,
      PARTICIPANT_B,
      NOW,
    );

    expect(count).toBe(2);
    expect(db.chatAnalysisRequest.updateMany).toHaveBeenCalledWith({
      where: {
        room_id: ROOM_ID,
        required_participant_ids: { has: PARTICIPANT_B },
        status: { in: ['pending_approval', 'approved', 'submitted'] },
      },
      data: { status: 'cancelled', cancelled_at: NOW },
    });
  });
});
