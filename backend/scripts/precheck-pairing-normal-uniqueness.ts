import { PrismaClient } from '../src/types/prisma-client';
import { NORMAL_PAIRING_ACTIVE_STATUSES } from '../src/utils/pairing-invariant';
import { PAIRING_TYPE } from '../src/utils/constants';

try {
  // Load DATABASE_URL for local ops scripts without importing app env validation.
  require('dotenv').config();
} catch {
  // dotenv is optional in some runtime environments.
}

const prisma = new PrismaClient();

type PairingRecord = {
  id: string;
  user1_id: string | null;
  user2_id: string | null;
  status: string;
  pairing_type: string;
  created_at: Date;
};

type PairingMembership = {
  pairingId: string;
  role: 'user1' | 'user2';
  status: string;
  createdAt: string;
};

export type PairingNormalUniquenessConflict = {
  userId: string;
  count: number;
  pairingIds: string[];
  memberships: PairingMembership[];
};

export type PairingNormalUniquenessReport = {
  ok: boolean;
  check: 'pairing-normal-pending-active-uniqueness';
  checkedPairings: number;
  conflictCount: number;
  conflicts: PairingNormalUniquenessConflict[];
  generatedAt: string;
};

export function buildPairingNormalUniquenessReport(
  pairings: PairingRecord[],
  generatedAt = new Date().toISOString()
): PairingNormalUniquenessReport {
  const membershipsByUser = new Map<string, PairingMembership[]>();

  for (const pairing of pairings) {
    const createdAt = pairing.created_at.toISOString();
    const memberships: Array<{ userId: string | null; membership: PairingMembership }> = [
      {
        userId: pairing.user1_id,
        membership: { pairingId: pairing.id, role: 'user1', status: pairing.status, createdAt },
      },
      {
        userId: pairing.user2_id,
        membership: { pairingId: pairing.id, role: 'user2', status: pairing.status, createdAt },
      },
    ];

    for (const { userId, membership } of memberships) {
      if (!userId) continue;
      const current = membershipsByUser.get(userId) || [];
      current.push(membership);
      membershipsByUser.set(userId, current);
    }
  }

  const conflicts = Array.from(membershipsByUser.entries())
    .filter(([, memberships]) => memberships.length > 1)
    .map(([userId, memberships]) => ({
      userId,
      count: memberships.length,
      pairingIds: memberships.map((membership) => membership.pairingId),
      memberships,
    }))
    .sort((a, b) => b.count - a.count || a.userId.localeCompare(b.userId));

  return {
    ok: conflicts.length === 0,
    check: 'pairing-normal-pending-active-uniqueness',
    checkedPairings: pairings.length,
    conflictCount: conflicts.length,
    conflicts,
    generatedAt,
  };
}

export async function runPairingNormalUniquenessPrecheck(): Promise<PairingNormalUniquenessReport> {
  const pairings = await prisma.pairing.findMany({
    where: {
      pairing_type: PAIRING_TYPE.NORMAL,
      status: { in: [...NORMAL_PAIRING_ACTIVE_STATUSES] },
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

  return buildPairingNormalUniquenessReport(pairings);
}

async function main() {
  const report = await runPairingNormalUniquenessPrecheck();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('[pairing-normal-uniqueness-precheck] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
