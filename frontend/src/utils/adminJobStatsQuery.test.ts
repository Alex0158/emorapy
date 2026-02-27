/**
 * Admin Job Stats 查詢參數工具測試
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_JOB_STATS_QUERY,
  normalizeAdminJobStatsQuery,
  normalizeAdminJobStatsQueryWithDefaults,
  updateAdminJobStatsDays,
  updateAdminJobStatsIncludeRunning,
  updateAdminJobStatsMaxRows,
} from './adminJobStatsQuery';

describe('adminJobStatsQuery', () => {
  it('normalizeAdminJobStatsQuery 應保留合法值', () => {
    expect(
      normalizeAdminJobStatsQuery({
        days: 30,
        includeRunning: false,
        maxRows: 5000,
      })
    ).toEqual({
      days: 30,
      includeRunning: false,
      maxRows: 5000,
    });
  });

  it('normalizeAdminJobStatsQuery 應修正越界與非法值', () => {
    expect(
      normalizeAdminJobStatsQuery({
        days: -10,
        includeRunning: true,
        maxRows: 999999,
      })
    ).toEqual({
      days: 1,
      includeRunning: true,
      maxRows: 20000,
    });

    expect(
      normalizeAdminJobStatsQuery({
        days: Number.NaN,
        includeRunning: undefined,
        maxRows: Number.POSITIVE_INFINITY,
      })
    ).toEqual({});
  });

  it('normalizeAdminJobStatsQueryWithDefaults 應回填預設值', () => {
    expect(normalizeAdminJobStatsQueryWithDefaults({})).toEqual(
      DEFAULT_ADMIN_JOB_STATS_QUERY
    );
    expect(
      normalizeAdminJobStatsQueryWithDefaults({
        days: 1000,
        includeRunning: false,
      })
    ).toEqual({
      days: 90,
      includeRunning: false,
      maxRows: DEFAULT_ADMIN_JOB_STATS_QUERY.maxRows,
    });
  });

  it('update helpers 應維持查詢邊界與預設值', () => {
    const base = DEFAULT_ADMIN_JOB_STATS_QUERY;
    expect(updateAdminJobStatsDays(base, 999)).toEqual({
      ...base,
      days: 90,
    });
    expect(updateAdminJobStatsDays(base, null)).toEqual(base);

    expect(updateAdminJobStatsMaxRows(base, 50)).toEqual({
      ...base,
      maxRows: 100,
    });
    expect(updateAdminJobStatsMaxRows(base, undefined)).toEqual(base);

    expect(updateAdminJobStatsIncludeRunning(base, false)).toEqual({
      ...base,
      includeRunning: false,
    });
    expect(updateAdminJobStatsIncludeRunning(base, 'not-boolean')).toEqual({
      ...base,
      includeRunning: true,
    });
  });
});
