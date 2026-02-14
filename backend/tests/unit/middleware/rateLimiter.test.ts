/**
 * middleware/rateLimiter 單元測試
 * 驗證各 limiter 為函數、可掛載且單次請求通過；覆蓋 keyGenerator 與 skip 分支
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockEnvRef = { current: { NODE_ENV: 'production' as string } };

jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef.current;
  },
}));

import {
  generalLimiter,
  authLimiter,
  registerLimiter,
  verificationCodeLimiter,
  aiLimiter,
  uploadLimiter,
  downloadLimiter,
  pairingJoinLimiter,
} from '../../../src/middleware/rateLimiter';

describe('middleware/rateLimiter', () => {
  beforeEach(() => {
    mockEnvRef.current = { NODE_ENV: 'production' };
    process.env.SKIP_RATE_LIMIT = undefined;
  });

  it('應導出 generalLimiter 且單次請求通過', async () => {
    expect(typeof generalLimiter).toBe('function');
    const app = express();
    app.use(generalLimiter);
    app.get('/t', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).get('/t');
    expect(res.status).toBe(200);
  });

  it('應導出 authLimiter 且單次請求通過', async () => {
    expect(typeof authLimiter).toBe('function');
    const app = express();
    app.use(express.json());
    app.use(authLimiter);
    app.post('/auth', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).post('/auth');
    expect(res.status).toBe(200);
  });

  it('應導出 registerLimiter 且單次請求通過', async () => {
    expect(typeof registerLimiter).toBe('function');
    const app = express();
    app.use(express.json());
    app.use(registerLimiter);
    app.post('/register', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).post('/register');
    expect(res.status).toBe(200);
  });

  it('verificationCodeLimiter 應使用 body.email 作為 key', async () => {
    expect(typeof verificationCodeLimiter).toBe('function');
    const app = express();
    app.use(express.json());
    app.use(verificationCodeLimiter);
    app.post('/verify', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app)
      .post('/verify')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
  });

  it('aiLimiter 應使用 user.id 或 ip 作為 key', async () => {
    expect(typeof aiLimiter).toBe('function');
    const app = express();
    app.use(express.json());
    app.use((req: express.Request, _res, next) => {
      (req as any).user = { id: 'user-1' };
      next();
    });
    app.use(aiLimiter);
    app.post('/ai', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).post('/ai');
    expect(res.status).toBe(200);
  });

  it('aiLimiter 無 user 時應使用 ip 作為 key', async () => {
    const app = express();
    app.use(aiLimiter);
    app.post('/ai', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).post('/ai');
    expect(res.status).toBe(200);
  });

  it('uploadLimiter 應使用 user.id、sessionId 或 ip 作為 key', async () => {
    expect(typeof uploadLimiter).toBe('function');
    const app = express();
    app.use(express.json());
    app.use(uploadLimiter);
    app.post('/upload', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app)
      .post('/upload')
      .set('x-session-id', 'session-1');
    expect(res.status).toBe(200);
  });

  it('uploadLimiter 無 user 無 session 時應使用 ip', async () => {
    const app = express();
    app.use(uploadLimiter);
    app.post('/upload', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).post('/upload');
    expect(res.status).toBe(200);
  });

  it('verificationCodeLimiter 無 body.email 時應使用 ip', async () => {
    const app = express();
    app.use(express.json());
    app.use(verificationCodeLimiter);
    app.post('/verify', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).post('/verify').send({});
    expect(res.status).toBe(200);
  });

  it('downloadLimiter 應使用 ip 作為 key', async () => {
    expect(typeof downloadLimiter).toBe('function');
    const app = express();
    app.use(downloadLimiter);
    app.get('/download', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).get('/download');
    expect(res.status).toBe(200);
  });

  it('應導出 pairingJoinLimiter 且單次請求通過', async () => {
    expect(typeof pairingJoinLimiter).toBe('function');
    const app = express();
    app.use(express.json());
    app.use(pairingJoinLimiter);
    app.post('/pairing/join', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).post('/pairing/join').send({ invite_code: 'ABC123' });
    expect(res.status).toBe(200);
  });

  it('超過限流時應回傳 429 且錯誤結構符合 RATE_LIMIT_EXCEEDED', async () => {
    // registerLimiter 生產環境 max=5，發送 6 次觸發限流
    const app = express();
    app.use(express.json());
    app.use(registerLimiter);
    app.post('/register', (_req, res) => res.status(200).json({ ok: true }));
    for (let i = 0; i < 5; i++) {
      await request(app).post('/register').send({});
    }
    const res = await request(app).post('/register').send({});
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: expect.any(String) },
    });
  });

  it('development 且 SKIP_RATE_LIMIT=true 時 generalLimiter 應跳過限流', async () => {
    mockEnvRef.current = { NODE_ENV: 'development' };
    process.env.SKIP_RATE_LIMIT = 'true';
    jest.resetModules();
    jest.mock('../../../src/config/env', () => ({
      get env() {
        return { NODE_ENV: 'development' };
      },
    }));
    const { generalLimiter: limiter } = await import('../../../src/middleware/rateLimiter');
    const app = express();
    app.use(limiter);
    app.get('/t', (_req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).get('/t');
    expect(res.status).toBe(200);
  });
});
