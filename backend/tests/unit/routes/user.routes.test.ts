/**
 * user.routes 單元測試（mock userController、authenticate、validate、uploadAvatar、generalLimiter）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockGetProfile = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock('../../../src/controllers/user.controller', () => ({
  userController: {
    getProfile: (req: unknown, res: unknown, next: unknown) =>
      mockGetProfile(req, res, next),
    updateProfile: (req: unknown, res: unknown, next: unknown) =>
      mockUpdateProfile(req, res, next),
  },
  uploadAvatar: [
    (_req: unknown, _res: unknown, next: () => void) => next(),
    (_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: {} }),
  ],
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import userRouter from '../../../src/routes/user.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', userRouter);
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendJson = (res: any, body: unknown) => res.status(200).json(body);

describe('user.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const userData = { user: {} };
    mockGetProfile.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: userData })
    );
    mockUpdateProfile.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: userData })
    );
  });

  it('GET /profile 應調用 getProfile 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/profile');
    expect(res.status).toBe(200);
    expect(mockGetProfile).toHaveBeenCalled();
  });

  it('PUT /profile 應調用 updateProfile 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).put('/profile').send({ nickname: 'x' });
    expect(res.status).toBe(200);
    expect(mockUpdateProfile).toHaveBeenCalled();
  });

  it('POST /avatar 應返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/avatar').attach('file', Buffer.from('x'), 'x.txt');
    expect(res.status).toBe(200);
  });
});
