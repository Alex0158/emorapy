/**
 * notification.routes 單元測試（mock notificationController、authenticate）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockList = jest.fn();
const mockCreate = jest.fn();
const mockUnreadCount = jest.fn();
const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
const mockDismiss = jest.fn();
const mockSnooze = jest.fn();
const mockAct = jest.fn();
const mockRegisterDeviceToken = jest.fn();
const mockRevokeDeviceToken = jest.fn();

jest.mock('../../../src/controllers/notification.controller', () => ({
  notificationController: {
    list: (req: unknown, res: unknown, next: unknown) => mockList(req, res, next),
    create: (req: unknown, res: unknown, next: unknown) => mockCreate(req, res, next),
    unreadCount: (req: unknown, res: unknown, next: unknown) => mockUnreadCount(req, res, next),
    markRead: (req: unknown, res: unknown, next: unknown) => mockMarkRead(req, res, next),
    markAllRead: (req: unknown, res: unknown, next: unknown) => mockMarkAllRead(req, res, next),
    dismiss: (req: unknown, res: unknown, next: unknown) => mockDismiss(req, res, next),
    snooze: (req: unknown, res: unknown, next: unknown) => mockSnooze(req, res, next),
    act: (req: unknown, res: unknown, next: unknown) => mockAct(req, res, next),
    registerDeviceToken: (req: unknown, res: unknown, next: unknown) => mockRegisterDeviceToken(req, res, next),
    revokeDeviceToken: (req: unknown, res: unknown, next: unknown) => mockRevokeDeviceToken(req, res, next),
  },
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import notificationRouter from '../../../src/routes/notification.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', notificationRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

describe('notification.routes', () => {
  const notificationId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockList.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { notifications: [], next_cursor: null, has_more: false } })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUnreadCount.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { unread_count: 3 } })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreate.mockImplementation((_req: unknown, res: any) =>
      res.status(201).json({ success: true, data: { notification: { id: 'n1' } } })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockMarkRead.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { notification: { id: 'n1', unread: false } } })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockMarkAllRead.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { updatedCount: 2, readAt: '2026-04-05T00:00:00.000Z' } })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDismiss.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { notification: { id: 'n1', dismissed_at: '2026-04-05T00:00:00.000Z' } } })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSnooze.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { notification: { id: 'n1', snoozed_until: '2026-04-06T00:00:00.000Z' } } })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAct.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { notification: { id: 'n1', acted_at: '2026-04-05T00:00:00.000Z' }, target: { path: '/execution/p1/checkin' } } })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockRegisterDeviceToken.mockImplementation((_req: unknown, res: any) =>
      res.status(201).json({ success: true, data: { device_token: { id: 'pdt-1', platform: 'ios', revoked_at: null } } })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockRevokeDeviceToken.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { revokedCount: 1, revokedAt: '2026-05-08T00:00:00.000Z' } })
    );
  });

  describe('GET /notifications', () => {
    it('應調用 list 並返回 200', async () => {
      const app = createApp();
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(200);
      expect(mockList).toHaveBeenCalled();
    });

    it('list 成功時應返回 data 含 notifications（F09/F10 邊界）', async () => {
      mockList.mockImplementationOnce((_req: unknown, res: unknown) =>
        (res as { status: (n: number) => { json: (b: unknown) => void } })
          .status(200)
          .json({ success: true, data: { notifications: [], next_cursor: null, has_more: false } })
      );
      const app = createApp();
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('notifications');
      expect(Array.isArray(res.body.data.notifications)).toBe(true);
    });

    it('無通知時應返回 notifications 空陣列（F09/F10 邊界）', async () => {
      mockList.mockImplementationOnce((_req: unknown, res: unknown) =>
        (res as { status: (n: number) => { json: (b: unknown) => void } })
          .status(200)
          .json({ success: true, data: { notifications: [], next_cursor: null, has_more: false } })
      );
      const app = createApp();
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(200);
      expect(res.body.data.notifications).toEqual([]);
      expect(mockList).toHaveBeenCalled();
    });
  });

  describe('POST /notifications', () => {
    it('應調用 create 並返回 201', async () => {
      const app = createApp();
      const res = await request(app).post('/notifications').send({
        channel: 'email',
        template_code: 'test_tpl',
        action_key: 'open_reconciliation_entry',
      });
      expect(res.status).toBe(201);
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('通知狀態操作', () => {
    it('GET /notifications/unread-count 應返回未讀數量', async () => {
      const app = createApp();
      const res = await request(app).get('/notifications/unread-count');
      expect(res.status).toBe(200);
      expect(res.body.data.unread_count).toBe(3);
      expect(mockUnreadCount).toHaveBeenCalled();
    });

    it('POST /notifications/read-all 應返回更新數量', async () => {
      const app = createApp();
      const res = await request(app).post('/notifications/read-all');
      expect(res.status).toBe(200);
      expect(res.body.data.updatedCount).toBe(2);
      expect(mockMarkAllRead).toHaveBeenCalled();
    });

    it('POST /notifications/:id/read 應返回 notification', async () => {
      const app = createApp();
      const res = await request(app).post(`/notifications/${notificationId}/read`);
      expect(res.status).toBe(200);
      expect(res.body.data.notification.id).toBe('n1');
      expect(mockMarkRead).toHaveBeenCalled();
    });

    it('POST /notifications/:id/dismiss 應返回 notification', async () => {
      const app = createApp();
      const res = await request(app).post(`/notifications/${notificationId}/dismiss`);
      expect(res.status).toBe(200);
      expect(res.body.data.notification.id).toBe('n1');
      expect(mockDismiss).toHaveBeenCalled();
    });

    it('POST /notifications/:id/snooze 應返回 notification', async () => {
      const app = createApp();
      const res = await request(app).post(`/notifications/${notificationId}/snooze`).send({ hours: 24 });
      expect(res.status).toBe(200);
      expect(res.body.data.notification.id).toBe('n1');
      expect(mockSnooze).toHaveBeenCalled();
    });

    it('POST /notifications/:id/act 應返回 target', async () => {
      const app = createApp();
      const res = await request(app).post(`/notifications/${notificationId}/act`).send({ action_key: 'continue_today_step' });
      expect(res.status).toBe(200);
      expect(res.body.data.target.path).toBe('/execution/p1/checkin');
      expect(mockAct).toHaveBeenCalled();
    });

    it('POST /notifications/device-tokens 應註冊 App push token', async () => {
      const app = createApp();
      const res = await request(app).post('/notifications/device-tokens').send({
        token: 'ExpoPushToken[test]',
        platform: 'ios',
        device_id: 'device-1',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.device_token.id).toBe('pdt-1');
      expect(mockRegisterDeviceToken).toHaveBeenCalled();
    });

    it('POST /notifications/device-tokens/revoke 應撤銷 App push token', async () => {
      const app = createApp();
      const res = await request(app).post('/notifications/device-tokens/revoke').send({
        token: 'ExpoPushToken[test]',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.revokedCount).toBe(1);
      expect(mockRevokeDeviceToken).toHaveBeenCalled();
    });
  });

  describe('錯誤傳遞', () => {
    it('list 調用 next(error) 時應返回 500', async () => {
      mockList.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('list failed'));
      });
      const app = createApp();
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'list failed' });
    });
  });
});
