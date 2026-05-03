/**
 * PairingService 單元測試（mock Prisma、generateInviteCode、fileService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGenerateInviteCode = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  pairing: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('../../../src/utils/session', () => ({
  generateInviteCode: () => mockGenerateInviteCode(),
}));
jest.mock('../../../src/services/file.service', () => ({
  fileService: { signUrl: (url: string) => `signed:${url}` },
  signAvatar: <T extends { avatar_url?: string | null }>(user: T | null | undefined): T | null | undefined => {
    if (!user?.avatar_url) return user;
    return { ...user, avatar_url: `signed:${user.avatar_url}` };
  },
}));

import { PairingService } from '../../../src/services/pairing.service';

describe('PairingService', () => {
  let service: PairingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.pairing.findFirst.mockResolvedValue(null);
    prismaMock.pairing.findUnique.mockResolvedValue(null);
    prismaMock.pairing.updateMany.mockResolvedValue({ count: 0 });
    service = new PairingService();
  });

  describe('createPairing', () => {
    it('已有配對應拋出 ALREADY_PAIRED', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue({ id: 'p1', user1_id: 'u1' });

      await expect(service.createPairing('u1')).rejects.toMatchObject({
        code: 'ALREADY_PAIRED',
      });
      expect(prismaMock.pairing.create).not.toHaveBeenCalled();
    });

    it('成功應創建配對並返回', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue(null);
      mockGenerateInviteCode.mockReturnValue('ABC123');
      prismaMock.pairing.findUnique.mockResolvedValue(null);
      prismaMock.pairing.create.mockResolvedValue({
        id: 'pair-1',
        user1_id: 'u1',
        invite_code: 'ABC123',
        status: 'pending',
        pairing_type: 'normal',
        expires_at: new Date(),
      });

      const result = await service.createPairing('u1');

      expect(result.id).toBe('pair-1');
      expect(result.invite_code).toBe('ABC123');
      expect(prismaMock.pairing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user1_id: 'u1',
          invite_code: 'ABC123',
          status: 'pending',
          pairing_type: 'normal',
        }),
      });
    });

    it('連續 10 次都無法生成唯一邀請碼時應拋 INTERNAL_ERROR', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue(null);
      mockGenerateInviteCode.mockReturnValue('ABC123');
      prismaMock.pairing.findUnique.mockResolvedValue({ id: 'existing', invite_code: 'ABC123' });

      await expect(service.createPairing('u1')).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
      });
      expect(prismaMock.pairing.findUnique).toHaveBeenCalledTimes(10);
      expect(prismaMock.pairing.create).not.toHaveBeenCalled();
    });
  });

  describe('joinPairing', () => {
    it('邀請碼無效應拋出 INVALID_CODE', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue(null);

      await expect(service.joinPairing('u2', 'BAD')).rejects.toMatchObject({
        code: 'INVALID_CODE',
      });
    });

    it('邀請碼已過期應拋出 CODE_EXPIRED', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'p1',
        invite_code: 'ABC123',
        expires_at: new Date(Date.now() - 1000),
        status: 'pending',
        user1_id: 'u1',
        user2_id: null,
        user1: { avatar_url: null },
        user2: null,
      });

      await expect(service.joinPairing('u2', 'ABC123')).rejects.toMatchObject({
        code: 'CODE_EXPIRED',
      });
    });

    it('邀請碼已使用應拋出 INVALID_CODE', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'p1',
        invite_code: 'ABC123',
        expires_at: new Date(Date.now() + 3600000),
        status: 'active',
        user1_id: 'u1',
        user2_id: 'u2',
        user1: { avatar_url: null },
        user2: { avatar_url: null },
      });

      await expect(service.joinPairing('u3', 'ABC123')).rejects.toMatchObject({
        code: 'INVALID_CODE',
      });
    });

    it('自己加入自己應拋出 VALIDATION_ERROR', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'p1',
        invite_code: 'ABC123',
        expires_at: new Date(Date.now() + 3600000),
        status: 'pending',
        user1_id: 'u1',
        user2_id: null,
        user1: { avatar_url: null },
        user2: null,
      });

      await expect(service.joinPairing('u1', 'ABC123')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('自己'),
      });
    });

    it('成功應更新配對並返回', async () => {
      const pairing = {
        id: 'p1',
        invite_code: 'ABC123',
        expires_at: new Date(Date.now() + 3600000),
        status: 'pending',
        user1_id: 'u1',
        user2_id: null,
        user1: { avatar_url: null },
        user2: null,
      };
      prismaMock.pairing.findUnique
        .mockResolvedValueOnce(pairing)
        .mockResolvedValueOnce({
          ...pairing,
          user2_id: 'u2',
          status: 'active',
          user1: { avatar_url: null },
          user2: { avatar_url: null },
        });
      prismaMock.pairing.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.joinPairing('u2', 'ABC123');

      expect(result.status).toBe('active');
      expect(prismaMock.pairing.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'p1',
          status: 'pending',
          pairing_type: 'normal',
          user2_id: null,
        },
        data: expect.objectContaining({
          user2_id: 'u2',
          status: 'active',
        }),
      });
    });

    it('加入者已有其他正式配對時應拋出 ALREADY_PAIRED', async () => {
      prismaMock.pairing.findUnique.mockResolvedValue({
        id: 'p1',
        invite_code: 'ABC123',
        expires_at: new Date(Date.now() + 3600000),
        status: 'pending',
        user1_id: 'u1',
        user2_id: null,
        user1: { avatar_url: null },
        user2: null,
      });
      prismaMock.pairing.findFirst.mockResolvedValue({
        id: 'p-existing',
        status: 'active',
        pairing_type: 'normal',
      });

      await expect(service.joinPairing('u2', 'ABC123')).rejects.toMatchObject({
        code: 'ALREADY_PAIRED',
      });
      expect(prismaMock.pairing.updateMany).not.toHaveBeenCalled();
    });

    it('並發加入時 updateMany count=0 應拋出已使用錯誤', async () => {
      const pairing = {
        id: 'p1',
        invite_code: 'ABC123',
        expires_at: new Date(Date.now() + 3600000),
        status: 'pending',
        user1_id: 'u1',
        user2_id: null,
        user1: { avatar_url: null },
        user2: null,
      };
      prismaMock.pairing.findUnique.mockResolvedValue(pairing);
      prismaMock.pairing.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.joinPairing('u2', 'ABC123')).rejects.toMatchObject({
        code: 'INVALID_CODE',
        message: expect.stringContaining('已使用'),
      });
    });

    it('成功加入時若 user1/user2 有 avatar_url 應在回傳中簽名', async () => {
      const pairing = {
        id: 'p1',
        invite_code: 'ABC123',
        expires_at: new Date(Date.now() + 3600000),
        status: 'pending',
        user1_id: 'u1',
        user2_id: null,
        user1: { avatar_url: '/u1.jpg' },
        user2: { avatar_url: '/u2.jpg' },
      };
      prismaMock.pairing.findUnique
        .mockResolvedValueOnce(pairing)
        .mockResolvedValueOnce({
          ...pairing,
          user2_id: 'u2',
          status: 'active',
          user1: { avatar_url: '/u1.jpg' },
          user2: { avatar_url: '/u2.jpg' },
        });
      prismaMock.pairing.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.joinPairing('u2', 'ABC123');

      expect(result.user1!.avatar_url).toBe('signed:/u1.jpg');
      expect(result.user2!.avatar_url).toBe('signed:/u2.jpg');
    });
  });

  describe('createTempPairing', () => {
    it('已有臨時配對應直接返回', async () => {
      const existing = {
        id: 'tp1',
        session_id: 's1',
        pairing_type: 'quick',
        status: 'temp',
      };
      prismaMock.pairing.findFirst.mockResolvedValue(existing);

      const result = await service.createTempPairing('s1');

      expect(result).toEqual(existing);
      expect(prismaMock.pairing.create).not.toHaveBeenCalled();
    });

    it('達到每日上限應拋出 RATE_LIMIT_EXCEEDED', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue(null);
      prismaMock.pairing.count.mockResolvedValue(5000);

      await expect(service.createTempPairing('s1')).rejects.toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
      });
    });

    it('每日數量接近上限（>80%）時應記錄 logger.warn 且仍創建', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue(null);
      prismaMock.pairing.count.mockResolvedValue(4001);
      prismaMock.pairing.create.mockResolvedValue({
        id: 'tp1',
        session_id: 's1',
        pairing_type: 'quick',
        status: 'temp',
        user1_id: null,
        user2_id: null,
        invite_code: null,
        expires_at: null,
      });

      const result = await service.createTempPairing('s1');

      expect(mockLogger.warn).toHaveBeenCalledWith('Temp pairing nearing daily limit', { dailyCount: 4001, limit: 5000 });
      expect(result.id).toBe('tp1');
    });

    it('成功應創建臨時配對', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue(null);
      prismaMock.pairing.count.mockResolvedValue(0);
      prismaMock.pairing.create.mockResolvedValue({
        id: 'tp1',
        session_id: 's1',
        pairing_type: 'quick',
        status: 'temp',
        user1_id: null,
        user2_id: null,
        invite_code: null,
        expires_at: null,
      });

      const result = await service.createTempPairing('s1');

      expect(result.id).toBe('tp1');
      expect(result.session_id).toBe('s1');
      expect(prismaMock.pairing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          session_id: 's1',
          pairing_type: 'quick',
          status: 'temp',
        }),
      });
    });
  });

  describe('getPairingBySessionId', () => {
    it('無配對應返回 null', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue(null);

      const result = await service.getPairingBySessionId('s1');
      expect(result).toBeNull();
    });

    it('有配對應返回配對', async () => {
      const pairing = { id: 'tp1', session_id: 's1', pairing_type: 'quick' };
      prismaMock.pairing.findFirst.mockResolvedValue(pairing);

      const result = await service.getPairingBySessionId('s1');
      expect(result).toEqual(pairing);
    });
  });

  describe('cancelPairing', () => {
    it('無配對應拋出 NOT_FOUND', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue(null);

      await expect(service.cancelPairing('u1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('非成員應拋出 FORBIDDEN', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue({
        id: 'p1',
        user1_id: 'u1',
        user2_id: 'u2',
      });

      await expect(service.cancelPairing('u3')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('成功應更新為 cancelled', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue({
        id: 'p1',
        user1_id: 'u1',
        user2_id: null,
      });
      prismaMock.pairing.update.mockResolvedValue({
        id: 'p1',
        status: 'cancelled',
      });

      const result = await service.cancelPairing('u1');

      expect(result.status).toBe('cancelled');
      expect(prismaMock.pairing.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: expect.objectContaining({ status: 'cancelled' }),
      });
    });
  });

  describe('getPairingStatus', () => {
    it('無配對應返回 null', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue(null);

      const result = await service.getPairingStatus('u1');
      expect(result).toBeNull();
    });

    it('有配對應返回並簽名 avatar_url', async () => {
      prismaMock.pairing.findFirst.mockResolvedValue({
        id: 'p1',
        user1: { id: 'u1', avatar_url: '/a.jpg' },
        user2: null,
      });

      const result = await service.getPairingStatus('u1');

      expect(result).toBeDefined();
      expect(result!.user1!.avatar_url).toBe('signed:/a.jpg');
    });
  });
});
