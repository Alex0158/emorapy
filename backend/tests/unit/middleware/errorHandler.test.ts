/**
 * middleware/errorHandler 單元測試
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { AppError } from '../../../src/utils/errors';

const mockLogger = { error: jest.fn(), warn: jest.fn() };
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
    mockLogger.warn.mockClear();
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

    expect(mockLogger.warn).toHaveBeenCalledWith('Request rejected', expect.objectContaining({
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

  it('P2002 email duplicate 應依 en-US locale 翻譯特殊錯誤訊息', () => {
    const req = { ...createMockReq(), locale: 'en-US' as Request['locale'] } as Request;
    const res = createMockRes() as Response;
    const err = Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['email'] } });

    errorHandler(err as Error & { code: string; meta?: { target?: string[] } }, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'EMAIL_EXISTS', message: 'This email has already been registered' },
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

  it('P2002 無 meta.target 時應依 en-US locale 翻譯 development fallback suffix', () => {
    const req = { ...createMockReq(), locale: 'en-US' as Request['locale'] } as Request;
    const res = createMockRes() as Response;
    const err = Object.assign(new Error('Unique constraint'), { code: 'P2002' });

    errorHandler(err as Error & { code: string }, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Unique constraint violation: unknown field',
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

  it('4xx AppError 應記錄 warn（避免污染 5xx 錯誤訊號）', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = new AppError(403, 'CORS_ORIGIN_DENIED', '不允許的來源');

    errorHandler(err, req, res, jest.fn());

    expect(mockLogger.warn).toHaveBeenCalledWith('Request rejected', expect.objectContaining({
      error: '不允許的來源',
      method: 'GET',
      url: '/api/test',
    }));
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('unknown AppError code fallback 應依 en-US locale 翻譯 backend-owned message', () => {
    const req = { ...createMockReq(), locale: 'en-US' as Request['locale'] } as Request;
    const res = createMockRes() as Response;
    const err = new AppError(403, 'CORS_ORIGIN_DENIED', '不允許的來源');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'CORS_ORIGIN_DENIED',
        message: 'Origin is not allowed',
        details: undefined,
      },
    });
  });

  it('應處理 MulterError LIMIT_FILE_SIZE 並回傳 413', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = new multer.MulterError('LIMIT_FILE_SIZE');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: expect.any(String),
      },
    });
  });

  it('MulterError 應依 en-US locale 翻譯特殊錯誤訊息', () => {
    const cases: Array<{
      multerCode: multer.ErrorCode;
      status: number;
      code: string;
      message: string;
    }> = [
      {
        multerCode: 'LIMIT_FILE_SIZE',
        status: 413,
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds the limit',
      },
      {
        multerCode: 'LIMIT_FILE_COUNT',
        status: 400,
        code: 'TOO_MANY_FILES',
        message: 'File count exceeds the limit',
      },
      {
        multerCode: 'LIMIT_UNEXPECTED_FILE',
        status: 400,
        code: 'INVALID_FILE_FIELD',
        message: 'Invalid file field',
      },
    ];

    for (const testCase of cases) {
      const req = { ...createMockReq(), locale: 'en-US' as Request['locale'] } as Request;
      const res = createMockRes() as Response;
      const err = new multer.MulterError(testCase.multerCode);

      errorHandler(err, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(testCase.status);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: testCase.code,
          message: testCase.message,
        },
      });
    }
  });

  it('應處理 MulterError LIMIT_FILE_COUNT 並回傳 400', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = new multer.MulterError('LIMIT_FILE_COUNT');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'TOO_MANY_FILES',
        message: expect.any(String),
      },
    });
  });

  it('應處理 MulterError LIMIT_UNEXPECTED_FILE 並回傳 400', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INVALID_FILE_FIELD',
        message: expect.any(String),
      },
    });
  });

  it('err 為 null 時應回傳 500 且不崩潰（邊界：防禦性）', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;

    errorHandler(null as unknown as Error, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: expect.any(String),
      },
    });
  });

  it('err 為非 Error 物件時應回傳 500 且不崩潰（邊界：防禦性）', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;

    errorHandler('string error' as unknown as Error, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: expect.any(String),
      },
    });
  });
});
