import type { AdminJobStatsQuery } from '@/types/admin';

const MIN_DAYS = 1;
const MAX_DAYS = 90;
const MIN_MAX_ROWS = 100;
const MAX_MAX_ROWS = 20000;

export const DEFAULT_ADMIN_JOB_STATS_QUERY: Required<AdminJobStatsQuery> = {
  days: 7,
  includeRunning: true,
  maxRows: 5000,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeOptionalNumber(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return clamp(Math.trunc(value), min, max);
}

export function normalizeAdminJobStatsQuery(
  query: AdminJobStatsQuery = {}
): AdminJobStatsQuery {
  const days = normalizeOptionalNumber(query.days, MIN_DAYS, MAX_DAYS);
  const maxRows = normalizeOptionalNumber(query.maxRows, MIN_MAX_ROWS, MAX_MAX_ROWS);
  const includeRunning =
    typeof query.includeRunning === 'boolean' ? query.includeRunning : undefined;

  return {
    ...(days === undefined ? {} : { days }),
    ...(includeRunning === undefined ? {} : { includeRunning }),
    ...(maxRows === undefined ? {} : { maxRows }),
  };
}

export function normalizeAdminJobStatsQueryWithDefaults(
  query: AdminJobStatsQuery = {}
): Required<AdminJobStatsQuery> {
  const normalized = normalizeAdminJobStatsQuery(query);
  return {
    days: normalized.days ?? DEFAULT_ADMIN_JOB_STATS_QUERY.days,
    includeRunning:
      normalized.includeRunning ?? DEFAULT_ADMIN_JOB_STATS_QUERY.includeRunning,
    maxRows: normalized.maxRows ?? DEFAULT_ADMIN_JOB_STATS_QUERY.maxRows,
  };
}

export function updateAdminJobStatsDays(
  query: Required<AdminJobStatsQuery>,
  value: unknown
): Required<AdminJobStatsQuery> {
  return normalizeAdminJobStatsQueryWithDefaults({
    ...query,
    days: typeof value === 'number' ? value : DEFAULT_ADMIN_JOB_STATS_QUERY.days,
  });
}

export function updateAdminJobStatsMaxRows(
  query: Required<AdminJobStatsQuery>,
  value: unknown
): Required<AdminJobStatsQuery> {
  return normalizeAdminJobStatsQueryWithDefaults({
    ...query,
    maxRows:
      typeof value === 'number' ? value : DEFAULT_ADMIN_JOB_STATS_QUERY.maxRows,
  });
}

export function updateAdminJobStatsIncludeRunning(
  query: Required<AdminJobStatsQuery>,
  value: unknown
): Required<AdminJobStatsQuery> {
  return normalizeAdminJobStatsQueryWithDefaults({
    ...query,
    includeRunning: value !== false,
  });
}
