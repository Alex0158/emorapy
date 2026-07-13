import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '../src/types/prisma-client';
import {
  buildBackfillEvidenceHash,
  CHAT_CHANNEL_BACKFILL_POLICY_VERSION,
  classifyLegacyChatMessage,
  type ChatChannelBackfillDecision,
  type ChatChannelBackfillDecisionSummary,
  type LegacyMessageBackfillInput,
  summarizeChatChannelBackfillDecisions,
} from './chat-channel-backfill-policy';

type MigrationTarget = 'local' | 'staging' | 'release' | 'production';

export type ChatChannelBackfillCliOptions = {
  apply: boolean;
  dryRun: boolean;
  batchSize: number;
  target: MigrationTarget;
  confirmProduction: boolean;
  help: boolean;
};

type LegacyMessageSqlRow = {
  message_id: string;
  room_id: string;
  room_exists: boolean;
  history_visibility_mode: string | null;
  visibility_scope: string;
  message_type: string;
  created_at: Date;
  sender_participant_id: string | null;
  sender_room_id: string | null;
  sender_participant_type: string | null;
  sender_role_in_room: string | null;
  role_b_joined_at: Date | null;
  active_role_b_candidate_count: number | bigint;
  role_a_owner_id: string | null;
  role_a_owner_candidate_count: number | bigint;
};

type PrivateContextModeSqlRow = {
  mode: string;
  row_count: number | bigint;
};

type ChannelProvisionSummary = {
  roomRowsScanned: number;
  sharedChannelsPlanned: number;
  privateChannelsPlanned: number;
  sharedChannelsCreated: number;
  privateChannelsCreated: number;
  invariantDriftRows: number;
  evidenceHash: string;
};

type MessageApplyResult = {
  rowsUpdated: number;
  channelResolutionFailures: number;
  channelsCreatedDuringMessageBatch: number;
};

const DEFAULT_BATCH_SIZE = 250;
const MAX_BATCH_SIZE = 1_000;

export const BACKFILL_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 60_000,
} as const;

export const LEGACY_MESSAGE_BATCH_SQL = `
SELECT
  m.id AS message_id,
  m.room_id,
  (r.id IS NOT NULL) AS room_exists,
  r.history_visibility_mode::text AS history_visibility_mode,
  m.visibility_scope::text AS visibility_scope,
  m.message_type::text AS message_type,
  m.created_at,
  p.id AS sender_participant_id,
  p.room_id AS sender_room_id,
  p.participant_type::text AS sender_participant_type,
  p.role_in_room::text AS sender_role_in_room,
  role_b.joined_at AS role_b_joined_at,
  role_b.candidate_count AS active_role_b_candidate_count,
  role_a.owner_id AS role_a_owner_id,
  role_a.candidate_count AS role_a_owner_candidate_count
FROM chat_messages m
LEFT JOIN chat_rooms r ON r.id = m.room_id
LEFT JOIN chat_participants p ON p.id = m.sender_participant_id
LEFT JOIN LATERAL (
  SELECT MIN(joined_at) AS joined_at, COUNT(*)::integer AS candidate_count
  FROM chat_participants
  WHERE room_id = m.room_id
    AND role_in_room = 'roleB'
    AND participant_type = 'user'
    AND is_active = true
    AND left_at IS NULL
) role_b ON TRUE
LEFT JOIN LATERAL (
  SELECT MIN(id) AS owner_id, COUNT(*)::integer AS candidate_count
  FROM chat_participants
  WHERE room_id = m.room_id
    AND participant_type = 'user'
    AND role_in_room = 'roleA'
) role_a ON TRUE
WHERE m.channel_id IS NULL
  AND ($1::text IS NULL OR m.id > $1::text)
ORDER BY m.id ASC
LIMIT $2
`;

function mergeCountMap(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, count] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + count;
  }
}

function emptyDecisionSummary(): ChatChannelBackfillDecisionSummary {
  return {
    scanned: 0,
    shared: 0,
    private: 0,
    quarantine: 0,
    legacyReviewRequired: 0,
    capsulesCreated: 0,
    legacyAiSharedDisplayOnly: 0,
    futureContextEligible: 0,
    quarantineByReason: {},
    orphanByReason: {},
  };
}

function mergeDecisionSummary(
  target: ChatChannelBackfillDecisionSummary,
  source: ChatChannelBackfillDecisionSummary,
): void {
  target.scanned += source.scanned;
  target.shared += source.shared;
  target.private += source.private;
  target.quarantine += source.quarantine;
  target.legacyReviewRequired += source.legacyReviewRequired;
  target.legacyAiSharedDisplayOnly += source.legacyAiSharedDisplayOnly;
  target.futureContextEligible += source.futureContextEligible;
  mergeCountMap(target.quarantineByReason, source.quarantineByReason);
  mergeCountMap(target.orphanByReason, source.orphanByReason);
}

function toSafeNumber(value: number | bigint): number {
  const result = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error('Database count exceeded the safe reporting range');
  }
  return result;
}

function mapLegacyMessageRow(row: LegacyMessageSqlRow): LegacyMessageBackfillInput {
  return {
    messageId: row.message_id,
    roomId: row.room_id,
    roomExists: row.room_exists,
    historyVisibilityMode: row.history_visibility_mode,
    visibilityScope: row.visibility_scope,
    messageType: row.message_type,
    createdAt: row.created_at,
    senderParticipantId: row.sender_participant_id,
    senderParticipantRoomId: row.sender_room_id,
    senderParticipantType: row.sender_participant_type,
    senderRoleInRoom: row.sender_role_in_room,
    roleBJoinedAt: row.role_b_joined_at,
    activeRoleBCandidateCount: toSafeNumber(row.active_role_b_candidate_count),
    roleAPrivateOwnerParticipantId: row.role_a_owner_id,
    roleAPrivateOwnerCandidateCount: toSafeNumber(row.role_a_owner_candidate_count),
  };
}

export function parseChatChannelBackfillArgs(argv: string[]): ChatChannelBackfillCliOptions {
  let apply = false;
  let explicitDryRun = false;
  let batchSize = DEFAULT_BATCH_SIZE;
  let target: MigrationTarget = 'local';
  let confirmProduction = false;
  let help = false;

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--dry-run') {
      explicitDryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      batchSize = Number(arg.slice('--batch-size='.length));
    } else if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length) as MigrationTarget;
    } else if (arg === '--confirm-production') {
      confirmProduction = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (apply && explicitDryRun) throw new Error('--apply and --dry-run cannot be combined');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error(`--batch-size must be an integer between 1 and ${MAX_BATCH_SIZE}`);
  }
  if (!['local', 'staging', 'release', 'production'].includes(target)) {
    throw new Error(`Invalid --target: ${target}`);
  }
  if (confirmProduction && !apply) {
    throw new Error('--confirm-production is valid only with --apply');
  }
  if (apply && ['release', 'production'].includes(target) && !confirmProduction) {
    throw new Error('Release/production apply requires --confirm-production');
  }

  return {
    apply,
    dryRun: !apply,
    batchSize,
    target,
    confirmProduction,
    help,
  };
}

export function printChatChannelBackfillHelp(): void {
  console.log(`Usage: npm --prefix backend run ops:chat-context:backfill -- [options]

Default mode is dry-run. Database writes are impossible unless --apply is present.

Options:
  --dry-run                         Explicit read-only planning mode (default).
  --apply                           Apply only classified, non-quarantined rows.
  --batch-size=<1-${MAX_BATCH_SIZE}>          Rows per read/transaction batch (default ${DEFAULT_BATCH_SIZE}).
  --target=local|staging|release|production
  --confirm-production              Required with --apply for release/production.
  --help, -h                        Show this help without connecting to a database.

Privacy: the tool never selects or prints message content. Reports contain counts and SHA-256 evidence only.
Legacy summary_only rows remain private and are counted for owner review; no ContextCapsule is auto-created.
`);
}

async function provisionChatChannels(
  prisma: PrismaClient,
  options: ChatChannelBackfillCliOptions,
): Promise<ChannelProvisionSummary> {
  let cursor: string | undefined;
  let roomRowsScanned = 0;
  let sharedChannelsPlanned = 0;
  let privateChannelsPlanned = 0;
  let sharedChannelsCreated = 0;
  let privateChannelsCreated = 0;
  let invariantDriftRows = 0;
  const batchHashes: string[] = [];

  while (true) {
    const rooms = await prisma.chatRoom.findMany({
      where: cursor ? { id: { gt: cursor } } : undefined,
      select: {
        id: true,
        participants: {
          where: {
            participant_type: 'user',
            role_in_room: { in: ['roleA', 'roleB'] },
          },
          select: { id: true },
        },
        channels: {
          select: { kind: true, owner_participant_id: true },
        },
      },
      orderBy: { id: 'asc' },
      take: options.batchSize,
    });
    if (rooms.length === 0) break;

    roomRowsScanned += rooms.length;
    const missingShared: Array<{ id: string; room_id: string; kind: 'shared' }> = [];
    const missingPrivate: Array<{
      id: string;
      room_id: string;
      kind: 'private';
      owner_participant_id: string;
    }> = [];
    const evidence: string[] = [];

    for (const room of rooms) {
      const sharedChannels = room.channels.filter((channel) => channel.kind === 'shared');
      if (sharedChannels.length > 1) invariantDriftRows += sharedChannels.length - 1;
      if (sharedChannels.length === 0) {
        missingShared.push({ id: randomUUID(), room_id: room.id, kind: 'shared' });
        evidence.push(`${room.id}:shared`);
      }

      for (const participant of room.participants) {
        const privateChannels = room.channels.filter((channel) => (
          channel.kind === 'private' && channel.owner_participant_id === participant.id
        ));
        if (privateChannels.length > 1) invariantDriftRows += privateChannels.length - 1;
        if (privateChannels.length === 0) {
          missingPrivate.push({
            id: randomUUID(),
            room_id: room.id,
            kind: 'private',
            owner_participant_id: participant.id,
          });
          evidence.push(`${room.id}:private:${participant.id}`);
        }
      }
    }

    sharedChannelsPlanned += missingShared.length;
    privateChannelsPlanned += missingPrivate.length;
    batchHashes.push(createHash('sha256').update(evidence.sort().join('\u001e')).digest('hex'));

    if (options.apply && (missingShared.length > 0 || missingPrivate.length > 0)) {
      const created = await prisma.$transaction(
        async (tx) => {
          const shared = missingShared.length > 0
            ? await tx.chatChannel.createMany({ data: missingShared, skipDuplicates: true })
            : { count: 0 };
          const privateChannels = missingPrivate.length > 0
            ? await tx.chatChannel.createMany({ data: missingPrivate, skipDuplicates: true })
            : { count: 0 };
          return { shared: shared.count, private: privateChannels.count };
        },
        BACKFILL_TRANSACTION_OPTIONS,
      );
      sharedChannelsCreated += created.shared;
      privateChannelsCreated += created.private;
    }

    cursor = rooms[rooms.length - 1]?.id;
  }

  return {
    roomRowsScanned,
    sharedChannelsPlanned,
    privateChannelsPlanned,
    sharedChannelsCreated,
    privateChannelsCreated,
    invariantDriftRows,
    evidenceHash: createHash('sha256').update(batchHashes.join('\u001e')).digest('hex'),
  };
}

export async function applyMessageBatch(
  prisma: PrismaClient,
  decisions: ChatChannelBackfillDecision[],
): Promise<MessageApplyResult> {
  const classified = decisions.filter((decision) => decision.target !== 'quarantine');
  if (classified.length === 0) {
    return { rowsUpdated: 0, channelResolutionFailures: 0, channelsCreatedDuringMessageBatch: 0 };
  }

  return prisma.$transaction(
    async (tx) => {
      const sharedRoomIds = [...new Set(
        classified.filter((decision) => decision.target === 'shared').map((decision) => decision.roomId),
      )];
      const privateTargets = [...new Map(
        classified
          .filter((decision) => decision.target === 'private' && decision.privateOwnerParticipantId)
          .map((decision) => [
            `${decision.roomId}\u001f${decision.privateOwnerParticipantId}`,
            {
              roomId: decision.roomId,
              ownerParticipantId: decision.privateOwnerParticipantId as string,
            },
          ]),
      ).values()];

      const sharedCreate = sharedRoomIds.map((roomId) => ({
        id: randomUUID(),
        room_id: roomId,
        kind: 'shared' as const,
      }));
      const privateCreate = privateTargets.map((target) => ({
        id: randomUUID(),
        room_id: target.roomId,
        kind: 'private' as const,
        owner_participant_id: target.ownerParticipantId,
      }));

      const sharedCreated = sharedCreate.length > 0
        ? await tx.chatChannel.createMany({ data: sharedCreate, skipDuplicates: true })
        : { count: 0 };
      const privateCreated = privateCreate.length > 0
        ? await tx.chatChannel.createMany({ data: privateCreate, skipDuplicates: true })
        : { count: 0 };

      const roomIds = [...new Set(classified.map((decision) => decision.roomId))];
      const channels = await tx.chatChannel.findMany({
        where: { room_id: { in: roomIds } },
        select: { id: true, room_id: true, kind: true, owner_participant_id: true },
        orderBy: { id: 'asc' },
      });
      const sharedByRoom = new Map(
        channels
          .filter((channel) => channel.kind === 'shared')
          .map((channel) => [channel.room_id, channel.id]),
      );
      const privateByOwner = new Map(
        channels
          .filter((channel) => channel.kind === 'private' && channel.owner_participant_id)
          .map((channel) => [
            `${channel.room_id}\u001f${channel.owner_participant_id}`,
            channel.id,
          ]),
      );

      const messageTargets = new Map<string, {
        channelId: string;
        aiContextEligible: boolean;
        messageIds: string[];
      }>();
      let channelResolutionFailures = 0;
      for (const decision of classified) {
        const channelId = decision.target === 'shared'
          ? sharedByRoom.get(decision.roomId)
          : privateByOwner.get(`${decision.roomId}\u001f${decision.privateOwnerParticipantId}`);
        if (!channelId) {
          channelResolutionFailures += 1;
          continue;
        }
        const aiContextEligible = decision.futureContextEligible;
        const targetKey = `${channelId}\u001f${aiContextEligible ? 'eligible' : 'display-only'}`;
        const target = messageTargets.get(targetKey) ?? {
          channelId,
          aiContextEligible,
          messageIds: [],
        };
        target.messageIds.push(decision.messageId);
        messageTargets.set(targetKey, target);
      }

      const assignments = [...messageTargets.values()].flatMap((target) => (
        target.messageIds.map((messageId) => ({
          message_id: messageId,
          channel_id: target.channelId,
          ai_context_eligible: target.aiContextEligible,
        }))
      ));
      const rowsUpdated = assignments.length > 0
        ? await tx.$executeRaw(Prisma.sql`
            UPDATE "chat_messages" AS message
            SET
              "channel_id" = assignment.channel_id,
              "ai_context_eligible" = assignment.ai_context_eligible
            FROM jsonb_to_recordset(${JSON.stringify(assignments)}::jsonb) AS assignment(
              message_id text,
              channel_id text,
              ai_context_eligible boolean
            )
            WHERE message.id = assignment.message_id
              AND message.channel_id IS NULL
          `)
        : 0;

      return {
        rowsUpdated,
        channelResolutionFailures,
        channelsCreatedDuringMessageBatch: sharedCreated.count + privateCreated.count,
      };
    },
    BACKFILL_TRANSACTION_OPTIONS,
  );
}

async function readPrivateContextModeCounts(prisma: PrismaClient): Promise<Record<string, number>> {
  const rows = await prisma.$queryRawUnsafe<PrivateContextModeSqlRow[]>(`
    SELECT private_context_use_mode::text AS mode, COUNT(*)::bigint AS row_count
    FROM chat_participants
    GROUP BY private_context_use_mode
    ORDER BY private_context_use_mode::text ASC
  `);

  return Object.fromEntries(rows.map((row) => [row.mode, toSafeNumber(row.row_count)]));
}

export async function runChatChannelBackfill(
  prisma: PrismaClient,
  options: ChatChannelBackfillCliOptions,
) {
  const generatedAt = new Date().toISOString();
  const initialUnclassifiedRows = await prisma.chatMessage.count({ where: { channel_id: null } });
  const channelProvision = await provisionChatChannels(prisma, options);
  const decisionTotals = emptyDecisionSummary();
  const messageBatchEvidenceHashes: string[] = [];
  let cursor: string | null = null;
  let messageBatchCount = 0;
  let rowsUpdated = 0;
  let channelResolutionFailures = 0;
  let channelsCreatedDuringMessageBatches = 0;

  while (true) {
    const rows: LegacyMessageSqlRow[] = await prisma.$queryRawUnsafe<LegacyMessageSqlRow[]>(
      LEGACY_MESSAGE_BATCH_SQL,
      cursor,
      options.batchSize,
    );
    if (rows.length === 0) break;

    const decisions = rows.map(mapLegacyMessageRow).map(classifyLegacyChatMessage);
    mergeDecisionSummary(decisionTotals, summarizeChatChannelBackfillDecisions(decisions));
    messageBatchEvidenceHashes.push(buildBackfillEvidenceHash(decisions));
    messageBatchCount += 1;

    if (options.apply) {
      const applied = await applyMessageBatch(prisma, decisions);
      rowsUpdated += applied.rowsUpdated;
      channelResolutionFailures += applied.channelResolutionFailures;
      channelsCreatedDuringMessageBatches += applied.channelsCreatedDuringMessageBatch;
    }

    cursor = rows[rows.length - 1]?.message_id ?? null;
  }

  const remainingUnclassifiedRows = await prisma.chatMessage.count({ where: { channel_id: null } });
  const privateContextUseModes = await readPrivateContextModeCounts(prisma);
  const unknownPrivateContextModes = Object.entries(privateContextUseModes)
    .filter(([mode]) => !['private_only', 'shared_process_controls'].includes(mode))
    .reduce((total, [, count]) => total + count, 0);
  const messageEvidenceHash = createHash('sha256')
    .update(messageBatchEvidenceHashes.join('\u001e'))
    .digest('hex');
  const ok = decisionTotals.quarantine === 0
    && channelProvision.invariantDriftRows === 0
    && channelResolutionFailures === 0
    && unknownPrivateContextModes === 0
    && (!options.apply || remainingUnclassifiedRows === 0);

  return {
    check: 'chat-context-channel-backfill',
    ok,
    mode: options.apply ? 'apply' : 'dry-run',
    target: options.target,
    policyVersion: CHAT_CHANNEL_BACKFILL_POLICY_VERSION,
    batchSize: options.batchSize,
    generatedAt,
    messages: {
      initialUnclassifiedRows,
      ...decisionTotals,
      eligibleForWrite: decisionTotals.shared + decisionTotals.private,
      rowsUpdated,
      channelResolutionFailures,
      remainingUnclassifiedRows,
      batchCount: messageBatchCount,
      evidenceHash: messageEvidenceHash,
    },
    channels: {
      ...channelProvision,
      createdDuringMessageBatches: channelsCreatedDuringMessageBatches,
    },
    contextCapsules: {
      legacyReviewRequiredCandidates: decisionTotals.legacyReviewRequired,
      automaticallyCreated: 0,
      policy: 'owner_must_regenerate_review_and_approve',
    },
    privateContextUseMode: {
      counts: privateContextUseModes,
      unknownRows: unknownPrivateContextModes,
      rowsChanged: 0,
      policy: 'preserve_existing_never_auto_opt_in',
    },
  };
}

function loadLocalEnvironment(): void {
  try {
    require('dotenv').config();
  } catch {
    // dotenv is optional in stripped migration runners.
  }
}

function createPrismaClient(): PrismaClient {
  const { PrismaClient: RuntimePrismaClient } = require('../src/types/prisma-client') as {
    PrismaClient: new () => PrismaClient;
  };
  return new RuntimePrismaClient();
}

async function main(): Promise<void> {
  const options = parseChatChannelBackfillArgs(process.argv.slice(2));
  if (options.help) {
    printChatChannelBackfillHelp();
    return;
  }

  loadLocalEnvironment();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required; the value and host are never printed');
  }

  const prisma = createPrismaClient();
  try {
    const report = await runChatChannelBackfill(prisma, options);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      '[chat-context-channel-backfill] failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
