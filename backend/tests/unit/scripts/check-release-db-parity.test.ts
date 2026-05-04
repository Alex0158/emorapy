const prismaMock = {
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('../../../src/types/prisma-client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
}));

import {
  RELEASE_BLOCKING_MIGRATIONS,
  buildReleaseDbParityReport,
  runReleaseDbParityCheck,
  type ReleaseMigrationRow,
} from '../../../scripts/check-release-db-parity';

function appliedMigration(migrationName: string): ReleaseMigrationRow {
  return {
    migration_name: migrationName,
    finished_at: new Date('2026-05-04T00:00:00.000Z'),
    rolled_back_at: null,
    logs: null,
  };
}

describe('check-release-db-parity', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://release-db.example/cj';
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('所有 release blocking migrations 已完成時通過', () => {
    const rows = RELEASE_BLOCKING_MIGRATIONS.map(appliedMigration);

    const report = buildReleaseDbParityReport(rows, RELEASE_BLOCKING_MIGRATIONS, '2026-05-04T01:00:00.000Z');

    expect(report).toEqual({
      ok: true,
      check: 'release-db-parity',
      requiredMigrationCount: RELEASE_BLOCKING_MIGRATIONS.length,
      appliedRequiredMigrationCount: RELEASE_BLOCKING_MIGRATIONS.length,
      missingRequiredMigrations: [],
      incompleteRequiredMigrations: [],
      failedMigrations: [],
      generatedAt: '2026-05-04T01:00:00.000Z',
    });
  });

  it('缺少指定 release blocking migration 時阻塞', () => {
    const rows = RELEASE_BLOCKING_MIGRATIONS
      .filter((migrationName) => migrationName !== '20260504193000_add_case_source_tracking')
      .map(appliedMigration);

    const report = buildReleaseDbParityReport(rows, RELEASE_BLOCKING_MIGRATIONS, '2026-05-04T01:00:00.000Z');

    expect(report.ok).toBe(false);
    expect(report.appliedRequiredMigrationCount).toBe(RELEASE_BLOCKING_MIGRATIONS.length - 1);
    expect(report.missingRequiredMigrations).toEqual(['20260504193000_add_case_source_tracking']);
  });

  it('failed 或 rolled back migration 會阻塞 release gate', () => {
    const rows: ReleaseMigrationRow[] = [
      ...RELEASE_BLOCKING_MIGRATIONS
        .filter((migrationName) =>
          ![
            '20260504182000_add_normal_pairing_uniqueness_trigger',
            '20260504193000_add_case_source_tracking',
          ].includes(migrationName)
        )
        .map(appliedMigration),
      {
        migration_name: '20260504182000_add_normal_pairing_uniqueness_trigger',
        finished_at: null,
        rolled_back_at: null,
        logs: 'trigger failed',
      },
      {
        migration_name: '20260504193000_add_case_source_tracking',
        finished_at: null,
        rolled_back_at: new Date('2026-05-04T00:02:00.000Z'),
        logs: 'rolled back',
      },
    ];

    const report = buildReleaseDbParityReport(rows, RELEASE_BLOCKING_MIGRATIONS, '2026-05-04T01:00:00.000Z');

    expect(report.ok).toBe(false);
    expect(report.incompleteRequiredMigrations).toEqual([
      {
        migrationName: '20260504182000_add_normal_pairing_uniqueness_trigger',
        status: 'failed_or_incomplete',
        logs: 'trigger failed',
      },
      {
        migrationName: '20260504193000_add_case_source_tracking',
        status: 'rolled_back',
        logs: 'rolled back',
      },
    ]);
    expect(report.failedMigrations).toEqual([
      {
        migrationName: '20260504182000_add_normal_pairing_uniqueness_trigger',
        logs: 'trigger failed',
      },
    ]);
  });

  it('run check 只讀查詢 _prisma_migrations', async () => {
    prismaMock.$queryRaw.mockResolvedValue(RELEASE_BLOCKING_MIGRATIONS.map(appliedMigration));

    const report = await runReleaseDbParityCheck();

    expect(report.ok).toBe(true);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
