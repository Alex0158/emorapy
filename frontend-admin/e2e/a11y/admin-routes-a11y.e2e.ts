import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ADMIN_TOKEN = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.sig';

const ADMIN_USER = {
  id: 'admin-a11y-smoke',
  email: 'admin-a11y@example.com',
  roleKey: 'super_admin',
  permissions: ['admin:all'],
};

const LIMITED_ADMIN_USER = {
  id: 'admin-a11y-limited',
  email: 'limited-a11y@example.com',
  roleKey: 'support',
  permissions: ['users:read'],
};

const OPS_STATS_FIXTURE = {
  days: 7,
  since: '2026-05-01T00:00:00.000Z',
  rateBase: 'total_runs',
  totals: {
    totalRuns: 12,
    successRuns: 9,
    failedRuns: 2,
    runningRuns: 1,
    completedRuns: 11,
    successRate: 0.75,
    failureRate: 0.1667,
    successRateCompleted: 0.8182,
    failureRateCompleted: 0.1818,
    avgDurationMs: 2400,
  },
  perJob: [
    {
      jobKey: 'repair_journey_digest',
      totalRuns: 12,
      successRuns: 9,
      failedRuns: 2,
      runningRuns: 1,
      completedRuns: 11,
      successRate: 0.75,
      failureRate: 0.1667,
      successRateCompleted: 0.8182,
      failureRateCompleted: 0.1818,
      avgDurationMs: 2400,
      totalAffectedCount: 36,
      lastRunAt: '2026-05-11T10:00:00.000Z',
    },
  ],
  dailyBuckets: [],
  statsMeta: {
    maxRows: 5000,
    returnedRows: 1,
    sampled: true,
    sampleStrategy: 'latest_runs_desc',
  },
};

async function assertNoAxeViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
}

async function seedAdminToken(page: import('@playwright/test').Page) {
  await page.addInitScript((token) => {
    window.sessionStorage.setItem('admin_token', token);
  }, ADMIN_TOKEN);
}

async function stubAdminApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    if (method === 'GET' && pathname === '/api/v1/admin/me') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { admin: ADMIN_USER } }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/admin/jobs/stats') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: OPS_STATS_FIXTURE }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function stubLimitedAdminApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    if (method === 'GET' && pathname === '/api/v1/admin/me') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { admin: LIMITED_ADMIN_USER } }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function stubAdminErrorApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    if (method === 'GET' && pathname === '/api/v1/admin/me') {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

test.describe('admin route accessibility smoke', () => {
  test('/admin/login has no automated axe violations', async ({ page }) => {
    await stubAdminApi(page);

    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ state: 'visible' });

    await assertNoAxeViolations(page);
  });

  test('/admin/ops/jobs has no automated axe violations', async ({ page }) => {
    await seedAdminToken(page);
    await stubAdminApi(page);

    await page.goto('/admin/ops/jobs', { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ state: 'visible' });
    await expect(page.getByRole('main')).toBeVisible();

    await assertNoAxeViolations(page);
  });

  test('/admin/ops/jobs data and sampled state has no automated axe violations', async ({ page }) => {
    await seedAdminToken(page);
    await stubAdminApi(page);

    await page.goto('/admin/ops/jobs', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('repair_journey_digest')).toBeVisible();
    await expect(page.getByText(/資料量過大|sampled/i)).toBeVisible();

    await assertNoAxeViolations(page);
  });

  test('/admin/ops/jobs access denied state has no automated axe violations', async ({ page }) => {
    await seedAdminToken(page);
    await stubLimitedAdminApi(page);

    await page.goto('/admin/ops/jobs', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/缺少權限|Missing permissions/)).toBeVisible();

    await assertNoAxeViolations(page);
  });

  test('/admin/ops/jobs forbidden error state has no automated axe violations', async ({ page }) => {
    await seedAdminToken(page);
    await stubAdminErrorApi(page);

    await page.goto('/admin/ops/jobs', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/權限不足|Access denied/)).toBeVisible();

    await assertNoAxeViolations(page);
  });
});
