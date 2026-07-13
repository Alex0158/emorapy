import type { PrismaClient } from '@prisma/client';
import {
  computeAnalysisSelectionHash,
  textSha256,
} from '../../../src/utils/chat-context-validation';

const mockResolveActiveHumanParticipant = jest.fn();
const mockVerifyRequestSources = jest.fn();

jest.mock('../../../src/services/chat-actor-access.service', () => ({
  chatActorAccessService: {
    resolveActiveHumanParticipant: (...args: unknown[]) => (
      mockResolveActiveHumanParticipant(...args)
    ),
  },
}));

jest.mock('../../../src/services/chat-analysis-selection.validator', () => {
  const actual = jest.requireActual<typeof import('../../../src/services/chat-analysis-selection.validator')>(
    '../../../src/services/chat-analysis-selection.validator',
  );
  return {
    ...actual,
    chatAnalysisSelectionValidator: {
      verifyRequestSources: (...args: unknown[]) => mockVerifyRequestSources(...args),
    },
  };
});

import { ChatAnalysisEvidenceService } from '../../../src/services/chat-analysis-evidence.service';

const ROOM_ID = '550e8400-e29b-41d4-a716-446655440000';
const REQUEST_ID = '550e8400-e29b-41d4-a716-446655440001';
const PARTICIPANT_A = '550e8400-e29b-41d4-a716-446655440002';
const PARTICIPANT_B = '550e8400-e29b-41d4-a716-446655440003';
const MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440004';
const FUTURE = new Date('2099-01-01T00:00:00.000Z');

function createDbMock() {
  const db = {
    chatAnalysisRequest: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    chatMessage: { findMany: jest.fn() },
    contextCapsule: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => (
    callback(db)
  ));
  return db;
}

function approval(participantId: string, selectionHash = 'selection-hash-v1') {
  return {
    id: `approval-${participantId}`,
    participant_id: participantId,
    decision: 'approved',
    selection_hash: selectionHash,
    policy_version: 'chat-analysis-policy@v1',
    revoked_at: null,
    expires_at: FUTURE,
  };
}

function submittedRequest(
  approvals: Array<ReturnType<typeof approval>>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: REQUEST_ID,
    room_id: ROOM_ID,
    requested_by_participant_id: PARTICIPANT_A,
    status: 'submitted',
    selection_snapshot: { message_refs: [], capsule_refs: [] },
    selection_hash: 'selection-hash-v1',
    policy_version: 'chat-analysis-policy@v1',
    participant_approvals: approvals,
    ...overrides,
  };
}

function consumedProcessingMessageRequest(content = 'approved roleB content') {
  const selectionSnapshot = {
    message_refs: [{
      kind: 'chat_message' as const,
      id: MESSAGE_ID,
      content_hash: textSha256(content),
    }],
    capsule_refs: [],
  };
  const requiredParticipantIds = [PARTICIPANT_A, PARTICIPANT_B].sort();
  const policyVersion = 'chat-analysis-policy@v1';
  const selectionHash = computeAnalysisSelectionHash({
    policyVersion,
    requiredParticipantIds,
    roomId: ROOM_ID,
    selectionSnapshot,
  });
  const past = new Date('2020-01-01T00:00:00.000Z');
  const approvals = requiredParticipantIds.map(participantId => ({
    ...approval(participantId, selectionHash),
    id: `consumed-${participantId}`,
    policy_version: policyVersion,
    revoked_at: past,
    expires_at: past,
  }));
  return {
    request: {
      id: REQUEST_ID,
      room_id: ROOM_ID,
      requested_by_participant_id: PARTICIPANT_A,
      status: 'processing',
      selection_snapshot: selectionSnapshot,
      selection_hash: selectionHash,
      required_participant_ids: requiredParticipantIds,
      policy_version: policyVersion,
      expires_at: past,
      participant_approvals: approvals,
    },
    conversionSnapshot: {
      included_message_ids: [MESSAGE_ID],
      analysis_request: {
        id: REQUEST_ID,
        selection_hash: selectionHash,
        policy_version: policyVersion,
        approval_ids: approvals.map(candidate => candidate.id).sort(),
        capsule_ids: [],
        capsule_content_hashes: [],
      },
    },
  };
}

describe('ChatAnalysisEvidenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveActiveHumanParticipant.mockResolvedValue({
      participant: { id: PARTICIPANT_A },
    });
  });

  it('rejects a participant who is not the analysis request owner', async () => {
    const db = createDbMock();
    const service = new ChatAnalysisEvidenceService(db as unknown as PrismaClient);
    mockResolveActiveHumanParticipant.mockResolvedValueOnce({
      participant: { id: PARTICIPANT_B },
    });
    db.chatAnalysisRequest.findFirst.mockResolvedValueOnce(
      submittedRequest([approval(PARTICIPANT_A), approval(PARTICIPANT_B)]),
    );

    await expect(service.resolveSubmitted(
      ROOM_ID,
      REQUEST_ID,
      { userId: 'user-b' },
    )).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(mockVerifyRequestSources).not.toHaveBeenCalled();
  });

  it('rejects a message whose content no longer matches the approved hash', async () => {
    const db = createDbMock();
    const service = new ChatAnalysisEvidenceService(db as unknown as PrismaClient);
    db.chatAnalysisRequest.findFirst.mockResolvedValueOnce(
      submittedRequest([approval(PARTICIPANT_A)]),
    );
    mockVerifyRequestSources.mockResolvedValueOnce({
      snapshot: {
        message_refs: [
          {
            kind: 'chat_message',
            id: MESSAGE_ID,
            content_hash: textSha256('approved content'),
          },
        ],
        capsule_refs: [],
      },
      requiredParticipantIds: [PARTICIPANT_A],
      sharedHistoryAudience: {
        participant: { id: PARTICIPANT_A, role_in_room: 'roleA', joined_at: FUTURE },
        historyVisibilityMode: 'share_summary_only',
      },
    });
    db.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: MESSAGE_ID,
        content: 'mutated content',
        sender_participant_id: PARTICIPANT_A,
        created_at: new Date('2026-07-12T12:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);

    await expect(service.resolveSubmitted(
      ROOM_ID,
      REQUEST_ID,
      { userId: 'user-a' },
    )).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects when any required participant lacks an exact active approval', async () => {
    const db = createDbMock();
    const service = new ChatAnalysisEvidenceService(db as unknown as PrismaClient);
    db.chatAnalysisRequest.findFirst.mockResolvedValueOnce(
      submittedRequest([approval(PARTICIPANT_A)]),
    );
    mockVerifyRequestSources.mockResolvedValueOnce({
      snapshot: { message_refs: [], capsule_refs: [] },
      requiredParticipantIds: [PARTICIPANT_A, PARTICIPANT_B],
    });

    await expect(service.resolveSubmitted(
      ROOM_ID,
      REQUEST_ID,
      { userId: 'user-a' },
    )).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(db.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it('revalidates exact sources/approvals in the same transaction that claims processing', async () => {
    const db = createDbMock();
    const service = new ChatAnalysisEvidenceService(db as unknown as PrismaClient);
    db.chatAnalysisRequest.findFirst.mockResolvedValueOnce(
      submittedRequest([approval(PARTICIPANT_A)]),
    );
    mockVerifyRequestSources.mockResolvedValueOnce({
      snapshot: { message_refs: [], capsule_refs: [] },
      requiredParticipantIds: [PARTICIPANT_A],
    });
    db.chatAnalysisRequest.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await service.claimSubmittedForProcessing(
      ROOM_ID,
      REQUEST_ID,
      { userId: 'user-a' },
      'selection-hash-v1',
    );
    await service.markCompleted(REQUEST_ID);

    expect(db.chatAnalysisRequest.updateMany.mock.calls).toEqual([
      [{
        where: {
          id: REQUEST_ID,
          room_id: ROOM_ID,
          selection_hash: 'selection-hash-v1',
          policy_version: 'chat-analysis-policy@v1',
          status: 'submitted',
        },
        data: { status: 'processing' },
      }],
      [{
        where: { id: REQUEST_ID, status: { in: ['submitted', 'processing'] } },
        data: { status: 'completed' },
      }],
    ]);
    expect(mockVerifyRequestSources).toHaveBeenCalledTimes(1);
  });

  it('rejects an unrelated analysis request when retry is bound to the original request', async () => {
    const db = createDbMock();
    const service = new ChatAnalysisEvidenceService(db as unknown as PrismaClient);

    await expect(service.claimCaseGeneration({
      roomId: ROOM_ID,
      hasDefendantMaterial: true,
      expectedRequestId: '550e8400-e29b-41d4-a716-446655440099',
      conversionSnapshot: {
        included_message_ids: [],
        analysis_request: {
          id: REQUEST_ID,
          selection_hash: 'selection-hash-v1',
          policy_version: 'chat-analysis-policy@v1',
          approval_ids: [`approval-${PARTICIPANT_A}`],
          capsule_ids: [],
          capsule_content_hashes: [],
        },
      },
    }, { userId: 'user-a' })).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(db.chatAnalysisRequest.findFirst).not.toHaveBeenCalled();
  });

  it('fails closed when a chat-derived defendant statement has no original analysis reference', async () => {
    const db = createDbMock();
    const service = new ChatAnalysisEvidenceService(db as unknown as PrismaClient);

    await expect(service.claimCaseGeneration({
      roomId: ROOM_ID,
      hasDefendantMaterial: true,
      conversionSnapshot: {
        roleB_messages: 1,
        included_message_ids: [MESSAGE_ID],
        analysis_request: null,
      },
    }, { userId: 'user-a' })).rejects.toMatchObject({
      code: 'CASE_NOT_READY',
      details: { reason_code: 'CHAT_ANALYSIS_APPROVAL_REQUIRED' },
    });
  });

  it('rejects a cancelled/revoked request before direct Judgment retry can reuse the case', async () => {
    const db = createDbMock();
    const service = new ChatAnalysisEvidenceService(db as unknown as PrismaClient);
    db.chatAnalysisRequest.findFirst.mockResolvedValueOnce(
      submittedRequest([approval(PARTICIPANT_A)], { status: 'cancelled' }),
    );

    await expect(service.claimCaseGeneration({
      roomId: ROOM_ID,
      hasDefendantMaterial: true,
      conversionSnapshot: {
        included_message_ids: [],
        analysis_request: {
          id: REQUEST_ID,
          selection_hash: 'selection-hash-v1',
          policy_version: 'chat-analysis-policy@v1',
          approval_ids: [`approval-${PARTICIPANT_A}`],
          capsule_ids: [],
          capsule_content_hashes: [],
        },
      },
    }, { userId: 'user-a' })).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(mockVerifyRequestSources).not.toHaveBeenCalled();
  });

  it('recovers an exact processing request after approvals expire/revoke and roleB departs', async () => {
    const db = createDbMock();
    const service = new ChatAnalysisEvidenceService(db as unknown as PrismaClient);
    const consumed = consumedProcessingMessageRequest();
    db.chatAnalysisRequest.findFirst
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce(consumed.request);
    db.chatMessage.findMany.mockResolvedValueOnce([{
      id: MESSAGE_ID,
      content: 'approved roleB content',
      sender_participant_id: PARTICIPANT_B,
      created_at: new Date('2026-07-12T12:00:00.000Z'),
      // The original B participant is now departed/inactive; recovery uses the
      // immutable original sender identity rather than current membership.
      sender_participant: { role_in_room: 'roleB', is_active: false, left_at: FUTURE },
    }]);

    const evidence = await service.claimCaseGeneration({
      roomId: ROOM_ID,
      hasDefendantMaterial: true,
      conversionSnapshot: consumed.conversionSnapshot,
      expectedRequestId: REQUEST_ID,
    }, { userId: 'user-a' });

    expect(evidence).toMatchObject({
      requestId: REQUEST_ID,
      approvalIds: consumed.conversionSnapshot.analysis_request.approval_ids,
      messages: [{ id: MESSAGE_ID, senderRole: 'roleB' }],
    });
    expect(mockVerifyRequestSources).not.toHaveBeenCalled();
    expect(db.chatMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ sender_participant: expect.anything() }),
    }));
  });

  it('fails closed when a consumed processing raw source no longer matches its hash', async () => {
    const db = createDbMock();
    const service = new ChatAnalysisEvidenceService(db as unknown as PrismaClient);
    const consumed = consumedProcessingMessageRequest();
    db.chatAnalysisRequest.findFirst
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce(consumed.request);
    db.chatMessage.findMany.mockResolvedValueOnce([{
      id: MESSAGE_ID,
      content: 'tampered after processing',
      sender_participant_id: PARTICIPANT_B,
      created_at: new Date('2026-07-12T12:00:00.000Z'),
      sender_participant: { role_in_room: 'roleB' },
    }]);

    await expect(service.claimCaseGeneration({
      roomId: ROOM_ID,
      hasDefendantMaterial: true,
      conversionSnapshot: consumed.conversionSnapshot,
      expectedRequestId: REQUEST_ID,
    }, { userId: 'user-a' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
