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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUnreadCount: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMarkRead: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMarkAllRead: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDismiss: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSnooze: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAct: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRegisterDeviceToken: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRevokeDeviceToken: any = jest.fn();
const mockGetAuthUserId = jest.fn();

jest.mock('../../../src/services/notification.service', () => ({
  notificationService: {
    list: (userId: string, filters?: unknown) => mockList(userId, filters),
    create: (userId: string, data: unknown) => mockCreate(userId, data),
    getUnreadCount: (userId: string) => mockUnreadCount(userId),
    markRead: (userId: string, notificationId: string) => mockMarkRead(userId, notificationId),
    markAllRead: (userId: string) => mockMarkAllRead(userId),
    dismiss: (userId: string, notificationId: string) => mockDismiss(userId, notificationId),
    snooze: (userId: string, notificationId: string, hours?: number) => mockSnooze(userId, notificationId, hours),
    act: (userId: string, notificationId: string, actionKey?: string) => mockAct(userId, notificationId, actionKey),
    registerDeviceToken: (userId: string, data: unknown) => mockRegisterDeviceToken(userId, data),
    revokeDeviceToken: (userId: string, data: unknown) => mockRevokeDeviceToken(userId, data),
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
      mockList.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });

      await controller.list(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { notifications: [], next_cursor: null, has_more: false },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('成功應調用 list 並返回 notifications', async () => {
      const notifications = [{ id: 'n1', user_id: 'u1' }];
      mockList.mockResolvedValue({ items: notifications, nextCursor: 'n2', hasMore: true });

      await controller.list(req as Request, res as Response, next);

      expect(mockGetAuthUserId).toHaveBeenCalledWith(req);
      expect(mockList).toHaveBeenCalledWith('u1', {
        status: undefined,
        state: undefined,
        templateCode: undefined,
        limit: undefined,
        cursor: undefined,
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { notifications, next_cursor: 'n2', has_more: true },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('有 status query 時應傳入 list', async () => {
      req.query = { status: 'sent' };
      mockList.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });

      await controller.list(req as Request, res as Response, next);

      expect(mockList).toHaveBeenCalledWith('u1', {
        status: 'sent',
        state: undefined,
        templateCode: undefined,
        limit: undefined,
        cursor: undefined,
      });
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
        action_key: undefined,
        priority: undefined,
        group_key: undefined,
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

  describe('App notification state sync', () => {
    it('unreadCount 應返回未讀數量', async () => {
      mockUnreadCount.mockResolvedValue(4);

      await controller.unreadCount(req as Request, res as Response, next);

      expect(mockUnreadCount).toHaveBeenCalledWith('u1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { unread_count: 4 },
      });
    });

    it('markRead 應返回 notification，找不到時應轉 404', async () => {
      req.params = { id: 'n1' };
      mockMarkRead.mockResolvedValue({ id: 'n1', unread: false });

      await controller.markRead(req as Request, res as Response, next);

      expect(mockMarkRead).toHaveBeenCalledWith('u1', 'n1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { notification: { id: 'n1', unread: false } },
      });

      jest.clearAllMocks();
      req.params = { id: 'missing' };
      mockGetAuthUserId.mockReturnValue('u1');
      mockMarkRead.mockResolvedValue(null);

      await controller.markRead(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('markAllRead 應返回更新數量', async () => {
      const result = { updatedCount: 2, readAt: new Date('2026-05-08T00:00:00.000Z') };
      mockMarkAllRead.mockResolvedValue(result);

      await controller.markAllRead(req as Request, res as Response, next);

      expect(mockMarkAllRead).toHaveBeenCalledWith('u1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: result,
        message: '已將通知標記為已讀',
      });
    });

    it('dismiss / snooze / act 應轉接 service 並輸出 App action target', async () => {
      req.params = { id: 'n1' };
      mockDismiss.mockResolvedValue({ id: 'n1', dismissed_at: 'now' });
      mockSnooze.mockResolvedValue({ id: 'n1', snoozed_until: 'later' });
      mockAct.mockResolvedValue({
        notification: { id: 'n1', acted_at: 'now' },
        target: { path: '/execution/plan-1/checkin', action_key: 'continue_today_step' },
      });

      await controller.dismiss(req as Request, res as Response, next);
      expect(mockDismiss).toHaveBeenCalledWith('u1', 'n1');
      expect(res.json).toHaveBeenLastCalledWith({
        success: true,
        data: { notification: { id: 'n1', dismissed_at: 'now' } },
        message: '已封存這則通知',
      });

      req.body = { hours: 24 };
      await controller.snooze(req as Request, res as Response, next);
      expect(mockSnooze).toHaveBeenCalledWith('u1', 'n1', 24);
      expect(res.json).toHaveBeenLastCalledWith({
        success: true,
        data: { notification: { id: 'n1', snoozed_until: 'later' } },
        message: '已稍後提醒這則通知',
      });

      req.body = { action_key: 'continue_today_step' };
      await controller.act(req as Request, res as Response, next);
      expect(mockAct).toHaveBeenCalledWith('u1', 'n1', 'continue_today_step');
      expect(res.json).toHaveBeenLastCalledWith({
        success: true,
        data: {
          notification: { id: 'n1', acted_at: 'now' },
          target: { path: '/execution/plan-1/checkin', action_key: 'continue_today_step' },
        },
        message: '已處理這則通知',
      });
    });
  });

  describe('App push device token lifecycle', () => {
    it('registerDeviceToken 應返回 201 與非敏感 device token record', async () => {
      req.body = {
        token: 'ExpoPushToken[test]',
        platform: 'ios',
        device_id: 'device-1',
        app_version: '1.3.1',
        build_number: '42',
      };
      const deviceToken = { id: 'pdt-1', platform: 'ios', device_id: 'device-1', revoked_at: null };
      mockRegisterDeviceToken.mockResolvedValue(deviceToken);

      await controller.registerDeviceToken(req as Request, res as Response, next);

      expect(mockRegisterDeviceToken).toHaveBeenCalledWith('u1', req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { device_token: deviceToken },
        message: 'Push token 已記錄',
      });
    });

    it('revokeDeviceToken 應支援 token 或 device_id 並返回 revokedCount', async () => {
      req.body = { token: 'ExpoPushToken[test]' };
      const result = { revokedCount: 1, revokedAt: new Date('2026-05-08T00:00:00.000Z') };
      mockRevokeDeviceToken.mockResolvedValue(result);

      await controller.revokeDeviceToken(req as Request, res as Response, next);

      expect(mockRevokeDeviceToken).toHaveBeenCalledWith('u1', { token: 'ExpoPushToken[test]', device_id: undefined });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: result,
        message: 'Push token 已撤銷',
      });
    });
  });
});
