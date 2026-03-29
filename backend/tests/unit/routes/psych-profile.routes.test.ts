/**
 * psych-profile.routes 單元測試（mock controller、auth、consent、rateLimiter）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockGetProfile = jest.fn();
const mockGetFeedbackHistory = jest.fn();
const mockGiveConsent = jest.fn();
const mockDeleteAllData = jest.fn();

jest.mock('../../../src/controllers/psych-profile.controller', () => ({
  psychProfileController: {
    getProfile: (req: unknown, res: unknown, next: unknown) => mockGetProfile(req, res, next),
    getFeedbackHistory: (req: unknown, res: unknown, next: unknown) =>
      mockGetFeedbackHistory(req, res, next),
    giveConsent: (req: unknown, res: unknown, next: unknown) => mockGiveConsent(req, res, next),
    deleteAllData: (req: unknown, res: unknown, next: unknown) =>
      mockDeleteAllData(req, res, next),
  },
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/consent', () => ({
  requireConsent: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import psychProfileRouter from '../../../src/routes/psych-profile.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'u1', email: 'u1@test.com' };
    next();
  });
  app.use('/psych-profile', psychProfileRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

describe('psych-profile.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfile.mockImplementation((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { consent_given: true, narratives: [], insights: [], richness_score: 0 } })
    );
    mockGetFeedbackHistory.mockImplementation((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { history: [] } })
    );
    mockGiveConsent.mockImplementation((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, message: '已同意心理畫像知情同意' })
    );
    mockDeleteAllData.mockImplementation((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, message: '心理畫像相關資料已刪除' })
    );
  });

  it('GET /psych-profile 應調用 getProfile 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/psych-profile');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('consent_given');
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
  });

  it('getProfile 成功時應返回 data 含 narratives、insights、richness_score（F06 邊界）', async () => {
    const profileData = { consent_given: true, narratives: [{ id: 'n1', content: 'test' }], insights: [{ id: 'i1' }], richness_score: 0.5 };
    mockGetProfile.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: profileData })
    );
    const app = createApp();
    const res = await request(app).get('/psych-profile');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('narratives');
    expect(res.body.data).toHaveProperty('insights');
    expect(res.body.data).toHaveProperty('richness_score');
    expect(Array.isArray(res.body.data.narratives)).toBe(true);
    expect(res.body.data.narratives).toHaveLength(1);
    expect(res.body.data.richness_score).toBe(0.5);
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
  });

  it('GET /psych-profile 無敘事與洞見時應返回 narratives、insights 空陣列（F06 邊界）', async () => {
    mockGetProfile.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { consent_given: false, consent_at: null, narratives: [], insights: [], richness_score: 0 } })
    );
    const app = createApp();
    const res = await request(app).get('/psych-profile');
    expect(res.status).toBe(200);
    expect(res.body.data.narratives).toEqual([]);
    expect(res.body.data.insights).toEqual([]);
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
  });

  it('GET /psych-profile/feedback 應調用 getFeedbackHistory 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/psych-profile/feedback');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('history');
    expect(mockGetFeedbackHistory).toHaveBeenCalledTimes(1);
  });

  it('getFeedbackHistory 成功時應返回 data.history（F06 邊界）', async () => {
    const app = createApp();
    const res = await request(app).get('/psych-profile/feedback');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('history');
    expect(Array.isArray(res.body.data.history)).toBe(true);
  });

  it('GET /psych-profile/feedback 無反饋時應返回 history 空陣列（F06 邊界）', async () => {
    mockGetFeedbackHistory.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { history: [] } })
    );
    const app = createApp();
    const res = await request(app).get('/psych-profile/feedback');
    expect(res.status).toBe(200);
    expect(res.body.data.history).toEqual([]);
    expect(mockGetFeedbackHistory).toHaveBeenCalledTimes(1);
  });

  it('POST /psych-profile/consent 應調用 giveConsent 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/psych-profile/consent');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('已同意');
    expect(mockGiveConsent).toHaveBeenCalledTimes(1);
  });

  it('DELETE /psych-profile 應調用 deleteAllData 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).delete('/psych-profile');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('已刪除');
    expect(mockDeleteAllData).toHaveBeenCalledTimes(1);
  });

  describe('錯誤傳遞', () => {
    it('getProfile 調用 next(error) 時應返回 500', async () => {
      mockGetProfile.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('profile load failed'));
      });
      const app = createApp();
      const res = await request(app).get('/psych-profile');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'profile load failed' });
    });

    it('getFeedbackHistory 調用 next(error) 時應返回 500', async () => {
      mockGetFeedbackHistory.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('feedback load failed'));
      });
      const app = createApp();
      const res = await request(app).get('/psych-profile/feedback');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'feedback load failed' });
    });

    it('giveConsent 調用 next(error) 時應返回 500', async () => {
      mockGiveConsent.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('consent failed'));
      });
      const app = createApp();
      const res = await request(app).post('/psych-profile/consent');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'consent failed' });
    });

    it('deleteAllData 調用 next(error) 時應返回 500', async () => {
      mockDeleteAllData.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('delete failed'));
      });
      const app = createApp();
      const res = await request(app).delete('/psych-profile');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'delete failed' });
    });
  });
});
