/**
 * middleware/performance 單元測試
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

const mockGetRequestId = jest.fn();
const mockEnvRef = { current: { NODE_ENV: 'development' as string } };

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
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
}));

import logger from '../../../src/config/logger';
import { performanceMonitor, getPerformanceStats } from '../../../src/middleware/performance';
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

describe('middleware/performance', () => {
  beforeEach(() => {
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.debug.mockClear();
    mockGetRequestId.mockReturnValue('req-1');
    mockEnvRef.current = { NODE_ENV: 'development' };
  });

  describe('performanceMonitor', () => {
    it('應註冊 finish 監聽並調用 next()', () => {
      const req = { url: '/api/test', method: 'GET' } as Request;
      const res = createMockRes();
      const next = jest.fn();
      performanceMonitor(req, res, next);
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(next).toHaveBeenCalled();
    });

    it('開發環境 finish 時應記錄 debug', () => {
      mockEnvRef.current = { NODE_ENV: 'development' };
      const req = { url: '/api/test', method: 'GET' } as Request;
      const res = createMockRes();
      res.statusCode = 200;
      const next = jest.fn();
      performanceMonitor(req, res, next);
      res.emitFinish();
      expect(mockLogger.debug).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        requestId: 'req-1',
      }));
    });

    it('statusCode >= 400 時應記錄 warn (Request error)', () => {
      const req = { url: '/api/test', method: 'GET' } as Request;
      const res = createMockRes();
      res.statusCode = 500;
      const next = jest.fn();
      performanceMonitor(req, res, next);
      res.emitFinish();
      expect(mockLogger.warn).toHaveBeenCalledWith('Request error', expect.objectContaining({
        statusCode: 500,
        requestId: 'req-1',
      }));
    });

    it('duration > 1000 時應記錄 warn (Slow request detected)', () => {
      const req = { url: '/api/slow', method: 'GET' } as Request;
      const res = createMockRes();
      res.statusCode = 200;
      const next = jest.fn();
      jest.useFakeTimers();
      performanceMonitor(req, res, next);
      jest.advanceTimersByTime(1001);
      res.emitFinish();
      expect(mockLogger.warn).toHaveBeenCalledWith('Slow request detected', expect.objectContaining({
        method: 'GET',
        url: '/api/slow',
        duration: 1001,
        requestId: 'req-1',
      }));
      jest.useRealTimers();
    });

    it('生產環境 finish 時正常請求（status 200, duration < 1000）不應記錄', async () => {
      mockEnvRef.current = { NODE_ENV: 'production' };
      jest.resetModules();
      const { performanceMonitor: pm } = await import('../../../src/middleware/performance');
      const req = { url: '/api/test', method: 'GET' } as Request;
      const res = createMockRes();
      res.statusCode = 200;
      const next = jest.fn();
      pm(req, res, next);
      res.emitFinish();
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('getPerformanceStats', () => {
    it('應返回 memory、uptime、nodeVersion', () => {
      const stats = getPerformanceStats();
      expect(stats).toHaveProperty('memory');
      expect(stats.memory).toHaveProperty('heapUsed');
      expect(stats.memory).toHaveProperty('heapTotal');
      expect(stats.memory).toHaveProperty('rss');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('nodeVersion');
      expect(typeof stats.uptime).toBe('number');
      expect(stats.nodeVersion).toBe(process.version);
    });
  });
});
