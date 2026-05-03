import { Prisma } from '../types/prisma-client';
import { PAIRING_STATUS, PAIRING_TYPE } from './constants';

export const NORMAL_PAIRING_ACTIVE_STATUSES = [
  PAIRING_STATUS.PENDING,
  PAIRING_STATUS.ACTIVE,
] as const;

export function buildActiveNormalPairingWhere(
  userId: string,
  excludePairingId?: string
): Prisma.PairingWhereInput {
  const where: Prisma.PairingWhereInput = {
    pairing_type: PAIRING_TYPE.NORMAL,
    status: { in: [...NORMAL_PAIRING_ACTIVE_STATUSES] },
    OR: [
      { user1_id: userId },
      { user2_id: userId },
    ],
  };

  if (excludePairingId) {
    where.id = { not: excludePairingId };
  }

  return where;
}
