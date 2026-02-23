/**
 * content.routes 單元測試（mock contentController、authenticate、validate）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockList = jest.fn();
const mockRecommendations = jest.fn();
const mockLink = jest.fn();

jest.mock('../../../src/controllers/content.controller', () => ({
  contentController: {
    list: (req: unknown, res: unknown, next: unknown) => mockList(req, res, next),
    recommendations: (req: unknown, res: unknown, next: unknown) =>
      mockRecommendations(req, res, next),
    link: (req: unknown, res: unknown, next: unknown) => mockLink(req, res, next),
  },
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuthenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import contentRouter from '../../../src/routes/content.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', contentRouter);
  return app;
}

describe('content.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendJson = (res: any, body: unknown) => {
      res.status(200).json(body);
    };
    mockList.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { items: [] } })
    );
    mockRecommendations.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { items: [] } })
    );
    mockLink.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { link: {} }, message: '已關聯內容' })
    );
  });

  describe('GET /content-items', () => {
    it('應調用 list 並返回 200', async () => {
      const app = createApp();
      const res = await request(app).get('/content-items');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(mockList).toHaveBeenCalled();
    });
  });

  describe('GET /content-items/recommendations/:caseId', () => {
    it('應調用 recommendations 並返回 200', async () => {
      const app = createApp();
      const caseId = '550e8400-e29b-41d4-a716-446655440000';
      const res = await request(app).get(`/content-items/recommendations/${caseId}`);
      expect(res.status).toBe(200);
      expect(mockRecommendations).toHaveBeenCalled();
    });
  });

  describe('POST /content-links', () => {
    it('應調用 link 並返回 200', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/content-links')
        .send({ case_id: 'c1', content_id: 'ct1' });
      expect(res.status).toBe(200);
      expect(mockLink).toHaveBeenCalled();
    });
  });
});
