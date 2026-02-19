/**
 * SessionController 單元測試（mock sessionService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { SessionController } from '../../../src/controllers/session.controller';
import { sessionService } from '../../../src/services/session.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateSession: any = jest.fn();

jest.mock('../../../src/services/session.service', () => ({
  sessionService: {
    createSession: () => mockCreateSession(),
  },
}));

describe('SessionController', () => {
  let controller: SessionController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SessionController(sessionService);
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
});
