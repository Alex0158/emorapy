import {
  applyMessageBatch,
  BACKFILL_TRANSACTION_OPTIONS,
  LEGACY_MESSAGE_BATCH_SQL,
  parseChatChannelBackfillArgs,
  runChatChannelBackfill,
} from '../../../scripts/backfill-chat-context-channels';
import type { ChatChannelBackfillDecision } from '../../../scripts/chat-channel-backfill-policy';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function backfillDecision(
  overrides: Partial<ChatChannelBackfillDecision>,
): ChatChannelBackfillDecision {
  return {
    messageId: 'message-shared',
    roomId: 'room-1',
    target: 'shared',
    privateOwnerParticipantId: null,
    reasonCode: 'shared_post_join',
    legacyReviewRequired: false,
    capsuleAction: 'none',
    historicalDisplayEligible: true,
    futureContextEligible: true,
    legacyAiSharedDisplayOnly: false,
    ...overrides,
  };
}

describe('backfill-chat-context-channels CLI', () => {
  it('persists display-only versus reusable context decisions with the channel assignment', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../scripts/backfill-chat-context-channels.ts'),
      'utf8',
    );
    expect(source).toContain('ai_context_eligible: target.aiContextEligible');
    expect(source).toContain("decision.futureContextEligible");
  });

  it('bulk-assigns multiple channel targets in one bounded transaction', async () => {
    const executeRaw = jest.fn().mockResolvedValue(2);
    const tx = {
      chatChannel: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'channel-shared',
            room_id: 'room-1',
            kind: 'shared',
            owner_participant_id: null,
          },
          {
            id: 'channel-private',
            room_id: 'room-1',
            kind: 'private',
            owner_participant_id: 'participant-a',
          },
        ]),
      },
      $executeRaw: executeRaw,
    };
    const transaction = jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await applyMessageBatch(
      { $transaction: transaction } as never,
      [
        backfillDecision({}),
        backfillDecision({
          messageId: 'message-private',
          target: 'private',
          privateOwnerParticipantId: 'participant-a',
          reasonCode: 'private_sender_owner_only',
          futureContextEligible: false,
        }),
      ],
    );

    expect(result).toEqual({
      rowsUpdated: 2,
      channelResolutionFailures: 0,
      channelsCreatedDuringMessageBatch: 0,
    });
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      BACKFILL_TRANSACTION_OPTIONS,
    );
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const query = executeRaw.mock.calls[0]?.[0] as {
      strings: string[];
      values: unknown[];
    };
    expect(query.strings.join('?')).toContain('jsonb_to_recordset');
    expect(query.strings.join('?')).toContain('message.channel_id IS NULL');
    expect(JSON.parse(query.values[0] as string)).toEqual(expect.arrayContaining([
      {
        message_id: 'message-shared',
        channel_id: 'channel-shared',
        ai_context_eligible: true,
      },
      {
        message_id: 'message-private',
        channel_id: 'channel-private',
        ai_context_eligible: false,
      },
    ]));
  });

  it('fails closed when apply leaves any message unclassified', async () => {
    const prisma = {
      chatMessage: {
        count: jest.fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1),
      },
      chatRoom: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRawUnsafe: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ mode: 'private_only', row_count: 1 }]),
    };

    const report = await runChatChannelBackfill(prisma as never, {
      apply: true,
      dryRun: false,
      batchSize: 250,
      target: 'production',
      confirmProduction: true,
      help: false,
    });

    expect(report.ok).toBe(false);
    expect(report.messages.remainingUnclassifiedRows).toBe(1);
  });

  it('treats an already-complete apply rerun as idempotent success', async () => {
    const prisma = {
      chatMessage: { count: jest.fn().mockResolvedValue(0) },
      chatRoom: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRawUnsafe: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ mode: 'private_only', row_count: 1 }]),
      $transaction: jest.fn(),
    };

    const report = await runChatChannelBackfill(prisma as never, {
      apply: true,
      dryRun: false,
      batchSize: 250,
      target: 'production',
      confirmProduction: true,
      help: false,
    });

    expect(report.ok).toBe(true);
    expect(report.messages.rowsUpdated).toBe(0);
    expect(report.messages.remainingUnclassifiedRows).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses only the unique active roleB join boundary, never historical MIN(joined_at)', () => {
    expect(LEGACY_MESSAGE_BATCH_SQL).toContain("AND is_active = true");
    expect(LEGACY_MESSAGE_BATCH_SQL).toContain('AND left_at IS NULL');
    expect(LEGACY_MESSAGE_BATCH_SQL).not.toMatch(/\b(?:m\.)?content\b/i);
    expect(LEGACY_MESSAGE_BATCH_SQL).toContain('COUNT(*)::integer AS candidate_count');
    expect(LEGACY_MESSAGE_BATCH_SQL).not.toMatch(
      /role_in_room = 'roleB'\s*\n\) role_b/,
    );
  });

  it('defaults to dry-run with a bounded batch size', () => {
    expect(parseChatChannelBackfillArgs([])).toEqual({
      apply: false,
      dryRun: true,
      batchSize: 250,
      target: 'local',
      confirmProduction: false,
      help: false,
    });
  });

  it('requires the explicit --apply switch before write mode', () => {
    expect(parseChatChannelBackfillArgs(['--apply', '--batch-size=50'])).toMatchObject({
      apply: true,
      dryRun: false,
      batchSize: 50,
    });
  });

  it('requires an additional confirmation for release and production apply', () => {
    expect(() => parseChatChannelBackfillArgs([
      '--apply',
      '--target=production',
    ])).toThrow('requires --confirm-production');

    expect(parseChatChannelBackfillArgs([
      '--apply',
      '--target=production',
      '--confirm-production',
    ])).toMatchObject({
      apply: true,
      target: 'production',
      confirmProduction: true,
    });
  });

  it('rejects ambiguous or unbounded modes', () => {
    expect(() => parseChatChannelBackfillArgs(['--apply', '--dry-run'])).toThrow(
      'cannot be combined',
    );
    expect(() => parseChatChannelBackfillArgs(['--batch-size=0'])).toThrow(
      'between 1 and 1000',
    );
    expect(() => parseChatChannelBackfillArgs(['--batch-size=1001'])).toThrow(
      'between 1 and 1000',
    );
    expect(() => parseChatChannelBackfillArgs(['--target=unknown'])).toThrow(
      'Invalid --target',
    );
    expect(() => parseChatChannelBackfillArgs(['--confirm-production'])).toThrow(
      'valid only with --apply',
    );
  });

  it('supports help without changing the default dry-run mode', () => {
    expect(parseChatChannelBackfillArgs(['--help'])).toMatchObject({
      help: true,
      apply: false,
      dryRun: true,
    });
  });
});
