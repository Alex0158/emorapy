/**
 * session.routes 單元測試（mock sessionController、generalLimiter）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockCreateSession = jest.fn();
const mockRefreshSession = jest.fn();
jest.mock('../../../src/controllers/session.controller', () => ({
  sessionController: {
    createSession: (req: unknown, res: unknown, next: unknown) =>
      mockCreateSession(req, res, next),
    refreshSession: (req: unknown, res: unknown, next: unknown) =>
      mockRefreshSession(req, res, next),
  },
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import sessionRouter from '../../../src/routes/session.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', sessionRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

describe('session.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateSession.mockImplementation((_req: any, res: any) => {
      res.status(201).json({ success: true, data: { session_id: 's1', expires_at: new Date().toISOString() } });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockRefreshSession.mockImplementation((_req: any, res: any) => {
      res.status(200).json({ success: true, data: { session_id: 's2', expires_at: new Date().toISOString() } });
    });
  });

  describe('POST /quick', () => {
    it('應調用 createSession 並返回 201', async () => {
      const app = createApp();
      const res = await request(app).post('/quick').send({});
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('session_id');
      expect(mockCreateSession).toHaveBeenCalled();
    });

    it('成功時應返回 session_id 與 expires_at 非空（F01 邊界）', async () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      mockCreateSession.mockImplementationOnce((_req: unknown, res: unknown) => {
        (res as { status: (n: number) => { json: (b: unknown) => void } })
          .status(201)
          .json({ success: true, data: { session_id: 'guest_123', expires_at: expiresAt }, message: 'Session創建成功' });
      });
      const app = createApp();
      const res = await request(app).post('/quick').send({});
      expect(res.status).toBe(201);
      expect(res.body.data.session_id).toBeTruthy();
      expect(res.body.data.expires_at).toBeTruthy();
      expect(typeof res.body.data.session_id).toBe('string');
    });
  });

  describe('POST /refresh', () => {
    it('應調用 refreshSession 並返回 200', async () => {
      const app = createApp();
      const res = await request(app).post('/refresh').send({});
      expect(res.status).toBe(200);
      expect(mockRefreshSession).toHaveBeenCalled();
    });

    it('成功時應返回 session_id 與 expires_at 非空（F01 邊界）', async () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      mockRefreshSession.mockImplementationOnce((_req: unknown, res: unknown) => {
        (res as { status: (n: number) => { json: (b: unknown) => void } })
          .status(200)
          .json({ success: true, data: { session_id: 'guest_refreshed', expires_at: expiresAt }, message: 'Session刷新成功' });
      });
      const app = createApp();
      const res = await request(app).post('/refresh').send({});
      expect(res.status).toBe(200);
      expect(res.body.data.session_id).toBeTruthy();
      expect(res.body.data.expires_at).toBeTruthy();
      expect(typeof res.body.data.session_id).toBe('string');
    });
  });

  describe('錯誤傳遞', () => {
    it('createSession 調用 next(error) 時應返回 500', async () => {
      mockCreateSession.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('create failed'));
      });
      const app = createApp();
      const res = await request(app).post('/quick').send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'create failed' });
    });

    it('refreshSession 調用 next(error) 時應返回 500', async () => {
      mockRefreshSession.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('refresh failed'));
      });
      const app = createApp();
      const res = await request(app).post('/refresh').send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'refresh failed' });
    });
  });
});
