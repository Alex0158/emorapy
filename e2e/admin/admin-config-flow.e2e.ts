import { test, expect } from '@playwright/test';
import { expectNoPermissionDenied, loginAsAdmin, requireE2EAdminCreds } from './helpers';

const adminCreds = requireE2EAdminCreds();

test.describe('Admin config flow', () => {
  test.skip(!adminCreds, '需要設定 E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD');

  test('配置讀寫流程：feature-flags 寫入後可讀', async ({ page }) => {
    if (!adminCreds) {
      test.skip();
      return;
    }

    await loginAsAdmin(page, adminCreds.email, adminCreds.password);
    await page.goto('/admin/configs');
    await expect(page).toHaveURL(/\/admin\/configs/);
    await expect(page.getByText(/配置管理|config management/i)).toBeVisible();
    await expectNoPermissionDenied(page);

    const adminToken = await page.evaluate(() => {
      return window.sessionStorage.getItem('admin_token') || window.localStorage.getItem('admin_token') || '';
    });
    expect(adminToken).toBeTruthy();

    const flagKey = `e2e_config_flag_${Date.now()}`;
    const upsertFlagsResponse = await page.request.put('/api/v1/admin/feature-flags', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        flags: {
          [flagKey]: true,
        },
      },
    });
    expect(upsertFlagsResponse.ok()).toBeTruthy();

    const listConfigsResponse = await page.request.get('/api/v1/admin/configs', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        limit: 100,
        offset: 0,
      },
    });
    expect(listConfigsResponse.ok()).toBeTruthy();
    const listConfigsPayload = (await listConfigsResponse.json()) as {
      data?: { items?: Array<{ key?: string; value?: Record<string, unknown> }> };
    };
    const featureFlagsConfig = (listConfigsPayload.data?.items || []).find(
      (item) => item.key === 'feature.flags'
    );
    expect(featureFlagsConfig).toBeTruthy();
    expect((featureFlagsConfig?.value || {})[flagKey]).toBe(true);
  });
});
