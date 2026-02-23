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
  return app;
}

describe('notification.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockList.mockImplementation((_req: unknown, res: any) =>
      res.status(200).json({ success: true, data: { items: [] } })
    );
  });

  describe('GET /notifications', () => {
    it('應調用 list 並返回 200', async () => {
      const app = createApp();
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(200);
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
});
