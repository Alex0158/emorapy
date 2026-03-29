/**
 * notification.routes 單元測試（mock notificationController、authenticate）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockList = jest.fn();
const mockCreate = jest.fn();

jest.mock('../../../src/controllers/notification.controller', () => ({
  notificationController: {
    list: (req: unknown, res: unknown, next: unknown) => mockList(req, res, next),
    create: (req: unknown, res: unknown, next: unknown) => mockCreate(req, res, next),
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
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockList.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { notifications: [] } })
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
          .json({ success: true, data: { notifications: [] } })
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
          .json({ success: true, data: { notifications: [] } })
      );
      const app = createApp();
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(200);
      expect(res.body.data.notifications).toEqual([]);
      expect(mockList).toHaveBeenCalled();
    });
  });

  describe('POST /notifications', () => {
    it('POST 路由未註冊，應返回 404', async () => {
      const app = createApp();
      const res = await request(app).post('/notifications').send({
        channel: 'email',
        template_code: 'test_tpl',
      });
      expect(res.status).toBe(404);
      expect(mockCreate).not.toHaveBeenCalled();
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
