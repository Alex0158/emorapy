/**
 * 常量測試
 */

import {
  CASE_STATUS,
  CASE_MODE,
  CASE_TYPES,
  PAIRING_STATUS,
  LOCK_TTL,
  AI_TIMEOUT,
  SESSION_EXPIRY,
  CACHE_CONFIG,
  LIMITS,
  EVIDENCE_UPLOAD_ALLOWED_STATUSES,
  PAGINATION,
} from '../../../src/utils/constants';

describe('Constants', () => {
  it('CASE_STATUS 應包含預期值', () => {
    expect(CASE_STATUS.DRAFT).toBe('draft');
    expect(CASE_STATUS.SUBMITTED).toBe('submitted');
    expect(CASE_STATUS.COMPLETED).toBe('completed');
  });

  it('CASE_STATUS 應包含完整狀態（in_progress、judgment_failed、cancelled）', () => {
    expect(CASE_STATUS.IN_PROGRESS).toBe('in_progress');
    expect(CASE_STATUS.JUDGMENT_FAILED).toBe('judgment_failed');
    expect(CASE_STATUS.CANCELLED).toBe('cancelled');
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
    expect(LOCK_TTL.JUDGMENT_GENERATION).toBe(300);
    expect(LOCK_TTL.DEFAULT).toBe(60);
  });

  it('判決鎖 TTL 應高於端到端判決超時', () => {
    expect(LOCK_TTL.JUDGMENT_GENERATION * 1000).toBeGreaterThan(AI_TIMEOUT.JUDGMENT_GENERATION);
  });

  it('AI_TIMEOUT 應包含單次請求與整體判決 budget', () => {
    expect(AI_TIMEOUT.OPENAI_REQUEST).toBe(90_000);
    expect(AI_TIMEOUT.JUDGMENT_GENERATION).toBe(180_000);
    expect(AI_TIMEOUT.JUDGMENT_GENERATION).toBeGreaterThan(AI_TIMEOUT.OPENAI_REQUEST);
  });

  it('LOCK_TTL 應包含 CASE_CREATE、EVIDENCE_UPLOAD 等業務鎖', () => {
    expect(LOCK_TTL.CASE_CREATE).toBe(30);
    expect(LOCK_TTL.EVIDENCE_UPLOAD).toBe(30);
    expect(LOCK_TTL.PAIRING_CREATE).toBe(20);
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

  it('EVIDENCE_UPLOAD_ALLOWED_STATUSES 應包含 draft/submitted/in_progress', () => {
    expect(EVIDENCE_UPLOAD_ALLOWED_STATUSES).toContain('draft');
    expect(EVIDENCE_UPLOAD_ALLOWED_STATUSES).toContain('submitted');
    expect(EVIDENCE_UPLOAD_ALLOWED_STATUSES).toContain('in_progress');
  });

  it('PAGINATION 應包含分頁常量', () => {
    expect(PAGINATION.CASE_LIST_MAX_PAGE_SIZE).toBe(50);
    expect(PAGINATION.CASE_LIST_DEFAULT_PAGE_SIZE).toBe(10);
  });
});
