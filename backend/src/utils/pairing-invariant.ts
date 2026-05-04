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

export function buildSessionBoundQuickPairingWhere(
  sessionId: string,
  pairingId?: string
): Prisma.PairingWhereInput {
  const where: Prisma.PairingWhereInput = {
    session_id: sessionId,
    pairing_type: PAIRING_TYPE.QUICK,
    status: PAIRING_STATUS.TEMP,
  };

  if (pairingId) {
    where.id = pairingId;
  }

  return where;
}

export function buildQuickTempPairingWhere(options: {
  sessionId?: string;
  pairingId?: string;
  createdBefore?: Date;
} = {}): Prisma.PairingWhereInput {
  const where: Prisma.PairingWhereInput = {
    pairing_type: PAIRING_TYPE.QUICK,
    status: PAIRING_STATUS.TEMP,
  };

  if (options.sessionId) {
    where.session_id = options.sessionId;
  }

  if (options.pairingId) {
    where.id = options.pairingId;
  }

  if (options.createdBefore) {
    where.created_at = { lt: options.createdBefore };
  }

  return where;
}
