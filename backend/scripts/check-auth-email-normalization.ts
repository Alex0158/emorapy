import { PrismaClient } from '../src/types/prisma-client';

export interface AuthEmailNormalizationInventory {
  ok: boolean;
  check: 'auth-email-normalization';
  blankEmailCount: number;
  nonCanonicalEmailCount: number;
  collisionGroupCount: number;
  collisionRowCount: number;
  activeUnverifiedUserCount: number;
  citextAvailable: boolean;
  citextInstalled: boolean;
  databaseCreatePrivilege: boolean;
  migrationCapabilityReady: boolean;
  generatedAt: string;
}

interface InventoryRow {
  blank_email_count: number;
  non_canonical_email_count: number;
  collision_group_count: number;
  collision_row_count: number;
  active_unverified_user_count: number;
  citext_available: boolean;
  citext_installed: boolean;
  database_create_privilege: boolean;
}

export function buildAuthEmailNormalizationInventory(
  row: InventoryRow,
  generatedAt = new Date().toISOString()
): AuthEmailNormalizationInventory {
  const migrationCapabilityReady = row.citext_installed
    || (row.citext_available && row.database_create_privilege);
  return {
    ok: row.blank_email_count === 0
      && row.collision_group_count === 0
      && migrationCapabilityReady,
    check: 'auth-email-normalization',
    blankEmailCount: row.blank_email_count,
    nonCanonicalEmailCount: row.non_canonical_email_count,
    collisionGroupCount: row.collision_group_count,
    collisionRowCount: row.collision_row_count,
    activeUnverifiedUserCount: row.active_unverified_user_count,
    citextAvailable: row.citext_available,
    citextInstalled: row.citext_installed,
    databaseCreatePrivilege: row.database_create_privilege,
    migrationCapabilityReady,
    generatedAt,
  };
}

export async function runAuthEmailNormalizationInventory(
  prisma: Pick<PrismaClient, '$queryRaw'> = new PrismaClient()
): Promise<AuthEmailNormalizationInventory> {
  const rows = await prisma.$queryRaw<InventoryRow[]>`
    WITH collision_groups AS (
      SELECT LOWER(BTRIM("email")) AS normalized_email, COUNT(*)::INTEGER AS row_count
      FROM "users"
      GROUP BY LOWER(BTRIM("email"))
      HAVING COUNT(*) > 1
    )
    SELECT
      (SELECT COUNT(*)::INTEGER FROM "users" WHERE BTRIM("email") = '') AS blank_email_count,
      (SELECT COUNT(*)::INTEGER FROM "users" WHERE "email" <> LOWER(BTRIM("email"))) AS non_canonical_email_count,
      (SELECT COUNT(*)::INTEGER FROM collision_groups) AS collision_group_count,
      (SELECT COALESCE(SUM(row_count), 0)::INTEGER FROM collision_groups) AS collision_row_count,
      (SELECT COUNT(*)::INTEGER FROM "users" WHERE "is_active" = TRUE AND "email_verified" = FALSE) AS active_unverified_user_count,
      EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'citext') AS citext_available,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') AS citext_installed,
      has_database_privilege(current_user, current_database(), 'CREATE') AS database_create_privilege
  `;
  const row = rows[0];
  if (!row) throw new Error('Auth email normalization inventory returned no row');
  return buildAuthEmailNormalizationInventory(row);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const prisma = new PrismaClient();
  try {
    const report = await runAuthEmailNormalizationInventory(prisma);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.exitCode = report.ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`[auth-email-normalization] ${error instanceof Error ? error.message : 'unknown failure'}\n`);
    process.exitCode = 1;
  });
}
