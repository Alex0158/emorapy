/**
 * SessionController 單元測試（mock sessionService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { SessionController } from '../../../src/controllers/session.controller';
import { sessionService } from '../../../src/services/session.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateSession: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRefreshSession: any = jest.fn();

jest.mock('../../../src/services/session.service', () => ({
  sessionService: {
    createSession: () => mockCreateSession(),
    refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
  },
}));

describe('SessionController', () => {
  let controller: SessionController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SessionController();
    req = {};
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    } as unknown as Response;
    next = jest.fn();
  });

  describe('createSession', () => {
    it('成功應調用 sessionService.createSession 並返回 JSON', async () => {
      const result = {
        session_id: 'guest_1700000000000_abc123',
        expires_at: new Date(Date.now() + 86400000),
      };
      mockCreateSession.mockResolvedValue(result);

      await controller.createSession(req as Request, res as Response, next);

      expect(mockCreateSession).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: result,
        message: 'Session創建成功',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('sessionService 拋錯應調用 next(error)', async () => {
      const err = new Error('DB error');
      mockCreateSession.mockRejectedValue(err as never);

      await controller.createSession(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('refreshSession', () => {
    it('成功應調用 sessionService.refreshSession 並返回 JSON', async () => {
      req = { headers: { 'x-session-id': 'guest_1_abc12345' }, query: {} };
      const result = {
        session_id: 'guest_1700000000000_new123',
        expires_at: new Date(Date.now() + 86400000),
      };
      mockRefreshSession.mockResolvedValue(result);

      await controller.refreshSession(req as Request, res as Response, next);

      expect(mockRefreshSession).toHaveBeenCalledWith('guest_1_abc12345');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: result,
        message: 'Session刷新成功',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('header/query session 不一致時應調用 next(INVALID_SESSION_ID)', async () => {
      req = {
        headers: { 'x-session-id': 'guest_header_1' },
        query: { session_id: 'guest_query_1' },
      };

      await controller.refreshSession(req as Request, res as Response, next);

      expect(mockRefreshSession).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(((next as jest.Mock).mock.calls[0][0] as any).code).toBe('INVALID_SESSION_ID');
    });

    it('refreshSession 拋錯時應調用 next(error)', async () => {
      req = { headers: { 'x-session-id': 'guest_1_abc12345' }, query: {} };
      const err = new Error('refresh failed');
      mockRefreshSession.mockRejectedValueOnce(err as never);

      await controller.refreshSession(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.json).not.toHaveBeenCalled();
    });

    it('header/query 皆無 session 時應調用 refreshSession(undefined) 等同創建新 session（F01 邊界）', async () => {
      req = { headers: {}, query: {} };
      const result = {
        session_id: 'guest_new123',
        expires_at: new Date(Date.now() + 86400000),
      };
      mockRefreshSession.mockResolvedValue(result);

      await controller.refreshSession(req as Request, res as Response, next);

      expect(mockRefreshSession).toHaveBeenCalledWith(undefined);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: result,
        message: 'Session刷新成功',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('僅 query 有 session 時應使用 query session_id', async () => {
      req = { headers: {}, query: { session_id: 'guest_query_only' } };
      const result = {
        session_id: 'guest_rotated',
        expires_at: new Date(Date.now() + 86400000),
      };
      mockRefreshSession.mockResolvedValue(result);

      await controller.refreshSession(req as Request, res as Response, next);

      expect(mockRefreshSession).toHaveBeenCalledWith('guest_query_only');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: result,
        message: 'Session刷新成功',
      });
    });
  });
});
