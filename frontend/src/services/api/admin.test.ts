/**
 * 管理員運維 API 單元測試
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminApi,
  getAdminToken,
  getAdminTokenFingerprint,
  isAdminTokenExpired,
  isLikelyAdminJwt,
  getRateDenominatorLabel,
  normalizeAdminJobStatsData,
  setAdminToken,
  subscribeAdminTokenChanges,
  shouldShowSampledHint,
} from './admin';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
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

  it('normalizeAdminJobStatsData 應正確處理 perJob 與 dailyBuckets 陣列', () => {
    const normalized = normalizeAdminJobStatsData({
      days: 3,
      since: '',
      totals: { totalRuns: 5, successRuns: 4, failedRuns: 1 },
      perJob: [
        {
          jobKey: 'cleanup',
          totalRuns: 2,
          successRuns: 2,
          avgDurationMs: 500,
          totalAffectedCount: 10,
          lastRunAt: '2026-03-01T12:00:00Z',
        },
        { jobKey: 123 as unknown as string, lastRunAt: null },
      ],
      dailyBuckets: [
        { date: '2026-03-01', totalRuns: 2, successRuns: 1 },
        { date: 456 as unknown as string, totalRuns: 0 },
      ],
      rateBase: 'completed_runs',
      statsMeta: { maxRows: 100, returnedRows: 2, sampled: true },
    });

    expect(normalized.since).toBe(new Date(0).toISOString());
    expect(normalized.rateBase).toBe('completed_runs');
    expect(normalized.statsMeta.sampled).toBe(true);

    expect(normalized.perJob).toHaveLength(2);
    expect(normalized.perJob[0].jobKey).toBe('cleanup');
    expect(normalized.perJob[0].avgDurationMs).toBe(500);
    expect(normalized.perJob[0].totalAffectedCount).toBe(10);
    expect(normalized.perJob[0].lastRunAt).toBe('2026-03-01T12:00:00Z');
    expect(normalized.perJob[1].jobKey).toBe('');
    expect(normalized.perJob[1].lastRunAt).toBe('');

    expect(normalized.dailyBuckets).toHaveLength(2);
    expect(normalized.dailyBuckets[0].date).toBe('2026-03-01');
    expect(normalized.dailyBuckets[0].totalRuns).toBe(2);
    expect(normalized.dailyBuckets[1].date).toBe('');
  });

  it('normalizeAdminJobStatsData 應對 totals.avgDurationMs 無效值回退為 0', () => {
    const normalized = normalizeAdminJobStatsData({
      totals: { avgDurationMs: -1 },
    });
    expect(normalized.totals.avgDurationMs).toBe(0);

    const normalized2 = normalizeAdminJobStatsData({
      totals: { avgDurationMs: NaN },
    });
    expect(normalized2.totals.avgDurationMs).toBe(0);
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

  it('getReportCosts 應攜帶 admin token 並返回成本資料', async () => {
    setAdminToken('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature');
    mockGet.mockResolvedValue({
      data: {
        data: {
          generatedAt: '2026-02-28T00:00:00.000Z',
          currency: 'USD',
          partial: false,
          reasons: [],
          summary: {
            redisMemoryMb: 12.3,
            redisTotalKeys: 99,
            railwayEgressGb24h: 1.1,
            railwayEgressGb7d: 3.3,
            openaiCostUsd24h: 0.12,
            openaiCostUsd7d: 0.88,
            openaiInputTokens24h: 1200,
            openaiOutputTokens24h: 800,
          },
          redis: { status: 'ok', memoryUsedBytes: 12800000, connectedClients: 2, totalKeys: 99 },
          railway: { status: 'ok', egressGb24h: 1.1, egressGb7d: 3.3, dailyEgressGb: [] },
          openai: {
            status: 'ok',
            costUsd24h: 0.12,
            costUsd7d: 0.88,
            inputTokens24h: 1200,
            outputTokens24h: 800,
            dailyCostUsd: [],
          },
        },
      },
    });

    const data = await adminApi.getReportCosts();

    expect(mockGet).toHaveBeenCalledWith('/admin/reports/costs', {
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature' },
    });
    expect(data.currency).toBe('USD');
    expect(data.summary.openaiCostUsd7d).toBe(0.88);
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

  it('adminApi.login 成功應返回 token 與 admin', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          token: 'admin-jwt',
          admin: { id: 'a1', email: 'ops@test.com', roleKey: 'ops', permissions: [] },
        },
      },
    });
    const result = await adminApi.login({ email: 'ops@test.com', password: 'pwd' });
    expect(mockPost).toHaveBeenCalledWith('/admin/login', { email: 'ops@test.com', password: 'pwd' });
    expect(result.token).toBe('admin-jwt');
    expect(result.admin.id).toBe('a1');
  });

  it('adminApi.login 回應缺少 token 或 admin.id 時應拋錯', async () => {
    mockPost.mockResolvedValue({ data: { data: { admin: { id: 'a1' } } } });
    await expect(adminApi.login({ email: 'x', password: 'p' })).rejects.toThrow(
      'Invalid admin login response from server'
    );
    mockPost.mockResolvedValue({ data: { data: { token: 't', admin: {} } } });
    await expect(adminApi.login({ email: 'x', password: 'p' })).rejects.toThrow(
      'Invalid admin login response from server'
    );
  });

  it('adminApi.getMe 回應缺少 admin.id 時應拋錯', async () => {
    setAdminToken('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.sig');
    mockGet.mockResolvedValue({ data: { data: { admin: {} } } });
    await expect(adminApi.getMe()).rejects.toThrow('Invalid admin me response from server');
  });

  it('adminApi.getMe 後端回傳 admin 為 null 時應拋錯（F10 邊界：API 回傳不完整時防禦）', async () => {
    setAdminToken('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.sig');
    mockGet.mockResolvedValue({ data: { data: { admin: null } } });
    await expect(adminApi.getMe()).rejects.toThrow('Invalid admin me response from server');
  });

  it('adminApi.getMe 後端回傳 admin 為 undefined 時應拋錯（F10 邊界：API 回傳不完整時防禦）', async () => {
    setAdminToken('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.sig');
    mockGet.mockResolvedValue({ data: { data: {} } });
    await expect(adminApi.getMe()).rejects.toThrow('Invalid admin me response from server');
  });

  it('isAdminTokenExpired 當 exp 已過期應返回 true', () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjB9.aaa';
    expect(isAdminTokenExpired(expiredToken)).toBe(true);
  });

  it('getAdminToken 當 token 過期應清除並返回空字串', () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjB9.aaa';
    sessionStorage.setItem('admin_token', expiredToken);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    expect(getAdminToken()).toBe('');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    expect(sessionStorage.getItem('admin_token')).toBeNull();
    dispatchSpy.mockRestore();
  });

  describe('adminApi 其他方法', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.sig';
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    beforeEach(() => {
      setAdminToken(token);
    });

    it('getHealthDetailed 應攜帶 token 並返回健康詳情', async () => {
      const healthData = { status: 'ok', db: 'connected', redis: 'ok' };
      mockGet.mockResolvedValue({ data: { data: healthData } });
      const data = await adminApi.getHealthDetailed();
      expect(mockGet).toHaveBeenCalledWith('/admin/health/detailed', authHeaders);
      expect(data).toEqual(healthData);
    });

    it('listJobs 應攜帶 token 並返回 job 列表', async () => {
      const jobsData = { jobs: [{ jobKey: 'cleanup', lastRunAt: '2026-02-28T00:00:00.000Z' }] };
      mockGet.mockResolvedValue({ data: { data: jobsData } });
      const data = await adminApi.listJobs();
      expect(mockGet).toHaveBeenCalledWith('/admin/jobs', authHeaders);
      expect(data.jobs).toHaveLength(1);
      expect(data.jobs[0].jobKey).toBe('cleanup');
    });

    it('triggerJob 應攜帶 token 並觸發指定 job', async () => {
      const triggerResult = { jobKey: 'cleanup', triggeredAt: '2026-02-28T12:00:00.000Z', status: 'queued', note: '' };
      mockPost.mockResolvedValue({ data: { data: triggerResult } });
      const data = await adminApi.triggerJob('cleanup');
      expect(mockPost).toHaveBeenCalledWith('/admin/jobs/cleanup/trigger', {}, { headers: { Authorization: `Bearer ${token}` } });
      expect(data.jobKey).toBe('cleanup');
      expect(data.status).toBe('queued');
    });

    it('listConfigs 應攜帶 params 與 token', async () => {
      const configsData = { items: [{ key: 'max_retries', value: '3' }], total: 1 };
      mockGet.mockResolvedValue({ data: { data: configsData } });
      const data = await adminApi.listConfigs({ limit: 10, offset: 0 });
      expect(mockGet).toHaveBeenCalledWith('/admin/configs', { params: { limit: 10, offset: 0 }, ...authHeaders });
      expect(data.items).toHaveLength(1);
      expect(data.items[0].key).toBe('max_retries');
    });

    it('upsertConfig 應攜帶 payload 與 token', async () => {
      const item = { key: 'max_retries', value: '5', description: 'Max retries', isRuntime: false, isSensitive: false };
      mockPut.mockResolvedValue({ data: { data: { item, runtime: { jobsEnabled: true } } } });
      const data = await adminApi.upsertConfig({ key: 'max_retries', value: 5 });
      expect(mockPut).toHaveBeenCalledWith('/admin/configs', { key: 'max_retries', value: 5 }, authHeaders);
      expect(data.item.key).toBe('max_retries');
      expect(data.runtime?.jobsEnabled).toBe(true);
    });

    it('listUsers 應攜帶 params 與 token', async () => {
      const usersData = { items: [{ id: 'u1', email: 'u@test.com' }], total: 1 };
      mockGet.mockResolvedValue({ data: { data: usersData } });
      const data = await adminApi.listUsers({ q: 'test', limit: 20 });
      expect(mockGet).toHaveBeenCalledWith('/admin/users', { params: { q: 'test', limit: 20 }, ...authHeaders });
      expect(data.items).toHaveLength(1);
      expect(data.items[0].email).toBe('u@test.com');
    });

    it('getUserDetail 應攜帶 userId 與 token', async () => {
      const userData = { user: { id: 'u1', email: 'u@test.com' } };
      mockGet.mockResolvedValue({ data: { data: userData } });
      const data = await adminApi.getUserDetail('u1');
      expect(mockGet).toHaveBeenCalledWith('/admin/users/u1', authHeaders);
      expect(data.user).toEqual({ id: 'u1', email: 'u@test.com' });
    });

    it('updateUserStatus 應攜帶 payload 與 token', async () => {
      const userData = { user: { id: 'u1', email: 'u@test.com', status: 'locked' } };
      mockPatch.mockResolvedValue({ data: { data: userData } });
      const data = await adminApi.updateUserStatus('u1', { action: 'lock', lockMinutes: 30 });
      expect(mockPatch).toHaveBeenCalledWith('/admin/users/u1/status', { action: 'lock', lockMinutes: 30 }, authHeaders);
      expect(data.user.status).toBe('locked');
    });

    it('listAuditLogs 應攜帶 params 與 token', async () => {
      const logsData = { items: [{ id: 'log1', entityType: 'user', action: 'login' }], total: 1 };
      mockGet.mockResolvedValue({ data: { data: logsData } });
      const data = await adminApi.listAuditLogs({ entityType: 'user', limit: 50 });
      expect(mockGet).toHaveBeenCalledWith('/admin/audit-logs', { params: { entityType: 'user', limit: 50 }, ...authHeaders });
      expect(data.items).toHaveLength(1);
      expect(data.items[0].action).toBe('login');
    });

    it('downloadAuditLogsCsv 應返回 Blob', async () => {
      const blob = new Blob(['csv,data'], { type: 'text/csv' });
      mockGet.mockResolvedValue({ data: blob });
      const data = await adminApi.downloadAuditLogsCsv({ from: '2026-02-01', to: '2026-02-28' });
      expect(mockGet).toHaveBeenCalledWith('/admin/audit-logs.csv', {
        params: { from: '2026-02-01', to: '2026-02-28' },
        ...authHeaders,
        responseType: 'blob',
      });
      expect(data).toBeInstanceOf(Blob);
      expect(data.type).toBe('text/csv');
    });

    it('getReportOverview 應攜帶 token 並返回概覽', async () => {
      const overviewData = { totalUsers: 100, totalCases: 50 };
      mockGet.mockResolvedValue({ data: { data: overviewData } });
      const data = await adminApi.getReportOverview();
      expect(mockGet).toHaveBeenCalledWith('/admin/reports/overview', authHeaders);
      expect(data.totalUsers).toBe(100);
    });

    it('getReportFunnel 應攜帶 token 並返回漏斗', async () => {
      const funnelData = { stages: [{ name: 'register', count: 80 }] };
      mockGet.mockResolvedValue({ data: { data: funnelData } });
      const data = await adminApi.getReportFunnel();
      expect(mockGet).toHaveBeenCalledWith('/admin/reports/funnel', authHeaders);
      expect(data.stages).toHaveLength(1);
    });

    it('getCustomReport 應攜帶 metrics 與 token', async () => {
      const metricsData = { metrics: { activeUsers: 42, totalCases: 100 } };
      mockPost.mockResolvedValue({ data: { data: metricsData } });
      const data = await adminApi.getCustomReport(['activeUsers', 'totalCases']);
      expect(mockPost).toHaveBeenCalledWith('/admin/reports/custom', { metrics: ['activeUsers', 'totalCases'] }, authHeaders);
      expect(data.metrics.activeUsers).toBe(42);
    });

    it('downloadReportOverviewCsv 應返回 Blob', async () => {
      const blob = new Blob(['overview,csv'], { type: 'text/csv' });
      mockGet.mockResolvedValue({ data: blob });
      const data = await adminApi.downloadReportOverviewCsv();
      expect(mockGet).toHaveBeenCalledWith('/admin/reports/overview.csv', { ...authHeaders, responseType: 'blob' });
      expect(data).toBeInstanceOf(Blob);
    });

    it('getInterviewRuntimeConfig 應攜帶 token', async () => {
      const configData = { maxQuestions: 20, timeoutSeconds: 300 };
      mockGet.mockResolvedValue({ data: { data: configData } });
      const data = await adminApi.getInterviewRuntimeConfig();
      expect(mockGet).toHaveBeenCalledWith('/admin/runtime/interview', authHeaders);
      expect(data.maxQuestions).toBe(20);
    });

    it('upsertAlertRules 應攜帶 rules 與 token', async () => {
      const item = { key: 'alerts.rules', value: [] };
      mockPut.mockResolvedValue({ data: { data: { item } } });
      const data = await adminApi.upsertAlertRules([{ type: 'threshold', metric: 'error_rate' }]);
      expect(mockPut).toHaveBeenCalledWith('/admin/alerts/rules', { rules: [{ type: 'threshold', metric: 'error_rate' }] }, authHeaders);
      expect(data.item.key).toBe('alerts.rules');
    });

    it('setFeatureFlags 應攜帶 flags 與 token', async () => {
      const item = { key: 'feature_flags', value: { newUI: true } };
      mockPut.mockResolvedValue({ data: { data: { item } } });
      const data = await adminApi.setFeatureFlags({ newUI: true });
      expect(mockPut).toHaveBeenCalledWith('/admin/feature-flags', { flags: { newUI: true } }, authHeaders);
      expect(data.item.key).toBe('feature_flags');
    });

    it('listAdminUsers 應攜帶 params 與 token', async () => {
      const adminsData = { items: [{ id: 'a1', email: 'admin@test.com', roleKey: 'super_admin' }], total: 1 };
      mockGet.mockResolvedValue({ data: { data: adminsData } });
      const data = await adminApi.listAdminUsers({ q: 'admin', limit: 10 });
      expect(mockGet).toHaveBeenCalledWith('/admin/admin-users', { params: { q: 'admin', limit: 10 }, ...authHeaders });
      expect(data.items).toHaveLength(1);
      expect(data.items[0].roleKey).toBe('super_admin');
    });

    it('createAdminUser 應攜帶 payload 與 token', async () => {
      const item = { id: 'a2', email: 'new@test.com', roleKey: 'ops', name: 'New Admin' };
      mockPost.mockResolvedValue({ data: { data: { item } } });
      const data = await adminApi.createAdminUser({
        email: 'new@test.com',
        password: 'secret',
        name: 'New Admin',
        roleKey: 'ops',
      });
      expect(mockPost).toHaveBeenCalledWith(
        '/admin/admin-users',
        { email: 'new@test.com', password: 'secret', name: 'New Admin', roleKey: 'ops' },
        authHeaders
      );
      expect(data.item.email).toBe('new@test.com');
    });

    it('updateAdminUser 應攜帶 payload 與 token', async () => {
      const item = { id: 'a1', email: 'a@test.com', roleKey: 'ops', name: 'Updated', isActive: true };
      mockPatch.mockResolvedValue({ data: { data: { item } } });
      const data = await adminApi.updateAdminUser('a1', { name: 'Updated', isActive: true });
      expect(mockPatch).toHaveBeenCalledWith('/admin/admin-users/a1', { name: 'Updated', isActive: true }, authHeaders);
      expect(data.item.name).toBe('Updated');
    });

    it('deleteAdminUser 應攜帶 adminUserId 與 token', async () => {
      const item = { id: 'a1', email: 'old@test.com', roleKey: 'ops' };
      mockDelete.mockResolvedValue({ data: { data: { item } } });
      const data = await adminApi.deleteAdminUser('a1');
      expect(mockDelete).toHaveBeenCalledWith('/admin/admin-users/a1', authHeaders);
      expect(data.item.id).toBe('a1');
    });
  });
});

