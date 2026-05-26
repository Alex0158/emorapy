import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/',
  '/quick-experience/create',
  '/quick-experience/collaborative',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/chat/room',
] as const;

const AUTHENTICATED_ROUTES = [
  '/case/list',
  '/notifications',
  '/profile/index',
] as const;

const AUTH_USER = {
  id: 'user-a11y-smoke',
  email: 'a11y@example.com',
  nickname: 'A11Y Smoke',
  email_verified: true,
  notification_enabled: true,
};

const CASE_FIXTURE = {
  id: 'case-a11y-smoke',
  pairing_id: 'pairing-a11y-smoke',
  title: 'A11Y smoke relationship repair case',
  type: '生活習慣衝突',
  plaintiff_statement: 'We keep arguing about daily routines and need a concrete repair path.',
  defendant_statement: 'I want to explain my constraints while staying committed to repair.',
  status: 'completed',
  mode: 'collaborative',
  created_at: '2026-05-11T10:00:00.000Z',
  updated_at: '2026-05-11T10:05:00.000Z',
  completed_at: '2026-05-11T10:10:00.000Z',
  judgment: {
    id: 'judgment-a11y-smoke',
    summary: 'A concise relationship analysis summary.',
  },
};

const NOTIFICATION_FIXTURE = {
  id: 'notification-a11y-smoke',
  channel: 'push',
  template_code: 'repair_journey.partner_waiting',
  action_key: 'open_case',
  priority: 'now',
  group_key: 'case-a11y-smoke',
  status: 'sent',
  error_message: null,
  created_at: '2026-05-11T10:15:00.000Z',
  sent_at: '2026-05-11T10:15:01.000Z',
  read_at: null,
  dismissed_at: null,
  acted_at: null,
  snoozed_until: null,
  unread: true,
  actionable: true,
  payload: {},
  journey_context: {
    entry_path: '/case/case-a11y-smoke',
    presentation_bucket: 'partner_waiting',
    primary_cta: { label: '查看案件', path: '/case/case-a11y-smoke' },
  },
  render_payload: {
    title: '需要重新調整溝通節奏',
    body: '對方已回覆，請查看案件並確認下一步。',
    path: '/case/case-a11y-smoke',
    cta_label: '查看案件',
    entity_type: 'case',
    entity_id: 'case-a11y-smoke',
    journey_status: '等待確認',
    track_id: null,
    plan_id: null,
    judgment_id: 'judgment-a11y-smoke',
    case_id: 'case-a11y-smoke',
    priority: 'now',
    partner_state: 'waiting',
    reason_code: 'partner_waiting',
  },
};

async function stubPublicRouteApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    if (method === 'GET' && pathname === '/api/v1/cases/by-session') {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/content-items') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [] } }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/chat/rooms') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { rooms: [] } }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function seedAuthenticatedUser(page: import('@playwright/test').Page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem('token', 'token-a11y-smoke');
    window.localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: { user },
        version: 0,
      })
    );
  }, AUTH_USER);
}

async function stubAuthenticatedRouteApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    if (method === 'GET' && pathname === '/api/v1/user/profile') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { user: AUTH_USER } }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/cases') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            cases: [CASE_FIXTURE],
            pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
          },
        }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/notifications') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { notifications: [NOTIFICATION_FIXTURE], next_cursor: null, has_more: false },
        }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/notifications/unread-count') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { unread_count: 1 } }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/psych-profile') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            consent_given: false,
            richness_score: 0,
            narratives: [],
            feedback_status: null,
          },
        }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/interview/resume') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function stubAuthenticatedErrorApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    if (method === 'GET' && pathname === '/api/v1/user/profile') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { user: AUTH_USER } }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/cases') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'A11Y load failure' } }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/notifications') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'A11Y notification failure' } }),
      });
    }

    if (method === 'GET' && pathname === '/api/v1/notifications/unread-count') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { unread_count: 0 } }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function assertNoAxeViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
}

test.describe('public route accessibility smoke', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} has no automated axe violations`, async ({ page }) => {
      await stubPublicRouteApi(page);

      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('body').waitFor({ state: 'visible' });

      await assertNoAxeViolations(page);
    });
  }
});

test.describe('authenticated route accessibility smoke', () => {
  for (const route of AUTHENTICATED_ROUTES) {
    test(`${route} has no automated axe violations`, async ({ page }) => {
      await seedAuthenticatedUser(page);
      await stubAuthenticatedRouteApi(page);

      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('body').waitFor({ state: 'visible' });

      await assertNoAxeViolations(page);
    });
  }
});

test.describe('authenticated route accessibility state matrix', () => {
  test('/case/list data state has no automated axe violations', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await stubAuthenticatedRouteApi(page);

    await page.goto('/case/list', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /A11Y smoke relationship repair case/ })).toBeVisible();

    await assertNoAxeViolations(page);
  });

  test('/case/list error state has no automated axe violations', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await stubAuthenticatedErrorApi(page);

    await page.goto('/case/list', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('A11Y load failure')).toBeVisible();
    await expect(page.getByTestId('case-list-load-retry')).toBeVisible();

    await assertNoAxeViolations(page);
  });

  test('/notifications data state has no automated axe violations', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await stubAuthenticatedRouteApi(page);

    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /需要重新調整溝通節奏/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '查看案件', exact: true })).toBeVisible();

    await assertNoAxeViolations(page);
  });

  test('/notifications error state has no automated axe violations', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await stubAuthenticatedErrorApi(page);

    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('A11Y notification failure')).toBeVisible();
    await expect(page.getByRole('button', { name: /重試|Retry/ })).toBeVisible();

    await assertNoAxeViolations(page);
  });
});
