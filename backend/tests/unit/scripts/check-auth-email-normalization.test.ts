const prismaMock = {
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('../../../src/types/prisma-client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
}));

import {
  buildAuthEmailNormalizationInventory,
  runAuthEmailNormalizationInventory,
} from '../../../scripts/check-auth-email-normalization';

describe('check-auth-email-normalization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows collision-free legacy mixed-case rows for the migration backfill', () => {
    expect(buildAuthEmailNormalizationInventory({
      blank_email_count: 0,
      non_canonical_email_count: 3,
      collision_group_count: 0,
      collision_row_count: 0,
      active_unverified_user_count: 2,
      citext_available: true,
      citext_installed: false,
      database_create_privilege: true,
    }, '2026-07-13T15:30:00.000Z')).toEqual({
      ok: true,
      check: 'auth-email-normalization',
      blankEmailCount: 0,
      nonCanonicalEmailCount: 3,
      collisionGroupCount: 0,
      collisionRowCount: 0,
      activeUnverifiedUserCount: 2,
      citextAvailable: true,
      citextInstalled: false,
      databaseCreatePrivilege: true,
      migrationCapabilityReady: true,
      generatedAt: '2026-07-13T15:30:00.000Z',
    });
  });

  it('blocks blank or colliding canonical addresses without exposing addresses', () => {
    const report = buildAuthEmailNormalizationInventory({
      blank_email_count: 1,
      non_canonical_email_count: 4,
      collision_group_count: 2,
      collision_row_count: 5,
      active_unverified_user_count: 3,
      citext_available: true,
      citext_installed: false,
      database_create_privilege: true,
    });
    expect(report.ok).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/@/);
  });

  it('queries and returns the neutral production inventory', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{
      blank_email_count: 0,
      non_canonical_email_count: 0,
      collision_group_count: 0,
      collision_row_count: 0,
      active_unverified_user_count: 0,
      citext_available: true,
      citext_installed: true,
      database_create_privilege: false,
    }]);
    await expect(runAuthEmailNormalizationInventory(prismaMock as never)).resolves.toMatchObject({
      ok: true,
      check: 'auth-email-normalization',
    });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('blocks before deployment when CITEXT cannot be installed', () => {
    expect(buildAuthEmailNormalizationInventory({
      blank_email_count: 0,
      non_canonical_email_count: 0,
      collision_group_count: 0,
      collision_row_count: 0,
      active_unverified_user_count: 0,
      citext_available: true,
      citext_installed: false,
      database_create_privilege: false,
    })).toMatchObject({
      ok: false,
      migrationCapabilityReady: false,
    });
  });
});
