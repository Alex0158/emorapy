import type { ApiResponse } from '@/types/common';
import type {
  AdminAdminUserItem,
  AdminAIStreamDetailData,
  AdminAIStreamReportData,
  AdminAIStreamSessionListData,
  AdminAppUserItem,
  AdminAuditLogItem,
  AdminConfigItem,
  AdminMediaProviderCatalogItem,
  AdminMediaProviderGenerationResult,
  AdminMediaProviderTestInput,
  AdminMediaProviderTestResult,
  AdminMediaProviderGenerateImageRequest,
  AdminMediaProviderGenerateVideoRequest,
  AdminMediaProviderCostEstimate,
  AdminCostReportData,
  AdminHealthDetailedData,
  AdminInterviewRuntimeConfigData,
  AdminJobListItem,
  AdminJobStatsData,
  AdminJobStatsMeta,
  AdminJobStatsQuery,
  AdminJobStatsRow,
  AdminListResponse,
  AdminLoginData,
  AdminMeData,
  AdminReportFunnelData,
  AdminReportOverviewData,
  RateBase,
} from '@/types/admin';
import request from '../request';
import { t } from '@/utils/i18n';

const ADMIN_TOKEN_STORAGE_KEY = 'admin_token';
const ADMIN_TOKEN_CHANGED_EVENT = 'admin-token-changed';

function readStorageToken(storage: Storage | undefined): string {
  if (!storage) return '';
  try {
    return (storage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

function removeStorageToken(storage: Storage | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    // noop
  }
}

export function isLikelyAdminJwt(token: string): boolean {
  const normalized = token.trim();
  const parts = normalized.split('.');
  if (parts.length !== 3) return false;
  const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
  return parts.every((part) => part.length > 0 && base64UrlPattern.test(part));
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decoded = atob(normalized);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function isAdminTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token.trim());
  if (!payload) return false;
  const expRaw = payload.exp;
  if (typeof expRaw !== 'number' || !Number.isFinite(expRaw)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expRaw <= nowSeconds;
}

export function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const sessionToken = readStorageToken(window.sessionStorage);
    const localToken = readStorageToken(window.localStorage);
    const token = sessionToken || localToken;
    if (!token) return '';
    if (isAdminTokenExpired(token)) {
      removeStorageToken(window.sessionStorage);
      removeStorageToken(window.localStorage);
      window.dispatchEvent(new Event(ADMIN_TOKEN_CHANGED_EVENT));
      return '';
    }
    if (!sessionToken && localToken) {
      try {
        window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, localToken);
        window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      } catch {
        // noop
      }
    }
    return token;
  } catch {
    return '';
  }
}

export function setAdminToken(token: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const normalized = token.trim();
    if (normalized) {
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, normalized);
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } else {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(ADMIN_TOKEN_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

function hashToken(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function getAdminTokenFingerprint(tokenInput?: string): string {
  const token = (tokenInput ?? getAdminToken()).trim();
  if (!token) return 'missing';
  return `h:${hashToken(token)}`;
}

export function subscribeAdminTokenChanges(
  onStoreChange: () => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleTokenChanged = () => onStoreChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_TOKEN_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener(ADMIN_TOKEN_CHANGED_EVENT, handleTokenChanged);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(ADMIN_TOKEN_CHANGED_EVENT, handleTokenChanged);
    window.removeEventListener('storage', handleStorage);
  };
}

export function getAdminAuthHeaders() {
  const adminToken = getAdminToken().trim();
  if (!isLikelyAdminJwt(adminToken)) return undefined;
  return { Authorization: `Bearer ${adminToken}` };
}

function toNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function normalizeRateBase(value: unknown): RateBase {
  return value === 'completed_runs' ? 'completed_runs' : 'total_runs';
}

function normalizeStatsRow(
  value: Partial<AdminJobStatsRow> | undefined
): AdminJobStatsRow {
  return {
    totalRuns: toNonNegativeNumber(value?.totalRuns),
    successRuns: toNonNegativeNumber(value?.successRuns),
    failedRuns: toNonNegativeNumber(value?.failedRuns),
    runningRuns: toNonNegativeNumber(value?.runningRuns),
    completedRuns: toNonNegativeNumber(value?.completedRuns),
    successRate: toNonNegativeNumber(value?.successRate),
    failureRate: toNonNegativeNumber(value?.failureRate),
    successRateCompleted: toNonNegativeNumber(value?.successRateCompleted),
    failureRateCompleted: toNonNegativeNumber(value?.failureRateCompleted),
  };
}

function normalizeStatsMeta(
  value: Partial<AdminJobStatsMeta> | undefined
): AdminJobStatsMeta {
  return {
    maxRows: toNonNegativeNumber(value?.maxRows, 5000),
    returnedRows: toNonNegativeNumber(value?.returnedRows, 0),
    sampled: Boolean(value?.sampled),
    sampleStrategy: 'latest_runs_desc',
  };
}

export function normalizeAdminJobStatsData(
  input: Partial<AdminJobStatsData> | undefined
): AdminJobStatsData {
  const totals = normalizeStatsRow(input?.totals);
  const avgDurationMsRaw = Number(
    (input?.totals as { avgDurationMs?: unknown } | undefined)?.avgDurationMs
  );

  return {
    days: toNonNegativeNumber(input?.days, 7),
    since:
      typeof input?.since === 'string' && input.since.length > 0
        ? input.since
        : new Date(0).toISOString(),
    totals: {
      ...totals,
      avgDurationMs:
        Number.isFinite(avgDurationMsRaw) && avgDurationMsRaw >= 0
          ? avgDurationMsRaw
          : 0,
    },
    perJob: Array.isArray(input?.perJob)
      ? input.perJob.map((item) => {
          const row = normalizeStatsRow(item);
          const avgDurationMs = toNonNegativeNumber(
            (item as { avgDurationMs?: unknown })?.avgDurationMs
          );
          const totalAffectedCount = toNonNegativeNumber(
            (item as { totalAffectedCount?: unknown })?.totalAffectedCount
          );
          const lastRunAt =
            typeof (item as { lastRunAt?: unknown })?.lastRunAt === 'string'
              ? ((item as { lastRunAt?: string }).lastRunAt ?? '')
              : '';
          return {
            ...row,
            jobKey: typeof item.jobKey === 'string' ? item.jobKey : '',
            avgDurationMs,
            totalAffectedCount,
            lastRunAt,
          };
        })
      : [],
    dailyBuckets: Array.isArray(input?.dailyBuckets)
      ? input.dailyBuckets.map((item) => {
          const row = normalizeStatsRow(item);
          return {
            ...row,
            date: typeof item.date === 'string' ? item.date : '',
          };
        })
      : [],
    rateBase: normalizeRateBase(input?.rateBase),
    statsMeta: normalizeStatsMeta(input?.statsMeta),
  };
}

export function getRateDenominatorLabel(
  rateBase: RateBase
): 'totalRuns' | 'completedRuns' {
  return rateBase === 'completed_runs' ? 'completedRuns' : 'totalRuns';
}

export function shouldShowSampledHint(data: AdminJobStatsData): boolean {
  return data.statsMeta.sampled === true;
}

export const adminApi = {
  async login(payload: {
    email: string;
    password: string;
  }): Promise<AdminLoginData> {
    const response = await request.post<ApiResponse<AdminLoginData>>(
      '/admin/login',
      payload
    );
    const data = (response.data as ApiResponse<AdminLoginData>)?.data;
    if (!data?.token || !data?.admin?.id) {
      throw new Error(t('adminApi.error.invalidAdminLoginResponse'));
    }
    return data;
  },

  async getMe(): Promise<AdminMeData> {
    const response = await request.get<ApiResponse<AdminMeData>>('/admin/me', {
      headers: getAdminAuthHeaders(),
    });
    const payload = (response.data as ApiResponse<AdminMeData>)?.data;
    if (!payload?.admin?.id) {
      throw new Error(t('adminApi.error.invalidAdminMeResponse'));
    }
    return {
      admin: {
        id: payload.admin.id,
        email: payload.admin.email ?? '',
        roleKey: payload.admin.roleKey ?? '',
        permissions: Array.isArray(payload.admin.permissions)
          ? payload.admin.permissions
          : [],
      },
    };
  },

  async getJobStats(query: AdminJobStatsQuery = {}): Promise<AdminJobStatsData> {
    const response = await request.get<ApiResponse<AdminJobStatsData>>(
      '/admin/jobs/stats',
      {
        params: query,
        headers: getAdminAuthHeaders(),
      }
    );
    const payload = (response.data as ApiResponse<AdminJobStatsData>)?.data;
    return normalizeAdminJobStatsData(payload);
  },

  async getHealthDetailed(): Promise<AdminHealthDetailedData> {
    const response = await request.get<ApiResponse<AdminHealthDetailedData>>(
      '/admin/health/detailed',
      {
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminHealthDetailedData>).data;
  },

  async listJobs(): Promise<{ jobs: AdminJobListItem[] }> {
    const response = await request.get<ApiResponse<{ jobs: AdminJobListItem[] }>>(
      '/admin/jobs',
      {
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<{ jobs: AdminJobListItem[] }>).data;
  },

  async triggerJob(
    jobKey: string
  ): Promise<{ jobKey: string; triggeredAt: string; status: string; note: string }> {
    const response = await request.post<
      ApiResponse<{ jobKey: string; triggeredAt: string; status: string; note: string }>
    >(`/admin/jobs/${jobKey}/trigger`, {}, { headers: getAdminAuthHeaders() });
    return (response.data as ApiResponse<{
      jobKey: string;
      triggeredAt: string;
      status: string;
      note: string;
    }>).data;
  },

  async listConfigs(params?: {
    limit?: number;
    offset?: number;
  }): Promise<AdminListResponse<AdminConfigItem>> {
    const response = await request.get<ApiResponse<AdminListResponse<AdminConfigItem>>>(
      '/admin/configs',
      {
        params,
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminListResponse<AdminConfigItem>>).data;
  },

  async upsertConfig(payload: {
    key: string;
    value: unknown;
    description?: string;
    isRuntime?: boolean;
    isSensitive?: boolean;
  }): Promise<{ item: AdminConfigItem; runtime?: { jobsEnabled: boolean } }> {
    const response = await request.put<
      ApiResponse<{ item: AdminConfigItem; runtime?: { jobsEnabled: boolean } }>
    >('/admin/configs', payload, { headers: getAdminAuthHeaders() });
    return (response.data as ApiResponse<{
      item: AdminConfigItem;
      runtime?: { jobsEnabled: boolean };
    }>).data;
  },

  async listUsers(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminListResponse<AdminAppUserItem>> {
    const response = await request.get<ApiResponse<AdminListResponse<AdminAppUserItem>>>(
      '/admin/users',
      {
        params,
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminListResponse<AdminAppUserItem>>).data;
  },

  async getUserDetail(userId: string): Promise<{ user: unknown }> {
    const response = await request.get<ApiResponse<{ user: unknown }>>(
      `/admin/users/${userId}`,
      {
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<{ user: unknown }>).data;
  },

  async updateUserStatus(
    userId: string,
    payload: {
      action: 'lock' | 'unlock' | 'deactivate' | 'activate';
      lockMinutes?: number;
    }
  ): Promise<{ user: AdminAppUserItem }> {
    const response = await request.patch<ApiResponse<{ user: AdminAppUserItem }>>(
      `/admin/users/${userId}/status`,
      payload,
      { headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<{ user: AdminAppUserItem }>).data;
  },

  async listAuditLogs(params?: {
    entityType?: string;
    action?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminListResponse<AdminAuditLogItem>> {
    const response = await request.get<ApiResponse<AdminListResponse<AdminAuditLogItem>>>(
      '/admin/audit-logs',
      {
        params,
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminListResponse<AdminAuditLogItem>>).data;
  },

  async downloadAuditLogsCsv(
    params?: Record<string, string | number | undefined>
  ): Promise<Blob> {
    const response = await request.get<Blob>('/admin/audit-logs.csv', {
      params,
      headers: getAdminAuthHeaders(),
      responseType: 'blob',
    });
    return response.data;
  },

  async getReportOverview(): Promise<AdminReportOverviewData> {
    const response = await request.get<ApiResponse<AdminReportOverviewData>>(
      '/admin/reports/overview',
      {
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminReportOverviewData>).data;
  },

  async getReportFunnel(): Promise<AdminReportFunnelData> {
    const response = await request.get<ApiResponse<AdminReportFunnelData>>(
      '/admin/reports/funnel',
      {
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminReportFunnelData>).data;
  },

  async getReportCosts(): Promise<AdminCostReportData> {
    const response = await request.get<ApiResponse<AdminCostReportData>>(
      '/admin/reports/costs',
      {
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminCostReportData>).data;
  },

  async getReportAIStreams(params?: {
    days?: number;
    limit?: number;
  }): Promise<AdminAIStreamReportData> {
    const response = await request.get<ApiResponse<AdminAIStreamReportData>>(
      '/admin/reports/ai-streams',
      {
        params,
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminAIStreamReportData>).data;
  },

  async listReportAIStreamSessions(params?: {
    days?: number;
    limit?: number;
    offset?: number;
    status?: string;
    scopeType?: string;
    scopeId?: string;
    requestId?: string;
    streamId?: string;
    source?: 'live' | 'archive' | 'all';
  }): Promise<AdminAIStreamSessionListData> {
    const response = await request.get<ApiResponse<AdminAIStreamSessionListData>>(
      '/admin/reports/ai-streams/sessions',
      {
        params,
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminAIStreamSessionListData>).data;
  },

  async getReportAIStreamDetail(
    streamId: string,
    params?: {
      eventLimit?: number;
      source?: 'live' | 'archive' | 'all';
    }
  ): Promise<AdminAIStreamDetailData> {
    const response = await request.get<ApiResponse<AdminAIStreamDetailData>>(
      `/admin/reports/ai-streams/sessions/${streamId}`,
      {
        params,
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminAIStreamDetailData>).data;
  },

  async listMediaProviders(params?: {
    providerType?: 'image' | 'video';
  }): Promise<{ items: AdminMediaProviderCatalogItem[] }> {
    const response = await request.get<ApiResponse<{ items: AdminMediaProviderCatalogItem[] }>>(
      '/providers',
      { params, headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<{ items: AdminMediaProviderCatalogItem[] }>).data;
  },

  async estimateMediaProviderCost(
    providerKey: string,
    payload: {
      count?: number;
      durationSeconds?: number;
      pricingOverride?: {
        billingUnit: 'image' | 'second' | 'frame';
        unitPriceUsd: number;
      };
    }
  ): Promise<AdminMediaProviderCostEstimate> {
    const response = await request.post<ApiResponse<AdminMediaProviderCostEstimate>>(
      `/providers/${providerKey}/estimate`,
      payload,
      { headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<AdminMediaProviderCostEstimate>).data;
  },

  async testMediaProvider(
    providerKey: string,
    payload: AdminMediaProviderTestInput
  ): Promise<AdminMediaProviderTestResult> {
    const response = await request.post<ApiResponse<AdminMediaProviderTestResult>>(
      `/providers/${providerKey}/test`,
      payload,
      { headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<AdminMediaProviderTestResult>).data;
  },

  async generateMediaProviderImage(
    providerKey: string,
    payload: AdminMediaProviderGenerateImageRequest
  ): Promise<AdminMediaProviderGenerationResult> {
    const response = await request.post<ApiResponse<AdminMediaProviderGenerationResult>>(
      `/providers/${providerKey}/images`,
      payload,
      { headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<AdminMediaProviderGenerationResult>).data;
  },

  async generateMediaProviderVideo(
    providerKey: string,
    payload: AdminMediaProviderGenerateVideoRequest
  ): Promise<AdminMediaProviderGenerationResult> {
    const response = await request.post<ApiResponse<AdminMediaProviderGenerationResult>>(
      `/providers/${providerKey}/videos`,
      payload,
      { headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<AdminMediaProviderGenerationResult>).data;
  },

  async getCustomReport(
    metrics: string[]
  ): Promise<{ metrics: Record<string, number> }> {
    const response = await request.post<
      ApiResponse<{ metrics: Record<string, number> }>
    >('/admin/reports/custom', { metrics }, { headers: getAdminAuthHeaders() });
    return (response.data as ApiResponse<{ metrics: Record<string, number> }>).data;
  },

  async downloadReportOverviewCsv(): Promise<Blob> {
    const response = await request.get<Blob>('/admin/reports/overview.csv', {
      headers: getAdminAuthHeaders(),
      responseType: 'blob',
    });
    return response.data;
  },

  async getInterviewRuntimeConfig(): Promise<AdminInterviewRuntimeConfigData> {
    const response = await request.get<ApiResponse<AdminInterviewRuntimeConfigData>>(
      '/admin/runtime/interview',
      {
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminInterviewRuntimeConfigData>).data;
  },

  async upsertAlertRules(rules: unknown[]): Promise<{ item: AdminConfigItem }> {
    const response = await request.put<ApiResponse<{ item: AdminConfigItem }>>(
      '/admin/alerts/rules',
      { rules },
      { headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<{ item: AdminConfigItem }>).data;
  },

  async setFeatureFlags(
    flags: Record<string, unknown>
  ): Promise<{ item: AdminConfigItem }> {
    const response = await request.put<ApiResponse<{ item: AdminConfigItem }>>(
      '/admin/feature-flags',
      { flags },
      { headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<{ item: AdminConfigItem }>).data;
  },

  async listAdminUsers(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminListResponse<AdminAdminUserItem>> {
    const response = await request.get<ApiResponse<AdminListResponse<AdminAdminUserItem>>>(
      '/admin/admin-users',
      {
        params,
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<AdminListResponse<AdminAdminUserItem>>).data;
  },

  async createAdminUser(payload: {
    email: string;
    password: string;
    name: string;
    roleKey: 'super_admin' | 'ops' | 'marketing' | 'support';
  }): Promise<{ item: AdminAdminUserItem }> {
    const response = await request.post<ApiResponse<{ item: AdminAdminUserItem }>>(
      '/admin/admin-users',
      payload,
      {
        headers: getAdminAuthHeaders(),
      }
    );
    return (response.data as ApiResponse<{ item: AdminAdminUserItem }>).data;
  },

  async updateAdminUser(
    adminUserId: string,
    payload: {
      name?: string;
      roleKey?: 'super_admin' | 'ops' | 'marketing' | 'support';
      isActive?: boolean;
      password?: string;
    }
  ): Promise<{ item: AdminAdminUserItem }> {
    const response = await request.patch<ApiResponse<{ item: AdminAdminUserItem }>>(
      `/admin/admin-users/${adminUserId}`,
      payload,
      { headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<{ item: AdminAdminUserItem }>).data;
  },

  async deleteAdminUser(adminUserId: string): Promise<{ item: AdminAdminUserItem }> {
    const response = await request.delete<ApiResponse<{ item: AdminAdminUserItem }>>(
      `/admin/admin-users/${adminUserId}`,
      { headers: getAdminAuthHeaders() }
    );
    return (response.data as ApiResponse<{ item: AdminAdminUserItem }>).data;
  },
};
