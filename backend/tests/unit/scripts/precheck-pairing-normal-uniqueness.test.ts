const prismaMock = {
  pairing: {
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('../../../src/types/prisma-client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
}));

import {
  buildPairingNormalUniquenessReport,
  runPairingNormalUniquenessPrecheck,
} from '../../../scripts/precheck-pairing-normal-uniqueness';

describe('precheck-pairing-normal-uniqueness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('沒有重複正式配對時通過', () => {
    const report = buildPairingNormalUniquenessReport([
      {
        id: 'p1',
        user1_id: 'u1',
        user2_id: 'u2',
        status: 'active',
        pairing_type: 'normal',
        created_at: new Date('2026-05-03T00:00:00.000Z'),
      },
      {
        id: 'p2',
        user1_id: 'u3',
        user2_id: null,
        status: 'pending',
        pairing_type: 'normal',
        created_at: new Date('2026-05-03T00:01:00.000Z'),
      },
    ], '2026-05-03T00:02:00.000Z');

    expect(report).toEqual({
      ok: true,
      check: 'pairing-normal-pending-active-uniqueness',
      checkedPairings: 2,
      conflictCount: 0,
      conflicts: [],
      generatedAt: '2026-05-03T00:02:00.000Z',
    });
  });

  it('同一 user 跨 user1/user2 出現在多個正式 pending/active pairing 時報告衝突', () => {
    const report = buildPairingNormalUniquenessReport([
      {
        id: 'p1',
        user1_id: 'u1',
        user2_id: 'u2',
        status: 'active',
        pairing_type: 'normal',
        created_at: new Date('2026-05-03T00:00:00.000Z'),
      },
      {
        id: 'p2',
        user1_id: 'u2',
        user2_id: 'u3',
        status: 'pending',
        pairing_type: 'normal',
        created_at: new Date('2026-05-03T00:01:00.000Z'),
      },
    ], '2026-05-03T00:02:00.000Z');

    expect(report.ok).toBe(false);
    expect(report.conflictCount).toBe(1);
    expect(report.conflicts[0]).toEqual({
      userId: 'u2',
      count: 2,
      pairingIds: ['p1', 'p2'],
      memberships: [
        {
          pairingId: 'p1',
          role: 'user2',
          status: 'active',
          createdAt: '2026-05-03T00:00:00.000Z',
        },
        {
          pairingId: 'p2',
          role: 'user1',
          status: 'pending',
          createdAt: '2026-05-03T00:01:00.000Z',
        },
      ],
    });
  });

  it('run precheck 只讀查 normal pending/active pairing', async () => {
    prismaMock.pairing.findMany.mockResolvedValue([]);

    const report = await runPairingNormalUniquenessPrecheck();

    expect(report.ok).toBe(true);
    expect(prismaMock.pairing.findMany).toHaveBeenCalledWith({
      where: {
        pairing_type: 'normal',
        status: { in: ['pending', 'active'] },
        OR: [
          { user1_id: { not: null } },
          { user2_id: { not: null } },
        ],
      },
      select: {
        id: true,
        user1_id: true,
        user2_id: true,
        status: true,
        pairing_type: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
  });
});
