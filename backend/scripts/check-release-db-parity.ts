import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../src/types/prisma-client';

const databaseUrlProvidedByProcess =
  typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim().length > 0;

try {
  // Load DATABASE_URL for local ops scripts without importing app env validation.
  require('dotenv').config();
} catch {
  // dotenv is optional in some runtime environments.
}

export const RELEASE_BLOCKING_MIGRATIONS = [
  '20260503224500_add_safety_metadata_columns',
  '20260503235500_add_safety_assessment_models',
  '20260504143000_add_ai_request_ledger',
  '20260504164500_add_notification_cancelled_status',
  '20260504173000_add_product_state_recovery_tasks',
  '20260504182000_add_normal_pairing_uniqueness_trigger',
  '20260504193000_add_case_source_tracking',
  '20260508093000_add_push_device_tokens',
  '20260508113000_add_push_receipt_tracking',
  '20260508124000_add_app_telemetry_events',
  '20260508133000_add_ai_stream_persistence',
  '20260508143000_add_interview_collected_facts',
  '20260508143500_add_interview_turn_extracted_facts',
  '20260508150000_add_notification_action_metadata',
] as const;

export type ReleaseBlockingMigration = (typeof RELEASE_BLOCKING_MIGRATIONS)[number];

export type ReleaseMigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  logs: string | null;
};

export type ReleaseDbParityReport = {
  ok: boolean;
  check: 'release-db-parity';
  requiredMigrationCount: number;
  appliedRequiredMigrationCount: number;
  missingRequiredMigrations: ReleaseBlockingMigration[];
  incompleteRequiredMigrations: Array<{
    migrationName: ReleaseBlockingMigration;
    status: 'failed_or_incomplete' | 'rolled_back';
    logs: string | null;
  }>;
  failedMigrations: Array<{
    migrationName: string;
    logs: string | null;
  }>;
  generatedAt: string;
};

export type ReleaseDbParityTarget = 'local' | 'staging' | 'release' | 'production';

export type ReleaseDbParityEvidence = {
  type: 'app-release-db-parity-evidence';
  check: 'release-db-parity';
  ok: boolean;
  target: {
    classification: ReleaseDbParityTarget;
    database: {
      source: 'DATABASE_URL' | 'dotenv';
      provider: string | null;
      local: boolean;
    };
  };
  report: ReleaseDbParityReport;
  generatedAt: string;
};

type CliOptions = {
  dryRun: boolean;
  evidenceDir: string | null;
  evidenceFile: string | null;
  requireReleaseTarget: boolean;
  target: ReleaseDbParityTarget;
};

function isFinished(row: ReleaseMigrationRow | undefined): boolean {
  return Boolean(row?.finished_at && !row.rolled_back_at);
}

export function buildReleaseDbParityReport(
  rows: ReleaseMigrationRow[],
  requiredMigrations: readonly ReleaseBlockingMigration[] = RELEASE_BLOCKING_MIGRATIONS,
  generatedAt = new Date().toISOString()
): ReleaseDbParityReport {
  const rowsByName = new Map(rows.map((row) => [row.migration_name, row]));

  const missingRequiredMigrations = requiredMigrations.filter(
    (migrationName) => !rowsByName.has(migrationName)
  );

  const incompleteRequiredMigrations = requiredMigrations.flatMap((migrationName) => {
    const row = rowsByName.get(migrationName);
    if (!row || isFinished(row)) return [];

    return [{
      migrationName,
      status: row.rolled_back_at ? 'rolled_back' as const : 'failed_or_incomplete' as const,
      logs: row.logs,
    }];
  });

  const failedMigrations = rows
    .filter((row) => row.finished_at === null && row.rolled_back_at === null)
    .map((row) => ({
      migrationName: row.migration_name,
      logs: row.logs,
    }));

  const appliedRequiredMigrationCount = requiredMigrations.filter((migrationName) =>
    isFinished(rowsByName.get(migrationName))
  ).length;

  return {
    ok:
      missingRequiredMigrations.length === 0
      && incompleteRequiredMigrations.length === 0
      && failedMigrations.length === 0,
    check: 'release-db-parity',
    requiredMigrationCount: requiredMigrations.length,
    appliedRequiredMigrationCount,
    missingRequiredMigrations,
    incompleteRequiredMigrations,
    failedMigrations,
    generatedAt,
  };
}

export async function runReleaseDbParityCheck(): Promise<ReleaseDbParityReport> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL');
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<ReleaseMigrationRow[]>`
      SELECT migration_name, finished_at, rolled_back_at, logs
      FROM _prisma_migrations
      ORDER BY migration_name ASC
    `;

    return buildReleaseDbParityReport(rows);
  } finally {
    await prisma.$disconnect();
  }
}

function safeTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: process.env.APP_RELEASE_DB_PARITY_DRY_RUN === 'true',
    evidenceDir: process.env.APP_RELEASE_DB_PARITY_EVIDENCE_DIR ?? null,
    evidenceFile: process.env.APP_RELEASE_DB_PARITY_EVIDENCE_FILE ?? null,
    requireReleaseTarget: process.env.APP_RELEASE_DB_PARITY_REQUIRE_RELEASE_TARGET === 'true',
    target: (process.env.APP_RELEASE_DB_PARITY_TARGET as ReleaseDbParityTarget | undefined) ?? 'local',
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--require-release-target') {
      options.requireReleaseTarget = true;
    } else if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length) as ReleaseDbParityTarget;
    } else if (arg.startsWith('--evidence-dir=')) {
      options.evidenceDir = arg.slice('--evidence-dir='.length);
    } else if (arg.startsWith('--evidence-file=')) {
      options.evidenceFile = arg.slice('--evidence-file='.length);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['local', 'staging', 'release', 'production'].includes(options.target)) {
    throw new Error(`Invalid --target: ${options.target}`);
  }

  return options;
}

function printHelp(): void {
  console.log(`Usage: npm --prefix backend run ops:release-db:check -- [options]

Options:
  --dry-run                      Print the intended release DB parity check without connecting to a DB or writing evidence.
  --target=local|staging|release|production
  --evidence-dir=<dir>              Write App-Release-DB-Parity-<timestamp>.json.
  --evidence-file=<file>            Write evidence to an exact path.
  --require-release-target          Fail if target is local/staging or DATABASE_URL is local.

Evidence never writes DATABASE_URL or host names. It records only provider, source, local/non-local classification, migration status, and target classification.
`);
}

function printDryRun(options: CliOptions): void {
  if (options.requireReleaseTarget && !['release', 'production'].includes(options.target)) {
    throw new Error('--require-release-target requires --target=release or --target=production');
  }

  console.log('[release-db-parity] dry-run');
  console.log('- No database connection will be opened.');
  console.log('- No evidence file will be written.');
  console.log(`- Required release-blocking migrations: ${RELEASE_BLOCKING_MIGRATIONS.length}`);
  console.log('- Query: SELECT migration_name, finished_at, rolled_back_at, logs FROM _prisma_migrations ORDER BY migration_name ASC');
  console.log(`- Target classification requested: ${options.target}`);
  console.log('- Strict release evidence requires target=release|production, non-local PostgreSQL DATABASE_URL, ok=true, and zero missing / incomplete / failed migrations.');
  console.log('- Evidence command: DATABASE_URL=<release-or-production-postgresql-url> npm --prefix backend run ops:release-db:evidence');
  if (options.evidenceDir || options.evidenceFile) {
    console.log('- Evidence path options are ignored in dry-run mode.');
  }
}

function classifyDatabaseUrl(databaseUrl: string | undefined): { provider: string | null; local: boolean } {
  if (!databaseUrl) return { provider: null, local: false };

  try {
    const url = new URL(databaseUrl);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return {
      provider: url.protocol.replace(':', '') || null,
      local: url.protocol === 'file:' || host === 'localhost' || host === '::1' || host.startsWith('127.'),
    };
  } catch {
    return { provider: 'unknown', local: false };
  }
}

function resolveEvidencePath(options: CliOptions, generatedAt = new Date()): string | null {
  if (options.evidenceFile) return path.resolve(options.evidenceFile);
  if (!options.evidenceDir) return null;
  return path.resolve(options.evidenceDir, `App-Release-DB-Parity-${safeTimestamp(generatedAt)}.json`);
}

export function buildReleaseDbParityEvidence(
  report: ReleaseDbParityReport,
  options: Pick<CliOptions, 'target'>,
  generatedAt = new Date()
): ReleaseDbParityEvidence {
  const database = classifyDatabaseUrl(process.env.DATABASE_URL);

  return {
    type: 'app-release-db-parity-evidence',
    check: 'release-db-parity',
    ok: report.ok,
    target: {
      classification: options.target,
      database: {
        source: databaseUrlProvidedByProcess ? 'DATABASE_URL' : 'dotenv',
        provider: database.provider,
        local: database.local,
      },
    },
    report,
    generatedAt: generatedAt.toISOString(),
  };
}

function assertReleaseEvidenceTarget(evidence: ReleaseDbParityEvidence): void {
  const targetIsReleaseLike =
    evidence.target.classification === 'release' || evidence.target.classification === 'production';
  if (!targetIsReleaseLike) {
    throw new Error('--require-release-target requires --target=release or --target=production');
  }
  if (evidence.target.database.local) {
    throw new Error('--require-release-target refuses to write release evidence for a local DATABASE_URL');
  }
}

function writeEvidenceFile(evidence: ReleaseDbParityEvidence, filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.error(`[release-db-parity] evidence written: ${filePath}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) {
    printDryRun(options);
    return;
  }

  const report = await runReleaseDbParityCheck();
  const evidence = buildReleaseDbParityEvidence(report, options);
  if (options.requireReleaseTarget) assertReleaseEvidenceTarget(evidence);

  const evidencePath = resolveEvidencePath(options);
  if (evidencePath) writeEvidenceFile(evidence, evidencePath);

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('[release-db-parity] failed:', error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
