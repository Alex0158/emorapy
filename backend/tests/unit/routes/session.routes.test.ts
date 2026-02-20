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
  });

  describe('POST /refresh', () => {
    it('應調用 refreshSession 並返回 200', async () => {
      const app = createApp();
      const res = await request(app).post('/refresh').send({});
      expect(res.status).toBe(200);
      expect(mockRefreshSession).toHaveBeenCalled();
    });
  });
});
