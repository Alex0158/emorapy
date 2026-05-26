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
  it('normalizes only valid bounded query values', () => {
    expect(
      normalizeAdminJobStatsQuery({
        days: 120,
        includeRunning: false,
        maxRows: 50,
      })
    ).toEqual({
      days: 90,
      includeRunning: false,
      maxRows: 100,
    });

    expect(
      normalizeAdminJobStatsQuery({
        days: Number.NaN,
        includeRunning: 'yes' as unknown as boolean,
        maxRows: Infinity,
      })
    ).toEqual({});
  });

  it('applies defaults after normalization', () => {
    expect(normalizeAdminJobStatsQueryWithDefaults()).toEqual(
      DEFAULT_ADMIN_JOB_STATS_QUERY
    );
    expect(normalizeAdminJobStatsQueryWithDefaults({ days: 3 })).toEqual({
      ...DEFAULT_ADMIN_JOB_STATS_QUERY,
      days: 3,
    });
  });

  it('updates individual controls through the same bounds', () => {
    expect(updateAdminJobStatsDays(DEFAULT_ADMIN_JOB_STATS_QUERY, 0).days).toBe(1);
    expect(updateAdminJobStatsMaxRows(DEFAULT_ADMIN_JOB_STATS_QUERY, 30_000).maxRows).toBe(20_000);
    expect(
      updateAdminJobStatsIncludeRunning(DEFAULT_ADMIN_JOB_STATS_QUERY, false)
        .includeRunning
    ).toBe(false);
  });
});
