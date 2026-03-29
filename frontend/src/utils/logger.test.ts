/**
 * Logger 單元測試
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from './logger';

const originalEnv = import.meta.env;

describe('logger', () => {
  beforeEach(() => {
    logger.clearLogs();
  });

  it('info 後 getLogs 應有一條記錄', () => {
    logger.info('test message');
    const logs = logger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].message).toBe('test message');
  });

  it('warn 後應有 warn 級別記錄', () => {
    logger.warn('warning');
    const logs = logger.getLogs();
    expect(logs[0].level).toBe('warn');
    expect(logs[0].message).toBe('warning');
  });

  it('error 後應有 error 級別記錄', () => {
    logger.error('error', new Error('err'));
    const logs = logger.getLogs();
    expect(logs[0].level).toBe('error');
    expect(logs[0].message).toBe('error');
  });

  it('clearLogs 應清空記錄', () => {
    logger.info('x');
    expect(logger.getLogs()).toHaveLength(1);
    logger.clearLogs();
    expect(logger.getLogs()).toHaveLength(0);
  });

  it('exportLogs 應返回 JSON 字串', () => {
    logger.info('export test');
    const json = logger.exportLogs();
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].message).toBe('export test');
  });

  it('debug 應寫入 debug 級別記錄', () => {
    logger.debug('debug msg', { foo: 1 });
    const logs = logger.getLogs();
    expect(logs[0].level).toBe('debug');
    expect(logs[0].message).toBe('debug msg');
    expect(logs[0].data).toEqual({ foo: 1 });
  });

  it('超過 maxLogs 時應踢掉最舊記錄', () => {
    for (let i = 0; i < 101; i++) logger.info(`msg-${i}`);
    const logs = logger.getLogs();
    expect(logs).toHaveLength(100);
    expect(logs[0].message).toBe('msg-1');
    expect(logs[99].message).toBe('msg-100');
  });

  describe('非 DEV 環境（PROD + VITE_SENTRY_DSN）', () => {
    beforeEach(() => {
      vi.stubGlobal('import.meta.env', {
        ...originalEnv,
        DEV: false,
        PROD: true,
        VITE_SENTRY_DSN: 'https://example@sentry.io/1',
      });
    });

    afterEach(() => {
      vi.stubGlobal('import.meta.env', originalEnv);
    });

    it('info 應走 Sentry 分支且仍寫入 getLogs', () => {
      logger.info('prod info');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('prod info');
    });

    it('warn 應走 Sentry 分支且仍寫入 getLogs', () => {
      logger.warn('prod warn');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });

    it('error 應走 PROD+Sentry 分支且仍寫入 getLogs', () => {
      logger.error('prod error', new Error('e'));
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
    });
  });
});
