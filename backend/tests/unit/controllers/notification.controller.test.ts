/**
 * NotificationController 單元測試（mock notificationService、getAuthUserId）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { NotificationController } from '../../../src/controllers/notification.controller';
import { notificationService } from '../../../src/services/notification.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockList: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreate: any = jest.fn();
const mockGetAuthUserId = jest.fn();

jest.mock('../../../src/services/notification.service', () => ({
  notificationService: {
    list: (userId: string, status?: string) => mockList(userId, status),
    create: (userId: string, data: unknown) => mockCreate(userId, data),
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getAuthUserId: (req: Request) => mockGetAuthUserId(req),
}));

describe('NotificationController', () => {
  let controller: NotificationController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NotificationController();
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() } as unknown as Response;
    next = jest.fn();
    mockGetAuthUserId.mockReturnValue('u1');
  });

  describe('list', () => {
    it('無通知時應返回 notifications 空陣列（F09/F10 邊界）', async () => {
      mockList.mockResolvedValue([]);

      await controller.list(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { notifications: [] },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('成功應調用 list 並返回 notifications', async () => {
      const notifications = [{ id: 'n1', user_id: 'u1' }];
      mockList.mockResolvedValue(notifications);

      await controller.list(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockList).toHaveBeenCalledWith('u1', undefined);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { notifications },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('有 status query 時應傳入 list', async () => {
      req.query = { status: 'sent' };
      mockList.mockResolvedValue([]);

      await controller.list(req as Request, res as Response, next);

      expect(mockList).toHaveBeenCalledWith('u1', 'sent');
    });

    it('status 無效時應拋出 VALIDATION_ERROR', async () => {
      req.query = { status: 'invalid_status' };

      await controller.list(req as Request, res as Response, next);

      expect(mockList).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('list 拋錯時應 next(error)', async () => {
      mockList.mockRejectedValue(new Error('db error'));

      await controller.list(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('create', () => {
    it('成功應調用 create 並返回 201', async () => {
      req.body = { channel: 'email', template_code: 'welcome', payload: {} };
      const notification = { id: 'n1', channel: 'email', template_code: 'welcome' };
      mockCreate.mockResolvedValue(notification);

      await controller.create(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockCreate).toHaveBeenCalledWith('u1', {
        channel: 'email',
        template_code: 'welcome',
        payload: {},
        dedup_key: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { notification },
        message: '通知已記錄',
      });
    });

    it('channel 無效時應拋出 VALIDATION_ERROR', async () => {
      req.body = { channel: 'invalid', template_code: 'welcome' };

      await controller.create(req as Request, res as Response, next);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: expect.stringContaining('channel') })
      );
    });

    it('缺少 template_code 時應拋出 VALIDATION_ERROR', async () => {
      req.body = { channel: 'email' };

      await controller.create(req as Request, res as Response, next);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: expect.stringContaining('template_code') })
      );
    });

    it('有 dedup_key 時應傳入 create', async () => {
      req.body = { channel: 'push', template_code: 't1', dedup_key: 'key1' };
      mockCreate.mockResolvedValue({ id: 'n1' });

      await controller.create(req as Request, res as Response, next);

      expect(mockCreate).toHaveBeenCalledWith('u1', {
        channel: 'push',
        template_code: 't1',
        payload: {},
        dedup_key: 'key1',
      });
    });

    it('create 拋錯時應 next(error)', async () => {
      req.body = { channel: 'email', template_code: 't1' };
      mockCreate.mockRejectedValue(new Error('db error'));

      await controller.create(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
