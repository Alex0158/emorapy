import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type MigrationRow = {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
  logs: string | null;
};

function readMigrationFolders(migrationsDir: string): string[] {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function normalizeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL');
  }

  const reportPath =
    process.env.MIGRATION_REPORT_PATH || './tmp/bench-reports/prisma-migration-baseline-report.json';
  const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
  const migrationFolders = readMigrationFolders(migrationsDir);

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const rows = await prisma.$queryRaw<MigrationRow[]>`
      SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count, logs
      FROM _prisma_migrations
      ORDER BY migration_name ASC
    `;

    const appliedNames = rows.map((row) => row.migration_name);
    const missingInDb = migrationFolders.filter((name) => !appliedNames.includes(name));
    const missingInCode = appliedNames.filter((name) => !migrationFolders.includes(name));
    const failedMigrations = rows
      .filter((row) => row.finished_at === null && row.rolled_back_at === null)
      .map((row) => ({
        migration_name: row.migration_name,
        logs: row.logs,
      }));

    const report = {
      generatedAt: new Date().toISOString(),
      migrationFolderCount: migrationFolders.length,
      appliedMigrationCount: appliedNames.length,
      missingInDb,
      missingInCode,
      failedMigrations,
      migrations: rows.map((row) => ({
        migration_name: row.migration_name,
        checksum: row.checksum,
        finished_at: normalizeDate(row.finished_at),
        rolled_back_at: normalizeDate(row.rolled_back_at),
        applied_steps_count: row.applied_steps_count,
      })),
      status:
        missingInDb.length === 0 && missingInCode.length === 0 && failedMigrations.length === 0
          ? 'ok'
          : 'warning',
    };

    const absoluteReportPath = path.resolve(reportPath);
    fs.mkdirSync(path.dirname(absoluteReportPath), { recursive: true });
    fs.writeFileSync(absoluteReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));

    process.exit(report.status === 'ok' ? 0 : 2);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[report-prisma-migrations] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
