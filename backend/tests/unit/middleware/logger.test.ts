/**
 * middleware/logger (requestLogger) 單元測試
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const mockGetRequestId = jest.fn();
const mockGetAuthUserIdOptional = jest.fn();
const mockGetSessionId = jest.fn();
const mockEnvRef = { current: { NODE_ENV: 'development' as string } };
const hashSessionId = (sid: string) =>
  crypto.createHash('sha256').update(sid).digest('hex').slice(0, 12);

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
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

import logger from '../../../src/config/logger';
import { requestLogger } from '../../../src/middleware/logger';
const mockLogger = logger as jest.Mocked<typeof logger>;

function createMockRes(): Response & { emitFinish: () => void } {
  const finishHandlers: (() => void)[] = [];
  const res = {
    statusCode: 200,
    on: jest.fn((event: string, fn: () => void) => {
      if (event === 'finish') finishHandlers.push(fn);
    }),
    emitFinish: () => finishHandlers.forEach(fn => fn()),
  };
  return res as unknown as Response & { emitFinish: () => void };
}

describe('middleware/logger (requestLogger)', () => {
  beforeEach(() => {
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockGetRequestId.mockReturnValue('req-1');
    mockGetAuthUserIdOptional.mockReturnValue(undefined);
    mockGetSessionId.mockReturnValue(undefined);
    mockEnvRef.current = { NODE_ENV: 'development' };
  });

  it('應註冊 finish 監聽並調用 next()', () => {
    const req = { url: '/api/test', method: 'GET', ip: '127.0.0.1', get: jest.fn(() => 'Mozilla/1.0') } as unknown as Request;
    const res = createMockRes();
    const next = jest.fn();
    requestLogger(req, res, next);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('開發環境 finish 時應記錄 info（statusCode < 400）', () => {
    mockEnvRef.current = { NODE_ENV: 'development' };
    const req = { url: '/api/test', method: 'GET', ip: '127.0.0.1', get: jest.fn(() => 'Mozilla/1.0') } as unknown as Request;
    const res = createMockRes();
    res.statusCode = 200;
    const next = jest.fn();
    requestLogger(req, res, next);
    res.emitFinish();
    expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request', expect.objectContaining({
      request_id: 'req-1',
      method: 'GET',
      url: '/api/test',
      status: 200,
    }));
  });

  it('開發環境 finish 時應包含 ip、userAgent、userId、sessionId', () => {
    mockGetAuthUserIdOptional.mockReturnValue('user-1');
    mockGetSessionId.mockReturnValue('session-1');
    const req = { url: '/api/test', method: 'GET', ip: '127.0.0.1', get: jest.fn(() => 'Mozilla/1.0') } as unknown as Request;
    const res = createMockRes();
    const next = jest.fn();
    requestLogger(req, res, next);
    res.emitFinish();
    expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request', expect.objectContaining({
      ip: '127.0.0.1',
      userAgent: 'Mozilla/1.0',
      userId: 'user-1',
      sessionId: hashSessionId('session-1'),
    }));
  });

  it('statusCode >= 400 時應記錄 warn', () => {
    const req = { url: '/api/test', method: 'GET', ip: '127.0.0.1', get: jest.fn() } as unknown as Request;
    const res = createMockRes();
    res.statusCode = 404;
    const next = jest.fn();
    requestLogger(req, res, next);
    res.emitFinish();
    expect(mockLogger.warn).toHaveBeenCalledWith('HTTP Request', expect.objectContaining({ status: 404 }));
  });

  it('生產環境且無 uid/sid 時不應在 logData 中加入 userId/sessionId', () => {
    mockEnvRef.current = { NODE_ENV: 'production' };
    mockGetAuthUserIdOptional.mockReturnValue(undefined);
    mockGetSessionId.mockReturnValue(undefined);
    const req = { url: '/api/test', method: 'GET', ip: '127.0.0.1', get: jest.fn() } as unknown as Request;
    const res = createMockRes();
    res.statusCode = 404;
    const next = jest.fn();
    requestLogger(req, res, next);
    res.emitFinish();
    const logData = (mockLogger.warn as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(logData).not.toHaveProperty('userId');
    expect(logData).not.toHaveProperty('sessionId');
  });

  it('生產環境且有 uid 時應在 logData 中加入 userId', () => {
    mockEnvRef.current = { NODE_ENV: 'production' };
    mockGetAuthUserIdOptional.mockReturnValue('user-1');
    mockGetSessionId.mockReturnValue(undefined);
    const req = { url: '/api/test', method: 'GET', ip: '127.0.0.1', get: jest.fn() } as unknown as Request;
    const res = createMockRes();
    res.statusCode = 404;
    const next = jest.fn();
    requestLogger(req, res, next);
    res.emitFinish();
    expect(mockLogger.warn).toHaveBeenCalledWith('HTTP Request', expect.objectContaining({ userId: 'user-1' }));
  });

  it('生產環境正常請求且 duration > 1s 時應記錄 info (slow)', () => {
    mockEnvRef.current = { NODE_ENV: 'production' };
    const req = { url: '/api/test', method: 'GET', ip: '127.0.0.1', get: jest.fn() } as unknown as Request;
    const res = createMockRes();
    res.statusCode = 200;
    const next = jest.fn();
    jest.useFakeTimers();
    requestLogger(req, res, next);
    jest.advanceTimersByTime(1001);
    res.emitFinish();
    expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request (slow)', expect.objectContaining({
      request_id: 'req-1',
      duration: '1001ms',
    }));
    jest.useRealTimers();
  });

  it('生產環境且有 sessionId 時應在 logData 中加入 sessionId', () => {
    mockEnvRef.current = { NODE_ENV: 'production' };
    mockGetAuthUserIdOptional.mockReturnValue(undefined);
    mockGetSessionId.mockReturnValue('session-1');
    const req = { url: '/api/test', method: 'GET', ip: '127.0.0.1', get: jest.fn() } as unknown as Request;
    const res = createMockRes();
    res.statusCode = 404;
    const next = jest.fn();
    requestLogger(req, res, next);
    res.emitFinish();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'HTTP Request',
      expect.objectContaining({ sessionId: hashSessionId('session-1') })
    );
  });
});
