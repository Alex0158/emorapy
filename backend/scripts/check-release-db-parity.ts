import { PrismaClient } from '../src/types/prisma-client';

try {
  // Load DATABASE_URL for local ops scripts without importing app env validation.
  require('dotenv').config();
} catch {
  // dotenv is optional in some runtime environments.
}

const prisma = new PrismaClient();

export const RELEASE_BLOCKING_MIGRATIONS = [
  '20260503224500_add_safety_metadata_columns',
  '20260503235500_add_safety_assessment_models',
  '20260504143000_add_ai_request_ledger',
  '20260504164500_add_notification_cancelled_status',
  '20260504173000_add_product_state_recovery_tasks',
  '20260504182000_add_normal_pairing_uniqueness_trigger',
  '20260504193000_add_case_source_tracking',
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

  const rows = await prisma.$queryRaw<ReleaseMigrationRow[]>`
    SELECT migration_name, finished_at, rolled_back_at, logs
    FROM _prisma_migrations
    ORDER BY migration_name ASC
  `;

  return buildReleaseDbParityReport(rows);
}

async function main() {
  const report = await runReleaseDbParityCheck();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('[release-db-parity] failed:', error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
