/**
 * profile.routes 單元測試（mock profileController、authenticate、validate）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockGetUserProfile = jest.fn();
const mockUpsertUserProfile = jest.fn();
const mockGetRelationshipProfile = jest.fn();
const mockUpsertRelationshipProfile = jest.fn();

jest.mock('../../../src/controllers/profile.controller', () => ({
  profileController: {
    getUserProfile: (req: unknown, res: unknown, next: unknown) =>
      mockGetUserProfile(req, res, next),
    upsertUserProfile: (req: unknown, res: unknown, next: unknown) =>
      mockUpsertUserProfile(req, res, next),
    getRelationshipProfile: (req: unknown, res: unknown, next: unknown) =>
      mockGetRelationshipProfile(req, res, next),
    upsertRelationshipProfile: (req: unknown, res: unknown, next: unknown) =>
      mockUpsertRelationshipProfile(req, res, next),
  },
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import profileRouter from '../../../src/routes/profile.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', profileRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendJson = (res: any, body: unknown) => res.status(200).json(body);

describe('profile.routes', () => {
  const pairingId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    const profileData = { profile: {} };
    mockGetUserProfile.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: profileData })
    );
    mockUpsertUserProfile.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: profileData })
    );
    mockGetRelationshipProfile.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: profileData })
    );
    mockUpsertRelationshipProfile.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: profileData })
    );
  });

  it('GET /profile/me 應調用 getUserProfile 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/profile/me');
    expect(res.status).toBe(200);
    expect(mockGetUserProfile).toHaveBeenCalled();
  });

  it('getUserProfile 成功時應返回 data.profile（F08 邊界）', async () => {
    const app = createApp();
    const res = await request(app).get('/profile/me');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('profile');
  });

  it('PUT /profile/me 應調用 upsertUserProfile 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).put('/profile/me').send({});
    expect(res.status).toBe(200);
    expect(mockUpsertUserProfile).toHaveBeenCalled();
  });

  it('upsertUserProfile 成功時應返回 data.profile（F08 邊界）', async () => {
    const app = createApp();
    const res = await request(app).put('/profile/me').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('profile');
  });

  it('GET /profile/relationship/:pairingId 應調用 getRelationshipProfile 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get(`/profile/relationship/${pairingId}`);
    expect(res.status).toBe(200);
    expect(mockGetRelationshipProfile).toHaveBeenCalled();
  });

  it('getRelationshipProfile 成功時應返回 data.profile 含關係檔案結構（F08 邊界）', async () => {
    const profileData = { id: 'rp1', pairing_id: pairingId, relationship_summary: 'test' };
    mockGetRelationshipProfile.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { profile: profileData } })
    );
    const app = createApp();
    const res = await request(app).get(`/profile/relationship/${pairingId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('profile');
    expect(res.body.data.profile).toMatchObject({ id: 'rp1', pairing_id: pairingId });
    expect(mockGetRelationshipProfile).toHaveBeenCalled();
  });

  it('getRelationshipProfile 無關係檔案時應返回 profile null（F08 邊界）', async () => {
    mockGetRelationshipProfile.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { profile: null } })
    );
    const app = createApp();
    const res = await request(app).get(`/profile/relationship/${pairingId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile).toBeNull();
    expect(mockGetRelationshipProfile).toHaveBeenCalled();
  });

  it('PUT /profile/relationship/:pairingId 應調用 upsertRelationshipProfile 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).put(`/profile/relationship/${pairingId}`).send({});
    expect(res.status).toBe(200);
    expect(mockUpsertRelationshipProfile).toHaveBeenCalled();
  });

  it('upsertRelationshipProfile 成功時應返回 data.profile（F08 邊界）', async () => {
    const app = createApp();
    const res = await request(app).put(`/profile/relationship/${pairingId}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('profile');
  });

  describe('錯誤傳遞', () => {
    it('getUserProfile 調用 next(error) 時應返回 500', async () => {
      mockGetUserProfile.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('profile load failed'));
      });
      const app = createApp();
      const res = await request(app).get('/profile/me');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'profile load failed' });
    });

    it('upsertUserProfile 調用 next(error) 時應返回 500', async () => {
      mockUpsertUserProfile.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('profile save failed'));
      });
      const app = createApp();
      const res = await request(app).put('/profile/me').send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'profile save failed' });
    });

    it('getRelationshipProfile 調用 next(error) 時應返回 500', async () => {
      mockGetRelationshipProfile.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('relationship load failed'));
      });
      const app = createApp();
      const res = await request(app).get(`/profile/relationship/${pairingId}`);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'relationship load failed' });
    });

    it('upsertRelationshipProfile 調用 next(error) 時應返回 500', async () => {
      mockUpsertRelationshipProfile.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('relationship save failed'));
      });
      const app = createApp();
      const res = await request(app).put(`/profile/relationship/${pairingId}`).send({});
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'relationship save failed' });
    });
  });
});
