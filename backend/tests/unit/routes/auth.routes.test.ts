/**
 * auth.routes 單元測試（mock authController、validate、limiters）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockSendVerificationCode = jest.fn();
const mockVerifyEmail = jest.fn();
const mockResetPassword = jest.fn();
const mockConfirmResetPassword = jest.fn();
const mockClaimSession = jest.fn();

jest.mock('../../../src/controllers/auth.controller', () => ({
  authController: {
    register: (req: unknown, res: unknown, next: unknown) => mockRegister(req, res, next),
    login: (req: unknown, res: unknown, next: unknown) => mockLogin(req, res, next),
    sendVerificationCode: (req: unknown, res: unknown, next: unknown) =>
      mockSendVerificationCode(req, res, next),
    verifyEmail: (req: unknown, res: unknown, next: unknown) =>
      mockVerifyEmail(req, res, next),
    resetPassword: (req: unknown, res: unknown, next: unknown) =>
      mockResetPassword(req, res, next),
    confirmResetPassword: (req: unknown, res: unknown, next: unknown) =>
      mockConfirmResetPassword(req, res, next),
    claimSession: (req: unknown, res: unknown, next: unknown) =>
      mockClaimSession(req, res, next),
  },
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'user-1' } as express.Request['user'];
    next();
  },
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  registerLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  verificationCodeLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyCodeLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  resetPasswordLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  resetConfirmLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import authRouter from '../../../src/routes/auth.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', authRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendJson = (res: any, body: unknown) => res.status(200).json(body);
const send201 = (res: unknown, body: unknown) => (res as { status: (n: number) => { json: (b: unknown) => void } }).status(201).json(body);
const send202 = (res: unknown, body: unknown) => (res as { status: (n: number) => { json: (b: unknown) => void } }).status(202).json(body);

describe('auth.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockImplementation((_req: unknown, res: unknown) =>
      send201(res, { success: true, data: { user: {}, token: '' } })
    );
    mockLogin.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { user: {}, token: '' } })
    );
    mockSendVerificationCode.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { expires_in: 300, resend_after: 60 } })
    );
    mockVerifyEmail.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { verified: true } })
    );
    mockResetPassword.mockImplementation((_req: unknown, res: unknown) =>
      send202(res, { success: true, data: { expires_in: 300 } })
    );
    mockConfirmResetPassword.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: {} })
    );
    mockClaimSession.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { case_id: 'case-1' } })
    );
  });

  it('POST /register 應調用 register 並返回 201', async () => {
    const app = createApp();
    const res = await request(app).post('/register').send({
      email: 'a@b.com',
      password: 'Password123!',
      nickname: 'u',
    });
    expect(res.status).toBe(201);
    expect(mockRegister).toHaveBeenCalled();
  });

  it('register 成功時應返回 data.user、data.token（F09 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post('/register').send({
      email: 'a@b.com',
      password: 'Password123!',
      nickname: 'u',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data).toHaveProperty('token');
  });

  it('POST /login 應調用 login 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/login').send({ email: 'a@b.com', password: 'p' });
    expect(res.status).toBe(200);
    expect(mockLogin).toHaveBeenCalled();
  });

  it('login 成功時應返回 data.user、data.token（F09 邊界）', async () => {
    mockLogin.mockImplementationOnce((_req: unknown, res: unknown) =>
      (res as { status: (n: number) => { json: (b: unknown) => void } })
        .status(200)
        .json({ success: true, data: { user: { id: 'u1', email: 'a@b.com' }, token: 'jwt-token-xyz' } })
    );
    const app = createApp();
    const res = await request(app).post('/login').send({ email: 'a@b.com', password: 'p' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toMatchObject({ id: 'u1', email: 'a@b.com' });
    expect(res.body.data.token).toBe('jwt-token-xyz');
    expect(mockLogin).toHaveBeenCalled();
  });

  it('POST /send-verification-code 應調用 sendVerificationCode 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/send-verification-code').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(mockSendVerificationCode).toHaveBeenCalled();
  });

  it('sendVerificationCode 成功時應返回 expiry 與 resend cooldown（F09 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post('/send-verification-code').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('expires_in');
    expect(res.body.data).toHaveProperty('resend_after');
  });

  it('POST /verify-email 應調用 verifyEmail 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/verify-email').send({ email: 'a@b.com', code: '123456' });
    expect(res.status).toBe(200);
    expect(mockVerifyEmail).toHaveBeenCalled();
  });

  it('verifyEmail 成功時應返回 data.verified（F09 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post('/verify-email').send({ email: 'a@b.com', code: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('verified');
  });

  it('POST /reset-password 應調用 resetPassword 並返回 202', async () => {
    const app = createApp();
    const res = await request(app).post('/reset-password').send({ email: 'a@b.com' });
    expect(res.status).toBe(202);
    expect(mockResetPassword).toHaveBeenCalled();
  });

  it('resetPassword 成功時應返回 data.expires_in（F09 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post('/reset-password').send({ email: 'a@b.com' });
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('expires_in');
  });

  it('POST /reset-password-confirm 應調用 confirmResetPassword 並返回 200', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/reset-password-confirm')
      .send({ email: 'a@b.com', code: '123456', new_password: 'NewPass123!' });
    expect(res.status).toBe(200);
    expect(mockConfirmResetPassword).toHaveBeenCalled();
  });

  it('confirmResetPassword 成功時應返回 data（F09 邊界）', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/reset-password-confirm')
      .send({ email: 'a@b.com', code: '123456', new_password: 'NewPass123!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('data');
  });

  it('POST /claim-session 應調用 claimSession 並返回 200', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/claim-session')
      .send({ session_id: 'session-1' });
    expect(res.status).toBe(200);
    expect(mockClaimSession).toHaveBeenCalled();
  });

  it('claimSession 成功時應返回 data.case_id（F01/F09 邊界）', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/claim-session')
      .send({ session_id: 'session-1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('case_id');
  });

  describe('錯誤傳遞', () => {
    it('register 調用 next(error) 時應返回 500', async () => {
      mockRegister.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('register failed'));
      });
      const app = createApp();
      const res = await request(app).post('/register').send({
        email: 'a@b.com',
        password: 'Password123!',
        nickname: 'u',
      });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'register failed' });
    });

    it('login 調用 next(error) 時應返回 500', async () => {
      mockLogin.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('login failed'));
      });
      const app = createApp();
      const res = await request(app).post('/login').send({ email: 'a@b.com', password: 'p' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'login failed' });
    });

    it('sendVerificationCode 調用 next(error) 時應返回 500', async () => {
      mockSendVerificationCode.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('send code failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/send-verification-code')
        .send({ email: 'a@b.com' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'send code failed' });
    });

    it('verifyEmail 調用 next(error) 時應返回 500', async () => {
      mockVerifyEmail.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('verify failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/verify-email')
        .send({ email: 'a@b.com', code: '123456' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'verify failed' });
    });

    it('resetPassword 調用 next(error) 時應返回 500', async () => {
      mockResetPassword.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('reset failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/reset-password')
        .send({ email: 'a@b.com' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'reset failed' });
    });

    it('confirmResetPassword 調用 next(error) 時應返回 500', async () => {
      mockConfirmResetPassword.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('confirm reset failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/reset-password-confirm')
        .send({ email: 'a@b.com', code: '123456', new_password: 'NewPass123!' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'confirm reset failed' });
    });

    it('claimSession 調用 next(error) 時應返回 500', async () => {
      mockClaimSession.mockImplementationOnce((_req: unknown, _res: unknown, next: unknown) => {
        (next as (err: Error) => void)(new Error('claim failed'));
      });
      const app = createApp();
      const res = await request(app)
        .post('/claim-session')
        .send({ session_id: 'session-1' });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, error: 'claim failed' });
    });
  });
});
