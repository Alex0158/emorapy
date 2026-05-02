import { expect, type Page } from '@playwright/test';

function isStrictE2E(): boolean {
  return process.env.E2E_STRICT === 'true';
}

function resolveEnv(name: string): string {
  return process.env[name]?.trim() || '';
}

export function requireE2EAdminCreds(): {
  email: string;
  password: string;
} | null {
  const email = resolveEnv('E2E_ADMIN_EMAIL');
  const password = resolveEnv('E2E_ADMIN_PASSWORD');
  if (!email || !password) {
    if (isStrictE2E()) {
      throw new Error('E2E_STRICT=true 時必須提供 E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD');
    }
    return null;
  }
  return { email, password };
}

export function requireE2ELimitedCreds(): {
  email: string;
  password: string;
} | null {
  const email = resolveEnv('E2E_LIMITED_ADMIN_EMAIL');
  const password = resolveEnv('E2E_LIMITED_ADMIN_PASSWORD');
  if (!email || !password) {
    if (isStrictE2E()) {
      throw new Error(
        'E2E_STRICT=true 時必須提供 E2E_LIMITED_ADMIN_EMAIL/E2E_LIMITED_ADMIN_PASSWORD'
      );
    }
    return null;
  }
  return { email, password };
}

export async function loginAsAdmin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/admin/login');
  await page.locator('input#email').fill(email);
  await page.locator('input#password').fill(password);
  await page.getByRole('button', { name: /sign in|登入後台/i }).click();
  await expect(page).toHaveURL(/\/admin\/ops\/jobs/);
}

export function permissionDeniedLocator(page: Page) {
  return page.getByText(/權限不足|does not have permission|lacks required permissions|missing permissions/i);
}

export async function expectNoPermissionDenied(page: Page): Promise<void> {
  await expect(permissionDeniedLocator(page)).toHaveCount(0);
}

export async function expectPermissionDenied(page: Page): Promise<void> {
  await expect(permissionDeniedLocator(page)).toBeVisible();
}

export interface AuditLogEntry {
  actor_id?: string | null;
  entity_type?: string;
  entity_id?: string;
  action?: string;
  detail?: Record<string, unknown>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForAuditEntry(params: {
  page: Page;
  token: string;
  query?: Record<string, string | number | undefined>;
  matcher: (item: AuditLogEntry) => boolean;
  attempts?: number;
  intervalMs?: number;
}): Promise<AuditLogEntry | null> {
  const {
    page,
    token,
    query,
    matcher,
    attempts = 6,
    intervalMs = 500,
  } = params;

  for (let i = 0; i < attempts; i += 1) {
    const response = await page.request.get('/api/v1/admin/audit-logs', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        limit: 100,
        offset: 0,
        ...query,
      },
    });
    if (response.ok()) {
      const payload = (await response.json()) as {
        data?: { items?: AuditLogEntry[] };
      };
      const matched = (payload.data?.items || []).find((item) => matcher(item));
      if (matched) return matched;
    }
    if (i < attempts - 1) {
      await delay(intervalMs);
    }
  }

  return null;
}
