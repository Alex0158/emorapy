import type { Prisma, PrismaClient } from '@prisma/client';
import type { ChatActorAccessService } from '../../../src/services/chat-actor-access.service';
import { ChatContextUsageReceiptService } from '../../../src/services/chat-context-usage-receipt.service';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {},
}));

const ROOM_ID = 'room-1';
const PARTICIPANT_ID = 'participant-a';
const NOW = new Date('2026-07-13T12:00:00.000Z');

function createService() {
  const holder: { current?: Prisma.TransactionClient } = {};
  const db = {
    contextUseAudit: { findMany: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(holder.current as Prisma.TransactionClient)
    ),
  };
  holder.current = db as unknown as Prisma.TransactionClient;
  const actorAccess = {
    resolveActiveHumanParticipant: jest.fn().mockResolvedValue({
      participant: { id: PARTICIPANT_ID },
      room: { id: ROOM_ID },
    }),
  };
  return {
    actorAccess,
    db,
    service: new ChatContextUsageReceiptService(
      db as unknown as PrismaClient,
      actorAccess as unknown as Pick<
        ChatActorAccessService,
        'resolveActiveHumanParticipant'
      >
    ),
  };
}

function auditRecord(overrides: Record<string, unknown> = {}) {
  return {
    actor_participant_id: PARTICIPANT_ID,
    purpose: 'formal_analysis_evidence',
    decision: 'allowed',
    reason_code: 'context_authorization_granted',
    source_refs: [
      {
        kind: 'context_capsule',
        id: 'private-capsule-id',
        version: 2,
        content_hash: 'a'.repeat(64),
      },
    ],
    authorization_refs: [
      {
        id: 'private-authorization-id',
        capsule_id: 'private-capsule-id',
        capsule_content_hash: 'a'.repeat(64),
      },
    ],
    policy_version: '2026-07-12.v1',
    prompt_version: null,
    created_at: NOW,
    ...overrides,
  };
}

describe('ChatContextUsageReceiptService', () => {
  it('returns only the actor receipts and explicitly ownerless room aggregate receipts', async () => {
    const { actorAccess, db, service } = createService();
    db.contextUseAudit.findMany.mockResolvedValue([
      auditRecord(),
      auditRecord({
        actor_participant_id: null,
        purpose: 'shared_mediation',
        reason_code: 'approved_capsule_exact_authorization',
        source_refs: ['private-capsule-id'],
        authorization_refs: ['private-authorization-id'],
        prompt_version: 'chat-room-prompt-v1',
      }),
      auditRecord({ actor_participant_id: 'participant-b' }),
    ]);

    const result = await service.listOwnerReceipts(ROOM_ID, { userId: 'user-a' });

    expect(actorAccess.resolveActiveHumanParticipant).toHaveBeenCalledWith(
      ROOM_ID,
      { userId: 'user-a' },
      db
    );
    expect(db.contextUseAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          room_id: ROOM_ID,
          OR: [
            { actor_participant_id: PARTICIPANT_ID },
            { actor_participant_id: null },
          ],
        },
        take: 100,
      })
    );
    expect(result).toEqual([
      {
        scope: 'actor',
        purpose: 'formal_analysis_evidence',
        decision: 'allowed',
        category: 'authorization',
        source_type_counts: {
          chat_message: 0,
          context_capsule: 1,
          personal_memory: 0,
          joint_memory: 0,
          formal_evidence: 0,
        },
        authorization_count: 1,
        policy_version: '2026-07-12.v1',
        prompt_version: null,
        created_at: NOW.toISOString(),
      },
      {
        scope: 'room_aggregate',
        purpose: 'shared_mediation',
        decision: 'allowed',
        category: 'shared_mediation_use',
        source_type_counts: {
          chat_message: 0,
          context_capsule: 1,
          personal_memory: 0,
          joint_memory: 0,
          formal_evidence: 0,
        },
        authorization_count: 1,
        policy_version: '2026-07-12.v1',
        prompt_version: 'chat-room-prompt-v1',
        created_at: NOW.toISOString(),
      },
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(
      /participant-|private-capsule|private-authorization|reason_code|lineage|topic/
    );
    expect(serialized).not.toContain('a'.repeat(64));
  });

  it('fails closed for unknown/internal reasons and malformed source payloads', async () => {
    const { db, service } = createService();
    db.contextUseAudit.findMany.mockResolvedValue([
      auditRecord({ reason_code: 'internal_experiment_probe' }),
      auditRecord({
        source_refs: [
          {
            kind: 'context_capsule',
            id: 'capsule-1',
            content_hash: 'a'.repeat(64),
            raw_content: 'must never escape',
          },
        ],
      }),
      auditRecord({
        actor_participant_id: null,
        reason_code: 'owner_strategy_compilation_requested',
        purpose: 'shared_mediation_adaptation',
        source_refs: ['private-message-id'],
        authorization_refs: [],
      }),
    ]);

    await expect(
      service.listOwnerReceipts(ROOM_ID, { userId: 'user-a' })
    ).resolves.toEqual([]);
  });
});
