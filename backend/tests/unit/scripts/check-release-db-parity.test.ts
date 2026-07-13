const prismaMock = {
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('../../../src/types/prisma-client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
}));

import {
  RELEASE_BLOCKING_MIGRATIONS,
  buildReleaseDbParityEvidence,
  buildReleaseDbParityReport,
  runReleaseDbParityCheck,
  type ReleaseMigrationRow,
} from '../../../scripts/check-release-db-parity';
import fs from 'node:fs';
import path from 'node:path';

const migrationDir = path.resolve(__dirname, '../../../prisma/migrations');
const appReleaseBlockingMigrations = [
  '20260508093000_add_push_device_tokens',
  '20260508113000_add_push_receipt_tracking',
  '20260508124000_add_app_telemetry_events',
  '20260508133000_add_ai_stream_persistence',
  '20260508143000_add_interview_collected_facts',
  '20260508143500_add_interview_turn_extracted_facts',
  '20260508150000_add_notification_action_metadata',
  '20260712210000_add_chat_context_domain_foundation',
  '20260713090000_add_context_authorization_active_unique',
  '20260713130000_add_secure_email_challenges',
  '20260713153000_normalize_user_emails',
] as const;

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

  it('release blocking 清單引用的 migration 目錄都必須存在', () => {
    for (const migrationName of RELEASE_BLOCKING_MIGRATIONS) {
      const migrationPath = path.join(migrationDir, migrationName, 'migration.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
    }
  });

  it('App release-sensitive migrations 必須全部進入 release blocking 清單', () => {
    for (const migrationName of appReleaseBlockingMigrations) {
      expect(RELEASE_BLOCKING_MIGRATIONS).toContain(migrationName);
    }
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

  it('同名 migration 已 recovery applied 時不被舊 rolled back row 阻塞', () => {
    const recoveredMigration = '20260508133000_add_ai_stream_persistence';
    const rows: ReleaseMigrationRow[] = [
      ...RELEASE_BLOCKING_MIGRATIONS
        .filter((migrationName) => migrationName !== recoveredMigration)
        .map(appliedMigration),
      {
        migration_name: recoveredMigration,
        finished_at: null,
        rolled_back_at: new Date('2026-06-07T06:53:00.000Z'),
        logs: 'relation "ai_stream_sessions" already exists',
      },
      appliedMigration(recoveredMigration),
    ];

    const report = buildReleaseDbParityReport(rows, RELEASE_BLOCKING_MIGRATIONS, '2026-06-07T07:00:00.000Z');

    expect(report.ok).toBe(true);
    expect(report.appliedRequiredMigrationCount).toBe(RELEASE_BLOCKING_MIGRATIONS.length);
    expect(report.incompleteRequiredMigrations).toEqual([]);
    expect(report.failedMigrations).toEqual([]);
  });

  it('run check 只讀查詢 _prisma_migrations', async () => {
    prismaMock.$queryRaw.mockResolvedValue(RELEASE_BLOCKING_MIGRATIONS.map(appliedMigration));

    const report = await runReleaseDbParityCheck();

    expect(report.ok).toBe(true);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('release DB parity evidence 只保存安全分類，不保存 DATABASE_URL 或 host', () => {
    process.env.DATABASE_URL = 'postgresql://cj:secret@release-db.example/cj';
    const report = buildReleaseDbParityReport(
      RELEASE_BLOCKING_MIGRATIONS.map(appliedMigration),
      RELEASE_BLOCKING_MIGRATIONS,
      '2026-05-04T01:00:00.000Z'
    );

    const evidence = buildReleaseDbParityEvidence(report, { target: 'release' }, new Date('2026-05-04T01:02:00.000Z'));
    const serialized = JSON.stringify(evidence);

    expect(evidence).toMatchObject({
      type: 'app-release-db-parity-evidence',
      check: 'release-db-parity',
      ok: true,
      target: {
        classification: 'release',
        database: {
          provider: 'postgresql',
          local: false,
        },
      },
      generatedAt: '2026-05-04T01:02:00.000Z',
    });
    expect(evidence.report.requiredMigrationCount).toBe(RELEASE_BLOCKING_MIGRATIONS.length);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('release-db.example');
  });
});
