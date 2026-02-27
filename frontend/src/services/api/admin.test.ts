/**
 * 管理員運維 API 單元測試
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminApi,
  getAdminToken,
  getAdminTokenFingerprint,
  isLikelyAdminJwt,
  getRateDenominatorLabel,
  normalizeAdminJobStatsData,
  setAdminToken,
  subscribeAdminTokenChanges,
  shouldShowSampledHint,
} from './admin';

const mockGet = vi.fn();

vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

describe('admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('normalizeAdminJobStatsData 應對缺失字段提供安全回退', () => {
    const normalized = normalizeAdminJobStatsData({
      days: 7,
      since: '2026-02-20T00:00:00.000Z',
      totals: {
        totalRuns: 3,
        successRuns: 1,
        failedRuns: 1,
        runningRuns: 1,
        completedRuns: 2,
        successRate: 0.3333,
        failureRate: 0.3333,
        successRateCompleted: 0.5,
        failureRateCompleted: 0.5,
        avgDurationMs: 1200,
      },
      perJob: [],
      dailyBuckets: [],
    });

    expect(normalized.rateBase).toBe('total_runs');
    expect(normalized.statsMeta.sampled).toBe(false);
    expect(normalized.statsMeta.maxRows).toBe(5000);
  });

  it('getJobStats 應攜帶 query 並返回 normalize 後資料', async () => {
    setAdminToken('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature');
    mockGet.mockResolvedValue({
      data: {
        data: {
          days: 14,
          since: '2026-02-10T00:00:00.000Z',
          totals: {
            totalRuns: 10,
            successRuns: 8,
            failedRuns: 1,
            runningRuns: 1,
            completedRuns: 9,
            successRate: 0.8,
            failureRate: 0.1,
            successRateCompleted: 0.8889,
            failureRateCompleted: 0.1111,
            avgDurationMs: 900,
          },
          perJob: [],
          dailyBuckets: [],
          rateBase: 'completed_runs',
          statsMeta: {
            maxRows: 1000,
            returnedRows: 42,
            sampled: true,
            sampleStrategy: 'latest_runs_desc',
          },
        },
      },
    });

    const data = await adminApi.getJobStats({ days: 14, includeRunning: false, maxRows: 1000 });

    expect(mockGet).toHaveBeenCalledWith('/admin/jobs/stats', {
      params: { days: 14, includeRunning: false, maxRows: 1000 },
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature' },
    });
    expect(data.rateBase).toBe('completed_runs');
    expect(data.statsMeta.sampled).toBe(true);
    expect(data.totals.totalRuns).toBe(10);
  });

  it('getMe 應攜帶 admin token 並返回 admin 身份', async () => {
    setAdminToken('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature');
    mockGet.mockResolvedValue({
      data: {
        data: {
          admin: {
            id: 'admin-1',
            email: 'ops@example.com',
            roleKey: 'ops',
            permissions: ['ops:read'],
          },
        },
      },
    });

    const data = await adminApi.getMe();

    expect(mockGet).toHaveBeenCalledWith('/admin/me', {
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature' },
    });
    expect(data.admin.id).toBe('admin-1');
    expect(data.admin.permissions).toEqual(['ops:read']);
  });

  it('分母與採樣輔助函式應返回正確語義', () => {
    expect(getRateDenominatorLabel('total_runs')).toBe('totalRuns');
    expect(getRateDenominatorLabel('completed_runs')).toBe('completedRuns');

    const sampledData = normalizeAdminJobStatsData({
      totals: {
        totalRuns: 0,
        successRuns: 0,
        failedRuns: 0,
        runningRuns: 0,
        completedRuns: 0,
        successRate: 0,
        failureRate: 0,
        successRateCompleted: 0,
        failureRateCompleted: 0,
        avgDurationMs: 0,
      },
      statsMeta: { sampled: true },
    });
    expect(shouldShowSampledHint(sampledData)).toBe(true);
  });

  it('setAdminToken/getAdminToken 應支持存取與清空', () => {
    expect(getAdminToken()).toBe('');
    expect(setAdminToken('  abc  ')).toBe(true);
    expect(getAdminToken()).toBe('abc');
    expect(sessionStorage.getItem('admin_token')).toBe('abc');
    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(setAdminToken('')).toBe(true);
    expect(getAdminToken()).toBe('');
  });

  it('setAdminToken 在 storage 異常時應返回 false', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    expect(setAdminToken('abc')).toBe(false);

    setItemSpy.mockRestore();
  });

  it('setAdminToken 清除 token 時若 storage 異常應返回 false', () => {
    sessionStorage.setItem('admin_token', 'abc');
    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    expect(setAdminToken('')).toBe(false);

    removeItemSpy.mockRestore();
  });

  it('setAdminToken 應觸發 token 變更訂閱事件', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAdminTokenChanges(listener);

    setAdminToken('abc');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('getAdminToken 應自動從 localStorage 遷移到 sessionStorage', () => {
    localStorage.setItem('admin_token', 'legacy-token');
    expect(getAdminToken()).toBe('legacy-token');
    expect(sessionStorage.getItem('admin_token')).toBe('legacy-token');
    expect(localStorage.getItem('admin_token')).toBeNull();
  });

  it('getAdminToken 遷移失敗時仍應返回原 local token', () => {
    localStorage.setItem('admin_token', 'legacy-token');
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (this === sessionStorage && key === 'admin_token') {
          throw new Error('session disabled');
        }
        return originalSetItem.call(this, key, value);
      });

    expect(getAdminToken()).toBe('legacy-token');
    expect(localStorage.getItem('admin_token')).toBe('legacy-token');

    setItemSpy.mockRestore();
  });

  it('getAdminTokenFingerprint 應對空值與不同 token 產生穩定結果', () => {
    expect(getAdminTokenFingerprint('')).toBe('missing');
    expect(getAdminTokenFingerprint('token-a')).not.toBe(getAdminTokenFingerprint('token-b'));
    expect(getAdminTokenFingerprint('token-a')).toBe(getAdminTokenFingerprint('token-a'));
  });

  it('isLikelyAdminJwt 應識別有效與無效格式', () => {
    expect(isLikelyAdminJwt('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature')).toBe(true);
    expect(isLikelyAdminJwt('invalid-token')).toBe(false);
    expect(isLikelyAdminJwt('a.b')).toBe(false);
  });
});

