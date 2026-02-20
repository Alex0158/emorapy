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
  },
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
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
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendJson = (res: any, body: unknown) => res.status(200).json(body);
const send201 = (res: unknown, body: unknown) => (res as { status: (n: number) => { json: (b: unknown) => void } }).status(201).json(body);

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
      sendJson(res, { success: true, data: { expires_in: 300 } })
    );
    mockVerifyEmail.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { verified: true } })
    );
    mockResetPassword.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: { expires_in: 300 } })
    );
    mockConfirmResetPassword.mockImplementation((_req: unknown, res: unknown) =>
      sendJson(res, { success: true, data: {} })
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

  it('POST /login 應調用 login 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/login').send({ email: 'a@b.com', password: 'p' });
    expect(res.status).toBe(200);
    expect(mockLogin).toHaveBeenCalled();
  });

  it('POST /send-verification-code 應調用 sendVerificationCode 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/send-verification-code').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(mockSendVerificationCode).toHaveBeenCalled();
  });

  it('POST /verify-email 應調用 verifyEmail 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/verify-email').send({ email: 'a@b.com', code: '123456' });
    expect(res.status).toBe(200);
    expect(mockVerifyEmail).toHaveBeenCalled();
  });

  it('POST /reset-password 應調用 resetPassword 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/reset-password').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(mockResetPassword).toHaveBeenCalled();
  });

  it('POST /reset-password-confirm 應調用 confirmResetPassword 並返回 200', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/reset-password-confirm')
      .send({ email: 'a@b.com', code: '123456', new_password: 'NewPass123!' });
    expect(res.status).toBe(200);
    expect(mockConfirmResetPassword).toHaveBeenCalled();
  });
});
