/**
 * Logger 單元測試
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { logger } from './logger';

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
});
