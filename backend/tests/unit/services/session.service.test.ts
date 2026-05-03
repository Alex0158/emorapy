/**
 * SessionService 單元測試（mock Prisma、utils/session）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGenerateSessionId = jest.fn();
const mockValidateSessionId = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  $transaction: jest.fn(),
  quickSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  case: {
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  pairing: {
    update: jest.fn(),
    updateMany: jest.fn(),
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

const buildExpectedClaimableSessionCaseWhere = (sessionId: string) => ({
  OR: [
    {
      mode: 'quick',
      OR: [
        { session_id: sessionId },
        { quick_sessions: { some: { id: sessionId } } },
      ],
    },
    {
      mode: 'collaborative',
      session_id: sessionId,
    },
  ],
});

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        quickSession: {
          create: prismaMock.quickSession.create,
          deleteMany: prismaMock.quickSession.deleteMany,
        },
        case: { updateMany: prismaMock.case.updateMany },
        pairing: { updateMany: prismaMock.pairing.updateMany },
      })
    );
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

  describe('refreshSession', () => {
    it('未提供 currentSessionId 時應創建新 Session', async () => {
      const sessionId = 'guest_1700000000000_newsession';
      mockGenerateSessionId.mockReturnValue(sessionId);
      prismaMock.quickSession.create.mockResolvedValue({ id: sessionId, expires_at: new Date() });

      const result = await service.refreshSession();
      expect(result.session_id).toBe(sessionId);
      expect(prismaMock.quickSession.create).toHaveBeenCalled();
    });

    it('currentSessionId 格式無效時應回退創建新 Session', async () => {
      const sessionId = 'guest_1700000000000_newsession';
      mockValidateSessionId.mockReturnValue(false);
      mockGenerateSessionId.mockReturnValue(sessionId);
      prismaMock.quickSession.create.mockResolvedValue({ id: sessionId, expires_at: new Date() });

      const result = await service.refreshSession('bad-session');
      expect(result.session_id).toBe(sessionId);
      expect(prismaMock.quickSession.findUnique).not.toHaveBeenCalled();
    });

    it('舊 Session 不存在或已過期時應回退創建新 Session', async () => {
      const sessionId = 'guest_1700000000000_newsession';
      mockValidateSessionId.mockReturnValue(true);
      prismaMock.quickSession.findUnique.mockResolvedValueOnce(null);
      mockGenerateSessionId.mockReturnValue(sessionId);
      prismaMock.quickSession.create.mockResolvedValue({ id: sessionId, expires_at: new Date() });

      const result = await service.refreshSession('guest_1700000000000_old');
      expect(result.session_id).toBe(sessionId);
    });

    it('有效舊 Session 應旋轉為新 Session', async () => {
      const oldId = 'guest_1700000000000_old';
      const newId = 'guest_1700000000000_new';
      mockValidateSessionId.mockReturnValue(true);
      mockGenerateSessionId.mockReturnValue(newId);
      prismaMock.quickSession.findUnique.mockResolvedValue({
        id: oldId,
        expires_at: new Date(Date.now() + 60_000),
        case_id: null,
        pairing_id: null,
        session_data: null,
      });
      prismaMock.quickSession.create.mockResolvedValue({});
      prismaMock.quickSession.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.refreshSession(oldId);
      expect(result.session_id).toBe(newId);
      expect(prismaMock.quickSession.create).toHaveBeenCalled();
      expect(prismaMock.quickSession.deleteMany).toHaveBeenCalledWith({ where: { id: oldId } });
    });

    it('旋轉時 case/pairing 關聯更新失敗應導致事務失敗並拋出 INTERNAL_ERROR', async () => {
      const oldId = 'guest_1700000000000_old';
      const newId = 'guest_1700000000000_new';
      mockValidateSessionId.mockReturnValue(true);
      mockGenerateSessionId.mockReturnValue(newId);
      prismaMock.quickSession.findUnique.mockResolvedValue({
        id: oldId,
        expires_at: new Date(Date.now() + 60_000),
        case_id: 'case-1',
        pairing_id: 'pair-1',
        session_data: { foo: 'bar' },
      });
      prismaMock.quickSession.create.mockResolvedValue({});
      prismaMock.case.updateMany.mockRejectedValueOnce(new Error('case update fail'));

      await expect(service.refreshSession(oldId)).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('Session'),
      });
      expect(prismaMock.case.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'case-1',
          ...buildExpectedClaimableSessionCaseWhere(oldId),
        },
        data: { session_id: newId },
      });
    });

    it('旋轉時有 case_id/pairing_id 應調用 updateMany 並成功', async () => {
      const oldId = 'guest_1700000000000_old';
      const newId = 'guest_1700000000000_new';
      mockValidateSessionId.mockReturnValue(true);
      mockGenerateSessionId.mockReturnValue(newId);
      prismaMock.quickSession.findUnique.mockResolvedValue({
        id: oldId,
        expires_at: new Date(Date.now() + 60_000),
        case_id: 'case-1',
        pairing_id: 'pair-1',
        session_data: { foo: 'bar' },
      });
      prismaMock.quickSession.create.mockResolvedValue({});
      prismaMock.case.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.pairing.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.quickSession.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.refreshSession(oldId);
      expect(result.session_id).toBe(newId);
      expect(prismaMock.case.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'case-1',
          ...buildExpectedClaimableSessionCaseWhere(oldId),
        },
        data: { session_id: newId },
      });
      expect(prismaMock.pairing.updateMany).toHaveBeenCalledWith({
        where: { id: 'pair-1', session_id: oldId },
        data: { session_id: newId },
      });
    });

    it('旋轉事務失敗時應拋出 INTERNAL_ERROR', async () => {
      const oldId = 'guest_1700000000000_old';
      const newId = 'guest_1700000000000_new';
      mockValidateSessionId.mockReturnValue(true);
      mockGenerateSessionId.mockReturnValue(newId);
      prismaMock.quickSession.findUnique.mockResolvedValue({
        id: oldId,
        expires_at: new Date(Date.now() + 60_000),
        case_id: null,
        pairing_id: null,
        session_data: null,
      });
      prismaMock.$transaction.mockRejectedValueOnce(new Error('tx fail'));

      await expect(service.refreshSession(oldId)).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('Session'),
      });
    });
  });

  describe('addCaseToSession', () => {
    it('應調用 quickSession.update', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1' });
      prismaMock.quickSession.update.mockResolvedValue({});

      await service.addCaseToSession('s1', 'case-1');

      expect(prismaMock.quickSession.findUnique).toHaveBeenCalledWith({
        where: { id: 's1' },
        select: { id: true },
      });
      expect(prismaMock.quickSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { case_id: 'case-1' },
      });
    });

    it('session 不存在時應拋出 SESSION_EXPIRED（F01 邊界：與 psych-profile giveConsent 對齊）', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue(null);

      await expect(service.addCaseToSession('nonexistent', 'case-1')).rejects.toMatchObject({
        code: 'SESSION_EXPIRED',
        message: expect.stringContaining('Session'),
      });
      expect(prismaMock.quickSession.update).not.toHaveBeenCalled();
    });

    it('更新失敗應拋出 INTERNAL_ERROR', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1' });
      prismaMock.quickSession.update.mockRejectedValue(new Error('DB error'));

      await expect(service.addCaseToSession('s1', 'case-1')).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('addPairingToSession', () => {
    it('應調用 quickSession.update', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1' });
      prismaMock.quickSession.update.mockResolvedValue({});

      await service.addPairingToSession('s1', 'pairing-1');

      expect(prismaMock.quickSession.findUnique).toHaveBeenCalledWith({
        where: { id: 's1' },
        select: { id: true },
      });
      expect(prismaMock.quickSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { pairing_id: 'pairing-1' },
      });
    });

    it('session 不存在時應拋出 SESSION_EXPIRED（F01 邊界：與 addCaseToSession 對齊）', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue(null);

      await expect(service.addPairingToSession('nonexistent', 'p1')).rejects.toMatchObject({
        code: 'SESSION_EXPIRED',
        message: expect.stringContaining('Session'),
      });
      expect(prismaMock.quickSession.update).not.toHaveBeenCalled();
    });

    it('更新失敗應拋出 INTERNAL_ERROR', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1' });
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
    it('未傳 limit 時應使用默認 1000', async () => {
      prismaMock.quickSession.findMany.mockResolvedValue([]);

      const count = await service.cleanupExpiredSessions();
      expect(count).toBe(0);
      expect(prismaMock.quickSession.findMany).toHaveBeenCalledWith({
        where: { expires_at: { lt: expect.any(Date) } },
        select: { id: true },
        take: 1000,
      });
    });

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
