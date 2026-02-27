import { test, expect } from '@playwright/test';
import { expectNoPermissionDenied, loginAsAdmin, requireE2EAdminCreds } from './helpers';

const adminCreds = requireE2EAdminCreds();

test.describe('Admin reports flow', () => {
  test.skip(!adminCreds, '需要設定 E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD');

  test('報表流程：overview/funnel/custom/csv 可用', async ({ page }) => {
    if (!adminCreds) {
      test.skip();
      return;
    }

    await loginAsAdmin(page, adminCreds.email, adminCreds.password);
    await page.goto('/admin/reports');
    await expect(page).toHaveURL(/\/admin\/reports/);
    await expect(page.getByText(/報表|reports/i)).toBeVisible();
    await expectNoPermissionDenied(page);

    const adminToken = await page.evaluate(() => {
      return window.sessionStorage.getItem('admin_token') || window.localStorage.getItem('admin_token') || '';
    });
    expect(adminToken).toBeTruthy();

    const overviewResponse = await page.request.get('/api/v1/admin/reports/overview', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(overviewResponse.ok()).toBeTruthy();
    const overviewPayload = (await overviewResponse.json()) as {
      data?: Record<string, number>;
    };
    expect(overviewPayload.data).toBeTruthy();

    const funnelResponse = await page.request.get('/api/v1/admin/reports/funnel', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(funnelResponse.ok()).toBeTruthy();

    const customResponse = await page.request.post('/api/v1/admin/reports/custom', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        metrics: ['dau', 'mau', 'judgment_failed'],
      },
    });
    expect(customResponse.ok()).toBeTruthy();
    const customPayload = (await customResponse.json()) as {
      data?: { metrics?: Record<string, number> };
    };
    expect(typeof customPayload.data?.metrics?.dau).toBe('number');
    expect(typeof customPayload.data?.metrics?.mau).toBe('number');
    expect(typeof customPayload.data?.metrics?.judgment_failed).toBe('number');

    const overviewCsvResponse = await page.request.get('/api/v1/admin/reports/overview.csv', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(overviewCsvResponse.ok()).toBeTruthy();
    const contentType = overviewCsvResponse.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('text/csv');
  });
});
