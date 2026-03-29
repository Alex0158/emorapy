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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
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

    it('list 成功時應返回 data.items（F01 邊界）', async () => {
      const app = createApp();
      const res = await request(app).get('/content-items');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('無內容時應返回 items 空陣列（F01 邊界）', async () => {
      mockList.mockImplementationOnce((_req: unknown, res: unknown) =>
        (res as { status: (n: number) => { json: (b: unknown) => void } })
          .status(200)
          .json({ success: true, data: { items: [] } })
      );
      const app = createApp();
      const res = await request(app).get('/content-items');
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
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

    it('recommendations 成功時應返回 data.items（F01/F05 邊界）', async () => {
      const app = createApp();
      const caseId = '550e8400-e29b-41d4-a716-446655440000';
      const res = await request(app).get(`/content-items/recommendations/${caseId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('無推薦時應返回 items 空陣列（F01/F05 邊界）', async () => {
      mockRecommendations.mockImplementationOnce((_req: unknown, res: unknown) =>
        (res as { status: (n: number) => { json: (b: unknown) => void } })
          .status(200)
          .json({ success: true, data: { items: [] } })
      );
      const app = createApp();
      const caseId = '550e8400-e29b-41d4-a716-446655440000';
      const res = await request(app).get(`/content-items/recommendations/${caseId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
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

    it('link 成功時應返回 data.link（F01 邊界）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/content-links')
        .send({ case_id: 'c1', content_id: 'ct1' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('link');
    });
  });

  describe('錯誤傳遞', () => {
    it('list 調用 next(error) 時應返回 500', async () => {
      mockList.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('db error'));
      });
      const app = createApp();
      const res = await request(app).get('/content-items');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'db error' });
    });

    it('recommendations 調用 next(error) 時應返回 500', async () => {
      mockRecommendations.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('recommendations load failed'));
      });
      const app = createApp();
      const caseId = '550e8400-e29b-41d4-a716-446655440000';
      const res = await request(app).get(`/content-items/recommendations/${caseId}`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'recommendations load failed' });
    });

    it('link 調用 next(error) 時應返回 500', async () => {
      mockLink.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('link failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/content-links')
        .send({ case_id: 'c1', content_id: 'ct1' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'link failed' });
    });
  });
});
