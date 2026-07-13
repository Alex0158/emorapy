import { createHash } from 'node:crypto';
import type { PrismaClient } from '../src/types/prisma-client';

type AuditTarget = 'local' | 'staging' | 'release' | 'production';

export type LegacyPrivacyAuditCliOptions = {
  target: AuditTarget;
  topKeys: number;
  statementTimeoutMs: number;
  help: boolean;
  readOnly: true;
};

type CountValue = number | bigint;

export type ProfileSnapshotSummarySqlRow = {
  snapshot_count: CountValue;
  user_count: CountValue;
  case_count: CountValue;
  root_object_count: CountValue;
  root_array_count: CountValue;
  root_scalar_count: CountValue;
};

export type ProfileSnapshotKeySqlRow = {
  key_name: string;
  value_type: string;
  depth: number;
  occurrences: CountValue;
  snapshot_count: CountValue;
};

export type ProfileSnapshotRiskSqlRow = {
  raw_like_key_occurrences: CountValue;
  snapshots_with_raw_like_keys: CountValue;
  long_string_occurrences: CountValue;
  snapshots_with_long_strings: CountValue;
  very_long_string_occurrences: CountValue;
  oversized_array_occurrences: CountValue;
  max_depth_seen: number | null;
  truncated_container_occurrences: CountValue;
};

type GroupedCountSqlRow = {
  category_a: string | null;
  category_b: string | null;
  category_c: string | null;
  row_count: CountValue;
};

type OrphanCountSqlRow = {
  message_room_orphans: CountValue;
  message_sender_orphans: CountValue;
  channel_owner_orphans: CountValue;
  channel_owner_room_mismatches: CountValue;
  capsule_owner_orphans: CountValue;
  capsule_source_channel_orphans: CountValue;
  capsule_room_mismatches: CountValue;
};

type ActiveParticipantDuplicateSqlRow = {
  role_in_room: string;
  duplicate_group_count: CountValue;
};

type ActiveAuthorizationDuplicateSqlRow = {
  duplicate_group_count: CountValue;
};

const DEFAULT_TOP_KEYS = 100;
const MAX_TOP_KEYS = 500;
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;
const MAX_STATEMENT_TIMEOUT_MS = 120_000;
const MAX_JSON_DEPTH = 12;
const RAW_LIKE_KEY_PATTERN =
  '(raw|narrative|transcript|message|content|conversation|dialog|answer|response|statement|clinical_note|evidence)';

const PROFILE_SNAPSHOT_SUMMARY_SQL = `
SELECT
  COUNT(*)::bigint AS snapshot_count,
  COUNT(DISTINCT user_id)::bigint AS user_count,
  COUNT(DISTINCT case_id)::bigint AS case_count,
  COUNT(*) FILTER (WHERE jsonb_typeof(snapshot_data) = 'object')::bigint AS root_object_count,
  COUNT(*) FILTER (WHERE jsonb_typeof(snapshot_data) = 'array')::bigint AS root_array_count,
  COUNT(*) FILTER (
    WHERE jsonb_typeof(snapshot_data) NOT IN ('object', 'array')
  )::bigint AS root_scalar_count
FROM profile_snapshots
`;

const PROFILE_SNAPSHOT_KEY_STATS_SQL = `
WITH RECURSIVE json_nodes AS (
  SELECT
    ps.id AS snapshot_id,
    ps.snapshot_data AS node_value,
    NULL::text AS key_name,
    0 AS depth
  FROM profile_snapshots ps

  UNION ALL

  SELECT
    parent.snapshot_id,
    child.node_value,
    child.key_name,
    parent.depth + 1
  FROM json_nodes parent
  CROSS JOIN LATERAL (
    SELECT object_item.key AS key_name, object_item.value AS node_value
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(parent.node_value) = 'object'
        THEN parent.node_value ELSE '{}'::jsonb END
    ) object_item
    UNION ALL
    SELECT NULL::text AS key_name, array_item.value AS node_value
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(parent.node_value) = 'array'
        THEN parent.node_value ELSE '[]'::jsonb END
    ) array_item
  ) child
  WHERE parent.depth < ${MAX_JSON_DEPTH}
)
SELECT
  key_name,
  jsonb_typeof(node_value) AS value_type,
  depth,
  COUNT(*)::bigint AS occurrences,
  COUNT(DISTINCT snapshot_id)::bigint AS snapshot_count
FROM json_nodes
WHERE key_name IS NOT NULL
GROUP BY key_name, jsonb_typeof(node_value), depth
ORDER BY occurrences DESC, depth ASC
LIMIT $1
`;

const PROFILE_SNAPSHOT_RISK_SQL = `
WITH RECURSIVE json_nodes AS (
  SELECT
    ps.id AS snapshot_id,
    ps.snapshot_data AS node_value,
    NULL::text AS key_name,
    0 AS depth
  FROM profile_snapshots ps

  UNION ALL

  SELECT
    parent.snapshot_id,
    child.node_value,
    child.key_name,
    parent.depth + 1
  FROM json_nodes parent
  CROSS JOIN LATERAL (
    SELECT object_item.key AS key_name, object_item.value AS node_value
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(parent.node_value) = 'object'
        THEN parent.node_value ELSE '{}'::jsonb END
    ) object_item
    UNION ALL
    SELECT NULL::text AS key_name, array_item.value AS node_value
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(parent.node_value) = 'array'
        THEN parent.node_value ELSE '[]'::jsonb END
    ) array_item
  ) child
  WHERE parent.depth < ${MAX_JSON_DEPTH}
)
SELECT
  COUNT(*) FILTER (WHERE key_name ~* '${RAW_LIKE_KEY_PATTERN}')::bigint
    AS raw_like_key_occurrences,
  COUNT(DISTINCT snapshot_id) FILTER (WHERE key_name ~* '${RAW_LIKE_KEY_PATTERN}')::bigint
    AS snapshots_with_raw_like_keys,
  COUNT(*) FILTER (
    WHERE jsonb_typeof(node_value) = 'string'
      AND length(node_value #>> '{}') >= 280
  )::bigint AS long_string_occurrences,
  COUNT(DISTINCT snapshot_id) FILTER (
    WHERE jsonb_typeof(node_value) = 'string'
      AND length(node_value #>> '{}') >= 280
  )::bigint AS snapshots_with_long_strings,
  COUNT(*) FILTER (
    WHERE jsonb_typeof(node_value) = 'string'
      AND length(node_value #>> '{}') >= 1000
  )::bigint AS very_long_string_occurrences,
  COUNT(*) FILTER (
    WHERE jsonb_typeof(node_value) = 'array'
      AND jsonb_array_length(node_value) >= 50
  )::bigint AS oversized_array_occurrences,
  MAX(depth) AS max_depth_seen,
  COUNT(*) FILTER (
    WHERE depth = ${MAX_JSON_DEPTH}
      AND jsonb_typeof(node_value) IN ('object', 'array')
  )::bigint AS truncated_container_occurrences
FROM json_nodes
`;

const MESSAGE_GROUP_SQL = `
SELECT
  m.visibility_scope::text AS category_a,
  m.message_type::text AS category_b,
  COALESCE(p.participant_type::text, 'missing_sender') AS category_c,
  COUNT(*)::bigint AS row_count
FROM chat_messages m
LEFT JOIN chat_participants p ON p.id = m.sender_participant_id
WHERE m.channel_id IS NULL
GROUP BY m.visibility_scope, m.message_type, p.participant_type
ORDER BY m.visibility_scope::text, m.message_type::text, category_c
`;

export const MESSAGE_AI_CONTEXT_ELIGIBILITY_GROUP_SQL = `
SELECT
  COALESCE(c.kind::text, 'unclassified') AS category_a,
  m.ai_context_eligible::text AS category_b,
  m.message_type::text AS category_c,
  COUNT(*)::bigint AS row_count
FROM chat_messages m
LEFT JOIN chat_channels c ON c.id = m.channel_id
GROUP BY c.kind, m.ai_context_eligible, m.message_type
ORDER BY category_a, category_b, category_c
`;

const PARTICIPANT_MODE_GROUP_SQL = `
SELECT
  private_context_use_mode::text AS category_a,
  participant_type::text AS category_b,
  NULL::text AS category_c,
  COUNT(*)::bigint AS row_count
FROM chat_participants
GROUP BY private_context_use_mode, participant_type
ORDER BY private_context_use_mode::text, participant_type::text
`;

const ACTIVE_PARTICIPANT_DUPLICATE_GROUP_SQL = `
SELECT
  duplicate_groups.role_in_room::text AS role_in_room,
  COUNT(*)::bigint AS duplicate_group_count
FROM (
  SELECT room_id, role_in_room
  FROM chat_participants
  WHERE is_active = true
    AND role_in_room IN ('roleA', 'roleB', 'aiMediator')
  GROUP BY room_id, role_in_room
  HAVING COUNT(*) > 1
) duplicate_groups
GROUP BY duplicate_groups.role_in_room
ORDER BY duplicate_groups.role_in_room::text
`;

const ACTIVE_AUTHORIZATION_DUPLICATE_GROUP_SQL = `
SELECT COUNT(*)::bigint AS duplicate_group_count
FROM (
  SELECT
    capsule_id,
    subject_participant_id,
    purpose,
    audience,
    target_type,
    target_id
  FROM context_authorizations
  WHERE revoked_at IS NULL
  GROUP BY
    capsule_id,
    subject_participant_id,
    purpose,
    audience,
    target_type,
    target_id
  HAVING COUNT(*) > 1
) duplicate_authorizations
`;

const CAPSULE_GROUP_SQL = `
SELECT
  status::text AS category_a,
  sensitivity_class::text AS category_b,
  NULL::text AS category_c,
  COUNT(*)::bigint AS row_count
FROM context_capsules
GROUP BY status, sensitivity_class
ORDER BY status::text, sensitivity_class::text
`;

const ORPHAN_COUNT_SQL = `
SELECT
  (SELECT COUNT(*) FROM chat_messages m
    LEFT JOIN chat_rooms r ON r.id = m.room_id
    WHERE r.id IS NULL)::bigint AS message_room_orphans,
  (SELECT COUNT(*) FROM chat_messages m
    LEFT JOIN chat_participants p ON p.id = m.sender_participant_id
    WHERE p.id IS NULL)::bigint AS message_sender_orphans,
  (SELECT COUNT(*) FROM chat_channels c
    LEFT JOIN chat_participants p ON p.id = c.owner_participant_id
    WHERE c.kind = 'private' AND p.id IS NULL)::bigint AS channel_owner_orphans,
  (SELECT COUNT(*) FROM chat_channels c
    JOIN chat_participants p ON p.id = c.owner_participant_id
    WHERE c.kind = 'private' AND p.room_id <> c.room_id)::bigint AS channel_owner_room_mismatches,
  (SELECT COUNT(*) FROM context_capsules cc
    LEFT JOIN chat_participants p ON p.id = cc.owner_participant_id
    WHERE p.id IS NULL)::bigint AS capsule_owner_orphans,
  (SELECT COUNT(*) FROM context_capsules cc
    LEFT JOIN chat_channels c ON c.id = cc.source_channel_id
    WHERE c.id IS NULL)::bigint AS capsule_source_channel_orphans,
  (SELECT COUNT(*) FROM context_capsules cc
    JOIN chat_participants p ON p.id = cc.owner_participant_id
    JOIN chat_channels c ON c.id = cc.source_channel_id
    WHERE p.room_id <> cc.room_id OR c.room_id <> cc.room_id)::bigint AS capsule_room_mismatches
`;

function toSafeNumber(value: CountValue): number {
  const result = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error('Database count exceeded the safe reporting range');
  }
  return result;
}

function hashSchemaKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function isRawLikeKey(key: string): boolean {
  return new RegExp(RAW_LIKE_KEY_PATTERN, 'i').test(key);
}

export function parseLegacyPrivacyAuditArgs(argv: string[]): LegacyPrivacyAuditCliOptions {
  let target: AuditTarget = 'local';
  let topKeys = DEFAULT_TOP_KEYS;
  let statementTimeoutMs = DEFAULT_STATEMENT_TIMEOUT_MS;
  let help = false;

  for (const arg of argv) {
    if (arg === '--apply') {
      throw new Error('This audit is permanently read-only; --apply is not supported');
    }
    if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length) as AuditTarget;
    } else if (arg.startsWith('--top-keys=')) {
      topKeys = Number(arg.slice('--top-keys='.length));
    } else if (arg.startsWith('--statement-timeout-ms=')) {
      statementTimeoutMs = Number(arg.slice('--statement-timeout-ms='.length));
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['local', 'staging', 'release', 'production'].includes(target)) {
    throw new Error(`Invalid --target: ${target}`);
  }
  if (!Number.isInteger(topKeys) || topKeys < 1 || topKeys > MAX_TOP_KEYS) {
    throw new Error(`--top-keys must be an integer between 1 and ${MAX_TOP_KEYS}`);
  }
  if (
    !Number.isInteger(statementTimeoutMs) ||
    statementTimeoutMs < 1_000 ||
    statementTimeoutMs > MAX_STATEMENT_TIMEOUT_MS
  ) {
    throw new Error(
      `--statement-timeout-ms must be an integer between 1000 and ${MAX_STATEMENT_TIMEOUT_MS}`
    );
  }

  return { target, topKeys, statementTimeoutMs, help, readOnly: true };
}

export function printLegacyPrivacyAuditHelp(): void {
  console.log(`Usage: npm --prefix backend run ops:chat-context:legacy-audit -- [options]

This command is permanently read-only. It never accepts --apply and never deletes or changes data.

Options:
  --target=local|staging|release|production
  --top-keys=<1-${MAX_TOP_KEYS}>              Maximum hashed ProfileSnapshot schema rows (default ${DEFAULT_TOP_KEYS}).
  --statement-timeout-ms=<1000-${MAX_STATEMENT_TIMEOUT_MS}>
                                      Per-query database timeout (default ${DEFAULT_STATEMENT_TIMEOUT_MS}).
  --help, -h                         Show this help without connecting to a database.

Privacy: snapshot values and message content are never returned to the process or printed. JSON keys are
SHA-256 hashed before reporting; only schema types, counts, risk flags, orphan counts, and evidence hashes leave SQL.
`);
}

export function buildProfileSnapshotAuditReport(
  summary: ProfileSnapshotSummarySqlRow,
  keyRows: ProfileSnapshotKeySqlRow[],
  risk: ProfileSnapshotRiskSqlRow
) {
  return {
    snapshots: toSafeNumber(summary.snapshot_count),
    users: toSafeNumber(summary.user_count),
    cases: toSafeNumber(summary.case_count),
    rootSchema: {
      object: toSafeNumber(summary.root_object_count),
      array: toSafeNumber(summary.root_array_count),
      scalar: toSafeNumber(summary.root_scalar_count),
    },
    hashedKeySchema: keyRows.map(row => ({
      keyHash: hashSchemaKey(row.key_name),
      valueType: row.value_type,
      depth: row.depth,
      occurrences: toSafeNumber(row.occurrences),
      snapshots: toSafeNumber(row.snapshot_count),
      rawLikeRisk: isRawLikeKey(row.key_name),
    })),
    rawLikeRisk: {
      keyOccurrences: toSafeNumber(risk.raw_like_key_occurrences),
      affectedSnapshotsByKey: toSafeNumber(risk.snapshots_with_raw_like_keys),
      longStringOccurrences: toSafeNumber(risk.long_string_occurrences),
      affectedSnapshotsByLongString: toSafeNumber(risk.snapshots_with_long_strings),
      veryLongStringOccurrences: toSafeNumber(risk.very_long_string_occurrences),
      oversizedArrayOccurrences: toSafeNumber(risk.oversized_array_occurrences),
      maxDepthSeen: risk.max_depth_seen ?? 0,
      truncatedContainerOccurrences: toSafeNumber(risk.truncated_container_occurrences),
      maxAuditedDepth: MAX_JSON_DEPTH,
    },
  };
}

function normalizeGroupedCounts(rows: GroupedCountSqlRow[]) {
  return rows.map(row => ({
    categoryA: row.category_a,
    categoryB: row.category_b,
    categoryC: row.category_c,
    rows: toSafeNumber(row.row_count),
  }));
}

function normalizeOrphans(row: OrphanCountSqlRow) {
  return {
    messageRoom: toSafeNumber(row.message_room_orphans),
    messageSender: toSafeNumber(row.message_sender_orphans),
    channelOwner: toSafeNumber(row.channel_owner_orphans),
    channelOwnerRoomMismatch: toSafeNumber(row.channel_owner_room_mismatches),
    capsuleOwner: toSafeNumber(row.capsule_owner_orphans),
    capsuleSourceChannel: toSafeNumber(row.capsule_source_channel_orphans),
    capsuleRoomMismatch: toSafeNumber(row.capsule_room_mismatches),
  };
}

type NormalizedOrphans = ReturnType<typeof normalizeOrphans>;

export type LegacyPrivacyAuditBlockingFinding = {
  code:
    | 'unclassified_chat_messages'
    | 'unknown_private_context_mode'
    | 'active_participant_uniqueness_drift'
    | 'active_context_authorization_uniqueness_drift'
    | 'profile_snapshot_audit_truncated'
    | 'referential_integrity_drift';
  rows: number;
};

export function buildLegacyPrivacyAuditBlockingFindings(input: {
  unclassifiedMessageRows: number;
  unknownPrivateContextModeRows: number;
  activeParticipantDuplicateGroups: number;
  activeAuthorizationDuplicateGroups: number;
  truncatedProfileSnapshotContainers: number;
  orphans: NormalizedOrphans;
}): LegacyPrivacyAuditBlockingFinding[] {
  const findings: LegacyPrivacyAuditBlockingFinding[] = [];
  if (input.unclassifiedMessageRows > 0) {
    findings.push({ code: 'unclassified_chat_messages', rows: input.unclassifiedMessageRows });
  }
  if (input.unknownPrivateContextModeRows > 0) {
    findings.push({
      code: 'unknown_private_context_mode',
      rows: input.unknownPrivateContextModeRows,
    });
  }
  if (input.activeParticipantDuplicateGroups > 0) {
    findings.push({
      code: 'active_participant_uniqueness_drift',
      rows: input.activeParticipantDuplicateGroups,
    });
  }
  if (input.activeAuthorizationDuplicateGroups > 0) {
    findings.push({
      code: 'active_context_authorization_uniqueness_drift',
      rows: input.activeAuthorizationDuplicateGroups,
    });
  }
  if (input.truncatedProfileSnapshotContainers > 0) {
    findings.push({
      code: 'profile_snapshot_audit_truncated',
      rows: input.truncatedProfileSnapshotContainers,
    });
  }
  const referentialIntegrityRows = Object.values(input.orphans).reduce(
    (total, count) => total + count,
    0
  );
  if (referentialIntegrityRows > 0) {
    findings.push({ code: 'referential_integrity_drift', rows: referentialIntegrityRows });
  }
  return findings;
}

export async function runLegacyPrivacyAudit(
  prisma: PrismaClient,
  options: LegacyPrivacyAuditCliOptions
) {
  const [
    summaryRows,
    keyRows,
    riskRows,
    messageRows,
    messageAiContextEligibilityRows,
    participantRows,
    activeParticipantDuplicateRows,
    activeAuthorizationDuplicateRows,
    capsuleRows,
    orphanRows,
  ] = await prisma.$transaction(
    async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${options.statementTimeoutMs}ms'`);

      // Keep the two recursive ProfileSnapshot traversals sequential so a
      // release audit cannot double their peak production database load.
      const summary = await tx.$queryRawUnsafe<ProfileSnapshotSummarySqlRow[]>(
        PROFILE_SNAPSHOT_SUMMARY_SQL
      );
      const keys = await tx.$queryRawUnsafe<ProfileSnapshotKeySqlRow[]>(
        PROFILE_SNAPSHOT_KEY_STATS_SQL,
        options.topKeys
      );
      const risk = await tx.$queryRawUnsafe<ProfileSnapshotRiskSqlRow[]>(PROFILE_SNAPSHOT_RISK_SQL);
      const messages = await tx.$queryRawUnsafe<GroupedCountSqlRow[]>(MESSAGE_GROUP_SQL);
      const messageAiContextEligibility = await tx.$queryRawUnsafe<GroupedCountSqlRow[]>(
        MESSAGE_AI_CONTEXT_ELIGIBILITY_GROUP_SQL
      );
      const participants = await tx.$queryRawUnsafe<GroupedCountSqlRow[]>(
        PARTICIPANT_MODE_GROUP_SQL
      );
      const activeParticipantDuplicates = await tx.$queryRawUnsafe<
        ActiveParticipantDuplicateSqlRow[]
      >(ACTIVE_PARTICIPANT_DUPLICATE_GROUP_SQL);
      const activeAuthorizationDuplicates = await tx.$queryRawUnsafe<
        ActiveAuthorizationDuplicateSqlRow[]
      >(ACTIVE_AUTHORIZATION_DUPLICATE_GROUP_SQL);
      const capsules = await tx.$queryRawUnsafe<GroupedCountSqlRow[]>(CAPSULE_GROUP_SQL);
      const orphans = await tx.$queryRawUnsafe<OrphanCountSqlRow[]>(ORPHAN_COUNT_SQL);
      return [
        summary,
        keys,
        risk,
        messages,
        messageAiContextEligibility,
        participants,
        activeParticipantDuplicates,
        activeAuthorizationDuplicates,
        capsules,
        orphans,
      ] as const;
    },
    {
      maxWait: 5_000,
      timeout: options.statementTimeoutMs * 10 + 10_000,
    }
  );

  const emptySummary: ProfileSnapshotSummarySqlRow = {
    snapshot_count: 0,
    user_count: 0,
    case_count: 0,
    root_object_count: 0,
    root_array_count: 0,
    root_scalar_count: 0,
  };
  const emptyRisk: ProfileSnapshotRiskSqlRow = {
    raw_like_key_occurrences: 0,
    snapshots_with_raw_like_keys: 0,
    long_string_occurrences: 0,
    snapshots_with_long_strings: 0,
    very_long_string_occurrences: 0,
    oversized_array_occurrences: 0,
    max_depth_seen: 0,
    truncated_container_occurrences: 0,
  };
  const emptyOrphans: OrphanCountSqlRow = {
    message_room_orphans: 0,
    message_sender_orphans: 0,
    channel_owner_orphans: 0,
    channel_owner_room_mismatches: 0,
    capsule_owner_orphans: 0,
    capsule_source_channel_orphans: 0,
    capsule_room_mismatches: 0,
  };

  const profileSnapshots = buildProfileSnapshotAuditReport(
    summaryRows[0] ?? emptySummary,
    keyRows,
    riskRows[0] ?? emptyRisk
  );
  const unclassifiedChatMessages = normalizeGroupedCounts(messageRows);
  const privateContextUseModes = normalizeGroupedCounts(participantRows);
  const messageAiContextEligibility = normalizeGroupedCounts(messageAiContextEligibilityRows);
  const activeParticipantDuplicateGroups = activeParticipantDuplicateRows.map(row => ({
    roleInRoom: row.role_in_room,
    groups: toSafeNumber(row.duplicate_group_count),
  }));
  const activeAuthorizationDuplicateGroups = toSafeNumber(
    activeAuthorizationDuplicateRows[0]?.duplicate_group_count ?? 0
  );
  const orphans = normalizeOrphans(orphanRows[0] ?? emptyOrphans);
  const blockingFindings = buildLegacyPrivacyAuditBlockingFindings({
    unclassifiedMessageRows: unclassifiedChatMessages.reduce((total, row) => total + row.rows, 0),
    unknownPrivateContextModeRows: privateContextUseModes
      .filter(row => !['private_only', 'shared_process_controls'].includes(row.categoryA ?? ''))
      .reduce((total, row) => total + row.rows, 0),
    activeParticipantDuplicateGroups: activeParticipantDuplicateGroups.reduce(
      (total, row) => total + row.groups,
      0
    ),
    activeAuthorizationDuplicateGroups,
    truncatedProfileSnapshotContainers: profileSnapshots.rawLikeRisk.truncatedContainerOccurrences,
    orphans,
  });
  const reportBody = {
    check: 'private-context-legacy-data-audit',
    ok: blockingFindings.length === 0,
    readOnly: true,
    target: options.target,
    statementTimeoutMs: options.statementTimeoutMs,
    generatedAt: new Date().toISOString(),
    blockingFindings,
    profileSnapshots,
    unclassifiedChatMessages,
    messageAiContextEligibility,
    privateContextUseModes,
    activeParticipantDuplicateGroups,
    activeAuthorizationDuplicateGroups,
    contextCapsules: normalizeGroupedCounts(capsuleRows),
    orphans,
  };

  return {
    ...reportBody,
    evidenceHash: createHash('sha256').update(JSON.stringify(reportBody)).digest('hex'),
  };
}

function loadLocalEnvironment(): void {
  try {
    require('dotenv').config();
  } catch {
    // dotenv is optional in stripped audit runners.
  }
}

function createPrismaClient(): PrismaClient {
  const { PrismaClient: RuntimePrismaClient } = require('../src/types/prisma-client') as {
    PrismaClient: new () => PrismaClient;
  };
  return new RuntimePrismaClient();
}

async function main(): Promise<void> {
  const options = parseLegacyPrivacyAuditArgs(process.argv.slice(2));
  if (options.help) {
    printLegacyPrivacyAuditHelp();
    return;
  }

  loadLocalEnvironment();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required; the value and host are never printed');
  }

  const prisma = createPrismaClient();
  try {
    const report = await runLegacyPrivacyAudit(prisma, options);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(
      '[private-context-legacy-data-audit] failed:',
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
