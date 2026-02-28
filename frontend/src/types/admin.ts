/**
 * 管理員後台（運維）相關類型
 */

export type RateBase = 'total_runs' | 'completed_runs';

export interface AdminJobStatsQuery {
  days?: number;
  includeRunning?: boolean;
  maxRows?: number;
}

export interface AdminJobStatsRow {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  runningRuns: number;
  completedRuns: number;
  successRate: number;
  failureRate: number;
  successRateCompleted: number;
  failureRateCompleted: number;
}

export interface AdminJobStatsTotals extends AdminJobStatsRow {
  avgDurationMs: number;
}

export interface AdminJobStatsPerJob extends AdminJobStatsRow {
  jobKey: string;
  avgDurationMs: number;
  totalAffectedCount: number;
  lastRunAt: string;
}

export interface AdminJobStatsDailyBucket extends AdminJobStatsRow {
  date: string;
}

export interface AdminJobStatsMeta {
  maxRows: number;
  returnedRows: number;
  sampled: boolean;
  sampleStrategy: 'latest_runs_desc';
}

export interface AdminJobStatsData {
  days: number;
  since: string;
  totals: AdminJobStatsTotals;
  perJob: AdminJobStatsPerJob[];
  dailyBuckets: AdminJobStatsDailyBucket[];
  rateBase: RateBase;
  statsMeta: AdminJobStatsMeta;
}

export interface AdminIdentity {
  id: string;
  email: string;
  roleKey: string;
  permissions: string[];
}

export interface AdminMeData {
  admin: AdminIdentity;
}

export interface AdminLoginData {
  token: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
  };
}

export interface AdminHealthDetailedData {
  status: string;
  timestamp: string;
  cronStarted: boolean;
  activeJobCount: number;
  adminCount: number;
  userCount: number;
  performance: Record<string, unknown>;
  env: {
    nodeEnv: string;
    scheduledJobsEnabled: boolean;
  };
}

export interface AdminJobListItem {
  key: string;
  schedule: string;
  running: boolean;
  latestRun: {
    id: string;
    status: string;
    started_at: string;
    finished_at?: string | null;
    duration_ms?: number | null;
    affected_count?: number | null;
  } | null;
}

export interface AdminConfigItem {
  id: string;
  key: string;
  value: unknown;
  description?: string | null;
  is_sensitive: boolean;
  is_runtime: boolean;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminAppUserItem {
  id: string;
  email: string;
  nickname?: string | null;
  is_active: boolean;
  email_verified: boolean;
  login_failed_attempts: number;
  locked_until?: string | null;
  created_at: string;
  last_login_at?: string | null;
  deleted_at?: string | null;
}

export interface AdminAuditLogItem {
  id: string;
  actor_id?: string | null;
  actor_type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  detail?: unknown;
  created_at: string;
}

export interface AdminReportOverviewData {
  totals: {
    users: number;
    activePairings: number;
    cases: number;
    judgments: number;
    reconciliationPlans: number;
    executionCompleted: number;
    interviewCompleted: number;
  };
  conversion: {
    pairingRate: number;
    caseCreationRate: number;
    judgmentCompletionRate: number;
    caseCompletionRate: number;
  };
}

export interface AdminReportFunnelData {
  stages: Array<{
    key: string;
    count: number;
  }>;
}

export interface AdminCostDailyPoint {
  date: string;
  value: number;
}

export interface AdminCostReportData {
  generatedAt: string;
  currency: 'USD';
  partial: boolean;
  reasons: string[];
  summary: {
    redisMemoryMb: number;
    redisTotalKeys: number;
    railwayEgressGb24h: number;
    railwayEgressGb7d: number;
    openaiCostUsd24h: number;
    openaiCostUsd7d: number;
    openaiInputTokens24h: number;
    openaiOutputTokens24h: number;
  };
  redis: {
    status: 'ok' | 'partial' | 'unavailable';
    memoryUsedBytes: number;
    connectedClients: number;
    totalKeys: number;
  };
  railway: {
    status: 'ok' | 'partial' | 'unavailable';
    egressGb24h: number;
    egressGb7d: number;
    dailyEgressGb: AdminCostDailyPoint[];
    note?: string;
  };
  openai: {
    status: 'ok' | 'partial' | 'unavailable';
    costUsd24h: number;
    costUsd7d: number;
    inputTokens24h: number;
    outputTokens24h: number;
    dailyCostUsd: AdminCostDailyPoint[];
    note?: string;
  };
}

export interface AdminInterviewRuntimeConfigData {
  defaults: Record<string, number>;
  runtime: Record<string, number>;
  source: string;
}

export interface AdminAdminUserItem {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  last_login_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  role: {
    key: string;
    name: string;
    permissions: unknown;
  };
}
