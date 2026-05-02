import { test, expect } from '@playwright/test';
import { expectNoPermissionDenied, loginAsAdmin, requireE2EAdminCreds } from './helpers';

const adminCreds = requireE2EAdminCreds();

test.describe('Admin jobs flow', () => {
  test.skip(!adminCreds, '需要設定 E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD');

  test('任務流程：list/trigger/stats 可用', async ({ page }) => {
    if (!adminCreds) {
      test.skip();
      return;
    }

    await loginAsAdmin(page, adminCreds.email, adminCreds.password);

    await page.goto('/admin/jobs');
    await expect(page).toHaveURL(/\/admin\/jobs/);
    await expect(page.getByRole('heading', { name: /任務管理|job management/i })).toBeVisible();
    await expectNoPermissionDenied(page);

    const adminToken = await page.evaluate(() => {
      return window.sessionStorage.getItem('admin_token') || window.localStorage.getItem('admin_token') || '';
    });
    expect(adminToken).toBeTruthy();

    const listJobsResponse = await page.request.get('/api/v1/admin/jobs', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(listJobsResponse.ok()).toBeTruthy();
    const listJobsPayload = (await listJobsResponse.json()) as {
      data?: { jobs?: Array<{ key?: string }> };
    };
    const firstJobKey = listJobsPayload.data?.jobs?.[0]?.key || '';
    expect(firstJobKey).toBeTruthy();

    const triggerJobResponse = await page.request.post(`/api/v1/admin/jobs/${firstJobKey}/trigger`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(triggerJobResponse.ok()).toBeTruthy();

    const getStatsResponse = await page.request.get('/api/v1/admin/jobs/stats', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        days: 7,
        includeRunning: true,
        maxRows: 100,
      },
    });
    expect(getStatsResponse.ok()).toBeTruthy();
    const statsPayload = (await getStatsResponse.json()) as {
      data?: {
        totals?: { totalRuns?: number };
        perJob?: unknown[];
        dailyBuckets?: unknown[];
        rateBase?: string;
      };
    };
    expect(typeof statsPayload.data?.totals?.totalRuns).toBe('number');
    expect(Array.isArray(statsPayload.data?.perJob)).toBe(true);
    expect(Array.isArray(statsPayload.data?.dailyBuckets)).toBe(true);
    expect(['total_runs', 'completed_runs']).toContain(statsPayload.data?.rateBase);
  });
});
