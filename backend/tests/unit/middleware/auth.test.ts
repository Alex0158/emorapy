/**
 * middleware/auth 單元測試
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuthenticate, validateSession, authorizeMedia } from '../../../src/middleware/auth';
import { Errors } from '../../../src/utils/errors';
import logger from '../../../src/config/logger';

const mockVerifyToken = jest.fn();
const mockFindUniqueUser = jest.fn();
const mockQuickSessionUpdate = jest.fn();
// @ts-expect-error Prisma update 返回類型在 mock 中推斷為 never
mockQuickSessionUpdate.mockResolvedValue(undefined);
const mockValidateSessionId = jest.fn();
const mockGetSession = jest.fn();
const mockGetRequestId = jest.fn();

jest.mock('../../../src/utils/jwt', () => ({
  verifyToken: (t: string) => mockVerifyToken(t),
}));
jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => mockFindUniqueUser(...args) },
    quickSession: {
      update: (...args: unknown[]) => mockQuickSessionUpdate(...args),
    },
  } as unknown,
}));
jest.mock('../../../src/utils/session', () => ({
  validateSessionId: (s: string) => mockValidateSessionId(s),
}));
jest.mock('../../../src/services/session.service', () => ({
  sessionService: {
    getSession: (id: string) => mockGetSession(id),
  },
}));
const mockEnvRef = {
  current: {
    NODE_ENV: 'test' as string,
    JWT_SECRET: 'test-secret',
    UPLOAD_DIR: 'uploads',
  },
};
jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef.current;
  },
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getRequestId: (req: Request) => mockGetRequestId(req),
}));
jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: { verify: jest.fn() },
}));

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    query: {},
    path: '/',
    method: 'GET',
    ip: '127.0.0.1',
    ...overrides,
  } as Request;
}

function createRes(): Response {
  return {} as Response;
}

describe('middleware/auth', () => {
  let next: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    mockGetRequestId.mockReturnValue('req-1');
    // @ts-expect-error Prisma update mock 返回類型推斷為 never
    mockQuickSessionUpdate.mockResolvedValue(undefined);
    mockEnvRef.current = { NODE_ENV: 'test', JWT_SECRET: 'test-secret', UPLOAD_DIR: 'uploads' };
  });

  describe('authenticate', () => {
    it('無 Authorization 頭應 next(UNAUTHORIZED)', async () => {
      const req = createReq({ headers: {} });
      await authenticate(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0] as unknown as { code: string; message: string };
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toContain('未提供');
    });

    it('非 Bearer 頭應 next(UNAUTHORIZED)', async () => {
      const req = createReq({ headers: { authorization: 'Basic x' } });
      await authenticate(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('UNAUTHORIZED');
    });

    it('Token 驗證失敗應 next(error)', async () => {
      const req = createReq({ headers: { authorization: 'Bearer bad' } });
      mockVerifyToken.mockImplementation(() => {
        throw Errors.UNAUTHORIZED('Token無效');
      });
      await authenticate(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('用戶不存在應 next(UNAUTHORIZED)', async () => {
      const req = createReq({ headers: { authorization: 'Bearer ok' } });
      mockVerifyToken.mockReturnValue({ id: 'user-1', email: 'u@x.com' });
      mockFindUniqueUser.mockResolvedValue(null as never);
      await authenticate(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('UNAUTHORIZED');
    });

    it('用戶未激活應 next(UNAUTHORIZED)', async () => {
      const req = createReq({ headers: { authorization: 'Bearer ok' } });
      mockVerifyToken.mockReturnValue({ id: 'user-1', email: 'u@x.com' });
      mockFindUniqueUser.mockResolvedValue({ id: 'user-1', email: 'u@x.com', is_active: false } as never);
      await authenticate(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('UNAUTHORIZED');
    });

    it('驗證通過應設置 req.user 並 next()', async () => {
      const req = createReq({ headers: { authorization: 'Bearer ok' } });
      mockVerifyToken.mockReturnValue({ id: 'user-1', email: 'u@x.com' });
      mockFindUniqueUser.mockResolvedValue({ id: 'user-1', email: 'u@x.com', is_active: true } as never);
      await authenticate(req, createRes(), next);
      expect(req.user).toEqual({ id: 'user-1', email: 'u@x.com' });
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('optionalAuthenticate', () => {
    it('無 Authorization 頭應直接 next()', async () => {
      const req = createReq({ headers: {} });
      await optionalAuthenticate(req, createRes(), next);
      expect(next).toHaveBeenCalledWith();
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('有效 Token 且用戶存在應設置 req.user', async () => {
      const req = createReq({ headers: { authorization: 'Bearer ok' } });
      mockVerifyToken.mockReturnValue({ id: 'user-1', email: 'u@x.com' });
      mockFindUniqueUser.mockResolvedValue({ id: 'user-1', email: 'u@x.com', is_active: true } as never);
      await optionalAuthenticate(req, createRes(), next);
      expect(req.user).toEqual({ id: 'user-1', email: 'u@x.com' });
      expect(next).toHaveBeenCalledWith();
    });

    it('Token 無效應僅 log 並 next()', async () => {
      const req = createReq({ headers: { authorization: 'Bearer bad' } });
      mockVerifyToken.mockImplementation(() => {
        throw new Error('invalid');
      });
      await optionalAuthenticate(req, createRes(), next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
      expect(logger.warn).toHaveBeenCalledWith('Optional auth token invalid', expect.objectContaining({ reason: 'invalid', requestId: 'req-1', ip: '127.0.0.1' }));
    });

    it('Bearer 存在但用戶為 null 應不設置 req.user 並 next()', async () => {
      const req = createReq({ headers: { authorization: 'Bearer ok' } });
      mockVerifyToken.mockReturnValue({ id: 'user-1', email: 'u@x.com' });
      mockFindUniqueUser.mockResolvedValue(null as never);
      await optionalAuthenticate(req, createRes(), next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('Bearer 存在但用戶未激活應不設置 req.user 並 next()', async () => {
      const req = createReq({ headers: { authorization: 'Bearer ok' } });
      mockVerifyToken.mockReturnValue({ id: 'user-1', email: 'u@x.com' });
      mockFindUniqueUser.mockResolvedValue({ id: 'user-1', email: 'u@x.com', is_active: false } as never);
      await optionalAuthenticate(req, createRes(), next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('next() 拋錯時應被外層 catch 並記錄 logger.warn', async () => {
      const req = createReq({ headers: {} });
      const mockNext = jest.fn().mockImplementationOnce(() => {
        throw new Error('next threw');
      });
      await optionalAuthenticate(req, createRes(), mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Optional auth failed', expect.objectContaining({ error: expect.any(Error), requestId: 'req-1' }));
    });
  });

  describe('validateSession', () => {
    it('無 session_id 應 next(SESSION_ID_REQUIRED)', async () => {
      const req = createReq({ query: {}, headers: {} });
      await validateSession(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('SESSION_ID_REQUIRED');
    });

    it('從 query.session_id 讀取', async () => {
      const req = createReq({ query: { session_id: 's1' }, headers: {} });
      mockValidateSessionId.mockReturnValue(true);
      mockGetSession.mockResolvedValue({ id: 's1', expires_at: new Date(Date.now() + 3600000) } as never);
      await validateSession(req, createRes(), next);
      expect(req.sessionId).toBe('s1');
      expect(next).toHaveBeenCalledWith();
    });

    it('從 x-session-id 讀取', async () => {
      const req = createReq({ query: {}, headers: { 'x-session-id': 's2' } });
      mockValidateSessionId.mockReturnValue(true);
      mockGetSession.mockResolvedValue({ id: 's2', expires_at: new Date(Date.now() + 3600000) } as never);
      await validateSession(req, createRes(), next);
      expect(req.sessionId).toBe('s2');
      expect(next).toHaveBeenCalledWith();
    });

    it('Session ID 格式無效應 next(INVALID_SESSION_ID)', async () => {
      const req = createReq({ query: { session_id: 'bad' }, headers: {} });
      mockValidateSessionId.mockReturnValue(false);
      await validateSession(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('INVALID_SESSION_ID');
    });

    it('Session 不存在或過期應 next(SESSION_EXPIRED)', async () => {
      const req = createReq({ query: { session_id: 's1' }, headers: {} });
      mockValidateSessionId.mockReturnValue(true);
      mockGetSession.mockResolvedValue(null as never);
      await validateSession(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('SESSION_EXPIRED');
    });

    it('quickSession.update 失敗時仍應設置 req.sessionId 並 next()', async () => {
      const req = createReq({ query: { session_id: 's1' }, headers: {} });
      mockValidateSessionId.mockReturnValue(true);
      mockGetSession.mockResolvedValue({ id: 's1', expires_at: new Date(Date.now() + 3600000) } as never);
      // @ts-expect-error mockRejectedValueOnce 參數在 Prisma mock 推斷下為 never
      mockQuickSessionUpdate.mockRejectedValueOnce(new Error('update failed'));
      await validateSession(req, createRes(), next);
      expect(req.sessionId).toBe('s1');
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('authorizeMedia', () => {
    it('已認證用戶 (req.user) 應直接 next()', async () => {
      const req = createReq({ user: { id: 'u1', email: 'u@x.com' } });
      await authorizeMedia(req, createRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    it('無認證且無 Session/Token 應 next(UNAUTHORIZED)', async () => {
      const req = createReq({ headers: {}, query: {} });
      await authorizeMedia(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('UNAUTHORIZED');
    });

    it('BLACKLIST_IPS 包含 req.ip 應記錄 logger.warn 並 next(FORBIDDEN)', async () => {
      const orig = process.env.BLACKLIST_IPS;
      process.env.BLACKLIST_IPS = ' 10.0.0.1 , 127.0.0.1 ';
      const req = createReq({ ip: '127.0.0.1', path: '/uploads/x', headers: {}, query: {} });
      await authorizeMedia(req, createRes(), next);
      expect(logger.warn).toHaveBeenCalledWith('Media access blocked by IP blacklist', { ip: '127.0.0.1', file: '/uploads/x' });
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('FORBIDDEN');
      process.env.BLACKLIST_IPS = orig;
    });

    it('ALLOW_PUBLIC_UPLOADS=true 且非 GET/HEAD 應 next(FORBIDDEN)', async () => {
      const orig = process.env.ALLOW_PUBLIC_UPLOADS;
      process.env.ALLOW_PUBLIC_UPLOADS = 'true';
      const req = createReq({ method: 'POST', path: '/uploads/x', headers: {}, query: {} });
      await authorizeMedia(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('FORBIDDEN');
      expect((next.mock.calls[0][0] as unknown as { message: string }).message).toMatch(/僅允許讀取|公開模式/);
      process.env.ALLOW_PUBLIC_UPLOADS = orig;
    });

    it('ALLOW_PUBLIC_UPLOADS=true 且 GET 且路徑在白名單應 next()', async () => {
      const origEnv = process.env.ALLOW_PUBLIC_UPLOADS;
      const origPaths = process.env.PUBLIC_UPLOAD_PATHS;
      process.env.ALLOW_PUBLIC_UPLOADS = 'true';
      process.env.PUBLIC_UPLOAD_PATHS = '/uploads,/files';
      const req = createReq({ method: 'GET', path: '/uploads/foo.jpg', headers: {}, query: {} });
      await authorizeMedia(req, createRes(), next);
      expect(next).toHaveBeenCalledWith();
      process.env.ALLOW_PUBLIC_UPLOADS = origEnv;
      process.env.PUBLIC_UPLOAD_PATHS = origPaths;
    });

    it('ALLOW_PUBLIC_UPLOADS=true 且路徑不在 PUBLIC_UPLOAD_PATHS 應 next(FORBIDDEN)', async () => {
      const origEnv = process.env.ALLOW_PUBLIC_UPLOADS;
      const origPaths = process.env.PUBLIC_UPLOAD_PATHS;
      process.env.ALLOW_PUBLIC_UPLOADS = 'true';
      process.env.PUBLIC_UPLOAD_PATHS = '/uploads';
      const req = createReq({ method: 'GET', path: '/other/foo.jpg', headers: {}, query: {} });
      await authorizeMedia(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('FORBIDDEN');
      process.env.ALLOW_PUBLIC_UPLOADS = origEnv;
      process.env.PUBLIC_UPLOAD_PATHS = origPaths;
    });

    it('有效 session_id 應設置 req.sessionId 並 next()', async () => {
      const req = createReq({ query: { session_id: 'guest_12345678901' }, headers: {} });
      mockValidateSessionId.mockReturnValue(true);
      mockGetSession.mockResolvedValue({ id: 'guest_12345678901', expires_at: new Date(Date.now() + 3600000) } as never);
      await authorizeMedia(req, createRes(), next);
      expect(req.sessionId).toBe('guest_12345678901');
      expect(next).toHaveBeenCalledWith();
    });

    it('生產環境且 ALLOW_PUBLIC_UPLOADS=true 應記錄 logger.error 並 next(FORBIDDEN)', async () => {
      const orig = process.env.ALLOW_PUBLIC_UPLOADS;
      process.env.ALLOW_PUBLIC_UPLOADS = 'true';
      mockEnvRef.current.NODE_ENV = 'production';
      const req = createReq({ method: 'GET', path: '/uploads/x', headers: {}, query: {} });
      await authorizeMedia(req, createRes(), next);
      expect(logger.error).toHaveBeenCalledWith('ALLOW_PUBLIC_UPLOADS 在生產環境被啟用，已阻止訪問');
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('FORBIDDEN');
      process.env.ALLOW_PUBLIC_UPLOADS = orig;
      mockEnvRef.current.NODE_ENV = 'test';
    });

    it('ALLOW_PUBLIC_UPLOADS=true 且 GET 且無 PUBLIC_UPLOAD_PATHS 應 next()', async () => {
      const origEnv = process.env.ALLOW_PUBLIC_UPLOADS;
      const origPaths = process.env.PUBLIC_UPLOAD_PATHS;
      process.env.ALLOW_PUBLIC_UPLOADS = 'true';
      delete process.env.PUBLIC_UPLOAD_PATHS;
      const req = createReq({ method: 'GET', path: '/any/path', headers: {}, query: {} });
      await authorizeMedia(req, createRes(), next);
      expect(next).toHaveBeenCalledWith();
      process.env.ALLOW_PUBLIC_UPLOADS = origEnv;
      if (origPaths !== undefined) process.env.PUBLIC_UPLOAD_PATHS = origPaths;
    });

    it('有效 token（f、h、path 匹配）應 next()', async () => {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update('foo.jpg').digest('hex');
      const jwt = require('jsonwebtoken').default;
      (jwt.verify as jest.Mock).mockReturnValue({ f: 'foo.jpg', h: hash });
      const req = createReq({ query: { token: 'signed-token' }, path: '/uploads/foo.jpg', headers: {} });
      await authorizeMedia(req, createRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    it('有效 token 且在 /uploads mount 下（baseUrl+path 與 payload.f 對齊）應 next()', async () => {
      // 模擬 app.use("/uploads", authorizeMedia)：req.baseUrl='/uploads', req.path='/1234.jpg'
      // signUrl 產生的 payload.f 為 'uploads/1234.jpg'
      const crypto = require('crypto');
      const filePath = 'uploads/1234.jpg';
      const hash = crypto.createHash('sha256').update(filePath).digest('hex');
      const jwt = require('jsonwebtoken').default;
      (jwt.verify as jest.Mock).mockReturnValue({ f: filePath, h: hash });
      const req = createReq({
        query: { token: 'signed-token' },
        path: '/1234.jpg',
        baseUrl: '/uploads',
        headers: {},
      });
      await authorizeMedia(req, createRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    it('無效 token（jwt.verify 拋錯）應記錄 logger.warn 並 next(UNAUTHORIZED)', async () => {
      const jwt = require('jsonwebtoken').default;
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const req = createReq({ query: { token: 'bad-token' }, path: '/uploads/foo.jpg', headers: {} });
      await authorizeMedia(req, createRes(), next);
      expect(logger.warn).toHaveBeenCalledWith('Media access denied', expect.objectContaining({ file: '/uploads/foo.jpg', ip: '127.0.0.1', requestId: 'req-1' }));
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as unknown as { code: string }).code).toBe('UNAUTHORIZED');
    });
  });
});
