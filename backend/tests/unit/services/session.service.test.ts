/**
 * SessionService 單元測試（mock Prisma、utils/session）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGenerateSessionId = jest.fn();
const mockValidateSessionId = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  quickSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
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
  generateSessionId: () => mockGenerateSessionId(),
  validateSessionId: (s: string) => mockValidateSessionId(s),
}));

import { SessionService } from '../../../src/services/session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SessionService();
  });

  describe('createSession', () => {
    it('應返回 session_id 與 expires_at', async () => {
      const sessionId = 'guest_1700000000000_abc123def4567890';
      mockGenerateSessionId.mockReturnValue(sessionId);
      prismaMock.quickSession.create.mockResolvedValue({ id: sessionId, expires_at: new Date() });

      const result = await service.createSession();

      expect(result.session_id).toBe(sessionId);
      expect(result.expires_at).toBeInstanceOf(Date);
      const expectedMin = Date.now() + 23 * 60 * 60 * 1000; // 約 24h 前 1h
      const expectedMax = Date.now() + 25 * 60 * 60 * 1000; // 約 24h 後 1h
      expect(result.expires_at.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(result.expires_at.getTime()).toBeLessThanOrEqual(expectedMax);
      expect(prismaMock.quickSession.create).toHaveBeenCalledWith({
        data: { id: sessionId, expires_at: expect.any(Date) },
      });
    });

    it('創建失敗應拋出 INTERNAL_ERROR', async () => {
      mockGenerateSessionId.mockReturnValue('guest_1_abc');
      prismaMock.quickSession.create.mockRejectedValue(new Error('DB error'));

      await expect(service.createSession()).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('Session'),
      });
    });
  });

  describe('getSession', () => {
    it('Session ID 格式無效應拋出 INVALID_SESSION_ID', async () => {
      mockValidateSessionId.mockReturnValue(false);

      await expect(service.getSession('bad')).rejects.toMatchObject({
        code: 'INVALID_SESSION_ID',
      });
    });

    it('Session 不存在應返回 null', async () => {
      mockValidateSessionId.mockReturnValue(true);
      prismaMock.quickSession.findUnique.mockResolvedValue(null);

      const result = await service.getSession('guest_1700000000000_abc123def4567890');
      expect(result).toBeNull();
    });

    it('Session 已過期應返回 null 並觸發刪除', async () => {
      const sessionId = 'guest_1700000000000_abc123def4567890';
      mockValidateSessionId.mockReturnValue(true);
      prismaMock.quickSession.findUnique.mockResolvedValue({
        id: sessionId,
        expires_at: new Date(Date.now() - 1000),
      });
      prismaMock.quickSession.delete.mockResolvedValue({} as never);

      const result = await service.getSession(sessionId);
      expect(result).toBeNull();
      expect(prismaMock.quickSession.delete).toHaveBeenCalledWith({ where: { id: sessionId } });
    });

    it('Session 已過期且 delete 失敗時仍應返回 null（catch 忽略刪除錯誤）', async () => {
      const sessionId = 'guest_1700000000000_abc123def4567890';
      mockValidateSessionId.mockReturnValue(true);
      prismaMock.quickSession.findUnique.mockResolvedValue({
        id: sessionId,
        expires_at: new Date(Date.now() - 1000),
      });
      prismaMock.quickSession.delete.mockRejectedValue(new Error('delete failed'));

      const result = await service.getSession(sessionId);
      expect(result).toBeNull();
      await new Promise(r => setImmediate(r));
    });

    it('Session 有效應返回 session', async () => {
      const sessionId = 'guest_1700000000000_abc123def4567890';
      const session = {
        id: sessionId,
        expires_at: new Date(Date.now() + 3600000),
      };
      mockValidateSessionId.mockReturnValue(true);
      prismaMock.quickSession.findUnique.mockResolvedValue(session);

      const result = await service.getSession(sessionId);
      expect(result).toEqual(session);
    });
  });

  describe('addCaseToSession', () => {
    it('應調用 quickSession.update', async () => {
      prismaMock.quickSession.update.mockResolvedValue({});

      await service.addCaseToSession('s1', 'case-1');

      expect(prismaMock.quickSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { case_id: 'case-1' },
      });
    });

    it('更新失敗應拋出 INTERNAL_ERROR', async () => {
      prismaMock.quickSession.update.mockRejectedValue(new Error('DB error'));

      await expect(service.addCaseToSession('s1', 'case-1')).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('addPairingToSession', () => {
    it('應調用 quickSession.update', async () => {
      prismaMock.quickSession.update.mockResolvedValue({});

      await service.addPairingToSession('s1', 'pairing-1');

      expect(prismaMock.quickSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { pairing_id: 'pairing-1' },
      });
    });

    it('更新失敗應拋出 INTERNAL_ERROR', async () => {
      prismaMock.quickSession.update.mockRejectedValue(new Error('DB error'));

      await expect(service.addPairingToSession('s1', 'p1')).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('markSessionCompleted', () => {
    it('應延長 expires_at 並調用 update', async () => {
      prismaMock.quickSession.update.mockResolvedValue({});

      await service.markSessionCompleted('s1');

      expect(prismaMock.quickSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { expires_at: expect.any(Date) },
      });
    });

    it('更新失敗不拋出（僅 log）', async () => {
      prismaMock.quickSession.update.mockRejectedValue(new Error('DB error'));

      await expect(service.markSessionCompleted('s1')).resolves.toBeUndefined();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('無過期 Session 應返回 0', async () => {
      prismaMock.quickSession.findMany.mockResolvedValue([]);

      const count = await service.cleanupExpiredSessions(100);
      expect(count).toBe(0);
      expect(prismaMock.quickSession.deleteMany).not.toHaveBeenCalled();
    });

    it('有過期 Session 應刪除並返回數量', async () => {
      prismaMock.quickSession.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
      ]);
      prismaMock.quickSession.deleteMany.mockResolvedValue({ count: 2 });

      const count = await service.cleanupExpiredSessions(100);
      expect(count).toBe(2);
      expect(prismaMock.quickSession.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['s1', 's2'] } },
      });
    });

    it('deleteMany 失敗應返回 0', async () => {
      prismaMock.quickSession.findMany.mockResolvedValue([{ id: 's1' }]);
      prismaMock.quickSession.deleteMany.mockRejectedValue(new Error('DB error'));

      const count = await service.cleanupExpiredSessions(100);
      expect(count).toBe(0);
    });

    it('清理數量達到 limit 時應記錄 logger.warn', async () => {
      const limit = 2;
      prismaMock.quickSession.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      prismaMock.quickSession.deleteMany.mockResolvedValue({ count: 2 });

      const count = await service.cleanupExpiredSessions(limit);
      expect(count).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith('Large number of sessions cleaned up (hit batch limit)', {
        count: 2,
        limit: 2,
      });
    });
  });
});
