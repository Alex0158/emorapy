/**
 * middleware/errorHandler 單元測試
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from '../../../src/utils/errors';

const mockLogger = { error: jest.fn() };
const mockGetRequestId = jest.fn();
const mockGetAuthUserIdOptional = jest.fn();
const mockGetSessionId = jest.fn();

jest.mock('../../../src/config/logger', () => ({ __esModule: true, default: mockLogger }));
jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef.current;
  },
}));
jest.mock('../../../src/utils/request', () => ({
  getRequestId: (...args: unknown[]) => mockGetRequestId(...args),
  getAuthUserIdOptional: (...args: unknown[]) => mockGetAuthUserIdOptional(...args),
  getSessionId: (...args: unknown[]) => mockGetSessionId(...args),
}));

const mockEnvRef = { current: { NODE_ENV: 'development' as string } };
const hashSessionId = (sid: string) =>
  crypto.createHash('sha256').update(sid).digest('hex').slice(0, 12);

function createMockReq(): Partial<Request> {
  return { url: '/api/test', method: 'GET', locale: 'zh-TW' as Request['locale'] };
}

function createMockRes(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('middleware/errorHandler', () => {
  let errorHandler: (err: Error | AppError, req: Request, res: Response, _next: NextFunction) => void;

  beforeEach(async () => {
    mockLogger.error.mockClear();
    mockGetRequestId.mockReturnValue('req-1');
    mockGetAuthUserIdOptional.mockReturnValue(undefined);
    mockGetSessionId.mockReturnValue(undefined);
    mockEnvRef.current = { NODE_ENV: 'development' };
    const mod = await import('../../../src/middleware/errorHandler');
    errorHandler = mod.errorHandler;
  });

  it('應記錄錯誤並以 AppError 的 statusCode 與 code 回傳', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = new AppError(400, 'VALIDATION_ERROR', '驗證失敗', { field: 'email' });

    errorHandler(err, req, res, jest.fn());

    expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', expect.objectContaining({
      request_id: 'req-1',
      error: '驗證失敗',
      url: '/api/test',
      method: 'GET',
    }));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '驗證失敗',
        details: { field: 'email' },
      },
    });
  });

  it('生產環境下 AppError 不應回傳 details', () => {
    mockEnvRef.current = { NODE_ENV: 'production' };
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = new AppError(400, 'VALIDATION_ERROR', '驗證失敗', { field: 'email' });

    errorHandler(err, req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '驗證失敗',
        details: undefined,
      },
    });
  });

  it('應處理 Prisma P2002 唯一約束錯誤並回傳 409', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['email'] } });

    errorHandler(err as Error & { code: string; meta?: { target?: string[] } }, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'EMAIL_EXISTS',
        message: '該郵箱已被註冊',
      },
    });
  });

  it('P2002 在 production 應回傳簡化訊息', () => {
    mockEnvRef.current = { NODE_ENV: 'production' };
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['email'] } });

    errorHandler(err as Error & { code: string; meta?: { target?: string[] } }, req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'EMAIL_EXISTS', message: '該郵箱已被註冊' },
    });
  });

  it('P2002 無 meta.target 時應回傳未知字段訊息', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = Object.assign(new Error('Unique constraint'), { code: 'P2002' });

    errorHandler(err as Error & { code: string }, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'CONFLICT',
        message: expect.stringContaining('未知字段'),
      },
    });
  });

  it('應處理 Prisma P2025 並回傳 404', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = Object.assign(new Error('Record not found'), { code: 'P2025' });

    errorHandler(err as Error & { code: string }, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: '資源不存在' },
    });
  });

  it('未知錯誤應回傳 500 且生產環境不暴露詳細訊息', () => {
    mockEnvRef.current = { NODE_ENV: 'production' };
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = new Error('Internal secret message');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服務器內部錯誤，請稍後再試',
      },
    });
  });

  it('未知錯誤在開發環境應回傳原始 message', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = new Error('Detailed error for dev');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Detailed error for dev',
      },
    });
  });

  it('應在 logger.error 中帶入 userId 與 sessionId', () => {
    mockGetAuthUserIdOptional.mockReturnValue('user-123');
    mockGetSessionId.mockReturnValue('session-456');
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = new Error('Any');

    errorHandler(err, req, res, jest.fn());

    expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', expect.objectContaining({
      userId: 'user-123',
      sessionId: hashSessionId('session-456'),
    }));
  });
});
