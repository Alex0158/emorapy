import prisma from '../config/database';
import { generateInviteCode } from '../utils/session';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { fileService, signAvatar } from './file.service';
import { lockService } from '../utils/lock';
import { LOCK_TTL, PAIRING_STATUS, PAIRING_TYPE } from '../utils/constants';
import { emailService } from './email.service';
import { buildActiveNormalPairingWhere, NORMAL_PAIRING_ACTIVE_STATUSES } from '../utils/pairing-invariant';

export class PairingService {
  /**
   * 創建配對（完整模式）
   */
  async createPairing(userId: string) {
    // 1. 檢查是否已有配對
    const existingPairing = await prisma.pairing.findFirst({
      where: buildActiveNormalPairingWhere(userId),
    });

    if (existingPairing) {
      throw Errors.ALREADY_PAIRED();
    }

    // 2. 生成唯一邀請碼（6位字母數字）
    let inviteCode: string;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      inviteCode = generateInviteCode();
      const existing = await prisma.pairing.findUnique({
        where: { invite_code: inviteCode },
      });

      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw Errors.INTERNAL_ERROR('無法生成唯一邀請碼');
    }

    // 3. 創建配對記錄（24小時過期）
    const pairing = await prisma.pairing.create({
      data: {
        user1_id: userId,
        invite_code: inviteCode!,
        status: PAIRING_STATUS.PENDING,
        pairing_type: PAIRING_TYPE.NORMAL,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    logger.info('Pairing created', { pairingId: pairing.id, userId });

    return pairing;
  }

  /**
   * 加入配對（完整模式）
   */
  async joinPairing(userId: string, inviteCode: string) {
    // 1. 查找配對記錄
    const pairing = await prisma.pairing.findUnique({
      where: { invite_code: inviteCode },
      include: {
        user1: true,
        user2: true,
      },
    });

    if (!pairing) {
      throw Errors.INVALID_CODE('邀請碼無效');
    }

    // 2. 檢查是否過期
    if (pairing.expires_at && pairing.expires_at < new Date()) {
      throw Errors.CODE_EXPIRED('邀請碼已過期');
    }

    // 3. 檢查是否已使用
    if (pairing.status !== PAIRING_STATUS.PENDING) {
      throw Errors.INVALID_CODE('邀請碼已使用');
    }

    // 4. 檢查是否自己配對
    if (pairing.user1_id === userId) {
      throw Errors.VALIDATION_ERROR('不能與自己配對');
    }

    // 5. 加入者不能同時存在另一個正式 pending/active pairing
    const existingPairing = await prisma.pairing.findFirst({
      where: buildActiveNormalPairingWhere(userId, pairing.id),
      select: { id: true },
    });

    if (existingPairing) {
      throw Errors.ALREADY_PAIRED();
    }

    // 6. 原子更新：只有 status 仍為 PENDING 且尚未被填入 user2 才成功（防止並發）
    const { count } = await prisma.pairing.updateMany({
      where: {
        id: pairing.id,
        status: PAIRING_STATUS.PENDING,
        pairing_type: PAIRING_TYPE.NORMAL,
        user2_id: null,
      },
      data: {
        user2_id: userId,
        status: PAIRING_STATUS.ACTIVE,
        confirmed_at: new Date(),
      },
    });

    if (count === 0) {
      throw Errors.INVALID_CODE('邀請碼已使用');
    }

    logger.info('Pairing joined', { pairingId: pairing.id, userId });

    const updatedPairing = await prisma.pairing.findUnique({
      where: { id: pairing.id },
      include: {
        user1: true,
        user2: true,
      },
    });

    emailService.sendPairingNotification(pairing.user1_id!, userId).catch(err => {
      logger.warn('Failed to send pairing notification email', { pairingId: pairing.id, error: err });
    });

    return {
      ...updatedPairing!,
      user1: signAvatar(updatedPairing!.user1),
      user2: signAvatar(updatedPairing!.user2),
    };
  }

  /**
   * 獲取配對狀態
   */
  async getPairingStatus(userId: string) {
    const pairing = await prisma.pairing.findFirst({
      where: {
        OR: [
          { user1_id: userId },
          { user2_id: userId },
        ],
        status: { in: [...NORMAL_PAIRING_ACTIVE_STATUSES] },
        pairing_type: PAIRING_TYPE.NORMAL,
      },
      include: {
        user1: {
          select: {
            id: true,
            email: true,
            nickname: true,
            avatar_url: true,
          },
        },
        user2: {
          select: {
            id: true,
            email: true,
            nickname: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!pairing) return pairing;

    return {
      ...pairing,
      user1: signAvatar(pairing.user1),
      user2: signAvatar(pairing.user2),
    };
  }

  /**
   * 解除配對
   */
  async cancelPairing(userId: string) {
    const pairing = await prisma.pairing.findFirst({
      where: {
        OR: [
          { user1_id: userId },
          { user2_id: userId },
        ],
        status: { in: [...NORMAL_PAIRING_ACTIVE_STATUSES] },
        pairing_type: PAIRING_TYPE.NORMAL,
      },
    });

    if (!pairing) {
      throw Errors.NOT_FOUND('當前沒有可解除的配對');
    }

    const isMember = pairing.user1_id === userId || pairing.user2_id === userId;
    if (!isMember) {
      throw Errors.FORBIDDEN('無權限解除此配對');
    }

    const updated = await prisma.pairing.update({
      where: { id: pairing.id },
      data: {
        status: PAIRING_STATUS.CANCELLED,
        cancelled_at: new Date(),
      },
    });

    return updated;
  }

  /**
   * 創建臨時配對（快速體驗模式）
   */
  async createTempPairing(sessionId: string) {
    return lockService.withLock(`pairing:quick:${sessionId}`, async () => {
      const existingPairing = await prisma.pairing.findFirst({
        where: {
          session_id: sessionId,
          pairing_type: PAIRING_TYPE.QUICK,
        },
      });

      if (existingPairing) {
        return existingPairing;
      }

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const dailyCount = await prisma.pairing.count({
        where: {
          pairing_type: PAIRING_TYPE.QUICK,
          created_at: { gte: todayStart },
        },
      });
      const DAILY_LIMIT = 5000;
      if (dailyCount >= DAILY_LIMIT) {
        throw Errors.RATE_LIMIT_EXCEEDED('臨時配對數量達到上限，請稍後重試');
      }
      if (dailyCount > DAILY_LIMIT * 0.8) {
        logger.warn('Temp pairing nearing daily limit', { dailyCount, limit: DAILY_LIMIT });
      }

      return prisma.pairing.create({
        data: {
          user1_id: null,
          user2_id: null,
          invite_code: null,
          status: PAIRING_STATUS.TEMP,
          pairing_type: PAIRING_TYPE.QUICK,
          session_id: sessionId,
          expires_at: null,
        },
      });
    }, LOCK_TTL.PAIRING_CREATE);
  }

  /**
   * 通過Session ID獲取配對（快速體驗模式）
   */
  async getPairingBySessionId(sessionId: string) {
    const pairing = await prisma.pairing.findFirst({
      where: {
        session_id: sessionId,
        pairing_type: PAIRING_TYPE.QUICK,
      },
    });

    return pairing;
  }
}

export const pairingService = new PairingService();
