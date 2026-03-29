/**
 * pairing.routes 單元測試（mock pairingService、authenticate、validate、getAuthUserId）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockCreatePairing = jest.fn();
const mockJoinPairing = jest.fn();
const mockGetPairingStatus = jest.fn();
const mockCancelPairing = jest.fn();

jest.mock('../../../src/services/pairing.service', () => ({
  pairingService: {
    createPairing: (userId: string) => mockCreatePairing(userId),
    joinPairing: (userId: string, code: string) => mockJoinPairing(userId, code),
    getPairingStatus: (userId: string) => mockGetPairingStatus(userId),
    cancelPairing: (userId: string) => mockCancelPairing(userId),
  },
}));
jest.mock('../../../src/middleware/auth', () => ({
  authenticate: (req: unknown, _res: unknown, next: () => void) => {
    (req as { user?: { id: string } }).user = { id: 'u1' };
    next();
  },
}));
jest.mock('../../../src/middleware/validator', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../../src/middleware/rateLimiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  pairingJoinLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import pairingRouter from '../../../src/routes/pairing.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', pairingRouter);
  return app;
}

describe('pairing.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePairing.mockResolvedValue({ id: 'pair-1', invite_code: 'ABC123' } as never);
    mockJoinPairing.mockResolvedValue({ id: 'pair-1' } as never);
    mockGetPairingStatus.mockResolvedValue(null as never);
    mockCancelPairing.mockResolvedValue({ id: 'pair-1', status: 'cancelled' } as never);
  });

  it('POST /create 應調用 createPairing 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/create').send({});
    expect(res.status).toBe(200);
    expect(mockCreatePairing).toHaveBeenCalledWith('u1');
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('pairing');
  });

  it('createPairing 成功時應返回 data.pairing 含 invite_code（F08 邊界）', async () => {
    const pairingData = { id: 'pair-1', invite_code: 'XYZ789', status: 'pending' };
    mockCreatePairing.mockResolvedValueOnce(pairingData as never);
    const app = createApp();
    const res = await request(app).post('/create').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pairing).toHaveProperty('invite_code');
    expect(res.body.data.pairing.invite_code).toBe('XYZ789');
    expect(res.body.data.pairing.id).toBe('pair-1');
    expect(mockCreatePairing).toHaveBeenCalledWith('u1');
  });

  it('POST /join 應調用 joinPairing 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/join').send({ invite_code: 'ABC123' });
    expect(res.status).toBe(200);
    expect(mockJoinPairing).toHaveBeenCalledWith('u1', 'ABC123');
  });

  it('joinPairing 成功時應返回 data.pairing（F08 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post('/join').send({ invite_code: 'ABC123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('pairing');
  });

  it('GET /status 應調用 getPairingStatus 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(mockGetPairingStatus).toHaveBeenCalledWith('u1');
  });

  it('GET /status 無配對時應返回 pairing null（F08 邊界）', async () => {
    mockGetPairingStatus.mockResolvedValueOnce(null as never);
    const app = createApp();
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pairing).toBeNull();
    expect(mockGetPairingStatus).toHaveBeenCalledWith('u1');
  });

  it('getPairingStatus 有配對時應返回 data.pairing（F08 邊界）', async () => {
    const pairingData = { id: 'pair-1', invite_code: 'XYZ789', status: 'active' };
    mockGetPairingStatus.mockResolvedValueOnce(pairingData as never);
    const app = createApp();
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('pairing');
    expect(res.body.data.pairing).toEqual(pairingData);
  });

  it('POST /cancel 應調用 cancelPairing 並返回 200', async () => {
    const app = createApp();
    const res = await request(app).post('/cancel').send({});
    expect(res.status).toBe(200);
    expect(mockCancelPairing).toHaveBeenCalledWith('u1');
  });

  it('cancelPairing 成功時應返回 data.pairing（F08 邊界）', async () => {
    const app = createApp();
    const res = await request(app).post('/cancel').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('pairing');
  });

  it('createPairing 拋錯時應 next(error)', async () => {
    (mockCreatePairing as jest.Mock).mockRejectedValue(new Error('service error') as never);
    const app = createApp();
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });
    const res = await request(app).post('/create').send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('service error');
  });

  it('joinPairing 拋錯時應 next(error)', async () => {
    (mockJoinPairing as jest.Mock).mockRejectedValue(new Error('invalid code') as never);
    const app = createApp();
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });
    const res = await request(app).post('/join').send({ invite_code: 'BAD' });
    expect(res.status).toBe(500);
  });

  it('getPairingStatus 拋錯時應 next(error)', async () => {
    (mockGetPairingStatus as jest.Mock).mockRejectedValue(new Error('db error') as never);
    const app = createApp();
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });
    const res = await request(app).get('/status');
    expect(res.status).toBe(500);
  });

  it('cancelPairing 拋錯時應 next(error)', async () => {
    (mockCancelPairing as jest.Mock).mockRejectedValue(new Error('not found') as never);
    const app = createApp();
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });
    const res = await request(app).post('/cancel').send({});
    expect(res.status).toBe(500);
  });
});
