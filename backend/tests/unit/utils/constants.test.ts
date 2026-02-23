/**
 * 常量測試
 */

import {
  CASE_STATUS,
  CASE_MODE,
  CASE_TYPES,
  PAIRING_STATUS,
  LOCK_TTL,
  SESSION_EXPIRY,
  CACHE_CONFIG,
  LIMITS,
} from '../../../src/utils/constants';

describe('Constants', () => {
  it('CASE_STATUS 應包含預期值', () => {
    expect(CASE_STATUS.DRAFT).toBe('draft');
    expect(CASE_STATUS.SUBMITTED).toBe('submitted');
    expect(CASE_STATUS.COMPLETED).toBe('completed');
  });

  it('CASE_MODE 應包含 quick', () => {
    expect(CASE_MODE.QUICK).toBe('quick');
  });

  it('CASE_TYPES 應為非空數組', () => {
    expect(CASE_TYPES.length).toBeGreaterThan(0);
    expect(CASE_TYPES).toContain('生活習慣衝突');
  });

  it('PAIRING_STATUS 應包含 temp', () => {
    expect(PAIRING_STATUS.TEMP).toBe('temp');
  });

  it('LOCK_TTL 應為正數', () => {
    expect(LOCK_TTL.JUDGMENT_GENERATION).toBe(120);
    expect(LOCK_TTL.DEFAULT).toBe(60);
  });

  it('SESSION_EXPIRY 應包含過期時間', () => {
    expect(SESSION_EXPIRY.DEFAULT_MS).toBe(24 * 60 * 60 * 1000);
    expect(SESSION_EXPIRY.COMPLETED_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(SESSION_EXPIRY.CLEANUP_BATCH).toBe(1000);
  });

  it('CACHE_CONFIG 應包含大小和間隔', () => {
    expect(CACHE_CONFIG.MAX_SIZE).toBe(1000);
    expect(CACHE_CONFIG.CLEANUP_INTERVAL_MS).toBe(5 * 60 * 1000);
  });

  it('LIMITS 應包含陳述長度限制', () => {
    expect(LIMITS.MAX_STATEMENT_LENGTH).toBe(2000);
    expect(LIMITS.MIN_STATEMENT_LENGTH).toBe(50);
    expect(LIMITS.MAX_EVIDENCE_COUNT).toBe(3);
  });
});
