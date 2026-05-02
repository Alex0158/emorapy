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

export interface AdminInterviewRuntimeConfigValues {
  maxTurns: number;
  softTarget: number;
  turnIntervalMs: number;
  startRateLimit: number;
  dailySessionLimit: number;
}

export interface AdminInterviewRuntimeConfigData {
  defaults: AdminInterviewRuntimeConfigValues;
  runtime: AdminInterviewRuntimeConfigValues;
  source: 'system_config_override_then_env_fallback';
}
