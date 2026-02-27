/**
 * Admin 權限拒絕 E2E（Playwright）
 */

import { test, expect } from '@playwright/test';
import {
  requireE2EAdminCreds,
  expectNoPermissionDenied,
  expectPermissionDenied,
  loginAsAdmin,
  requireE2ELimitedCreds,
} from './helpers';

const limitedCreds = requireE2ELimitedCreds();
const adminCreds = requireE2EAdminCreds();

test.describe('Admin permission denied flow', () => {
  test.skip(!limitedCreds, '需要設定低權限帳號環境變數');

  test('低權限帳號可進一般頁，但高敏頁被拒絕（mixed-tighten）', async ({ page }) => {
    if (!limitedCreds) {
      test.skip();
      return;
    }
    await loginAsAdmin(page, limitedCreds.email, limitedCreds.password);
    await expect(page).toHaveURL(/\/admin\/ops\/jobs/);
    await expectNoPermissionDenied(page);

    // support 角色應可讀 users（users:read）
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/admin\/users/);
    await expectNoPermissionDenied(page);
    await expect(page.getByPlaceholder(/email|nickname|ID/i)).toBeVisible();

    // audit-logs 要求 users:read + ops:read（all），support 應被拒絕
    await page.goto('/admin/audit-logs');
    await expect(page).toHaveURL(/\/admin\/audit-logs/);
    await expectPermissionDenied(page);
    await expect(page.getByRole('button', { name: /csv/i })).toHaveCount(0);

    await page.goto('/admin/settings');
    await expectPermissionDenied(page);

    // API 層負向驗證：低權限 token 不可直接建立管理員（必須 403）。
    const limitedToken = await page.evaluate(() => {
      return window.sessionStorage.getItem('admin_token') || window.localStorage.getItem('admin_token') || '';
    });
    expect(limitedToken).toBeTruthy();

    const forbiddenEmail = `forbidden-e2e-${Date.now()}@example.com`;
    const forbiddenCreateResponse = await page.request.post('/api/v1/admin/admin-users', {
      headers: {
        Authorization: `Bearer ${limitedToken}`,
      },
      data: {
        email: forbiddenEmail,
        password: 'AdminPass1234',
        name: 'Forbidden E2E',
        roleKey: 'ops',
      },
    });
    expect(forbiddenCreateResponse.status()).toBe(403);
    const forbiddenCreatePayload = (await forbiddenCreateResponse.json()) as {
      error?: { code?: string };
    };
    expect(forbiddenCreatePayload.error?.code).toBe('FORBIDDEN');

    const forbiddenAuditResponse = await page.request.get('/api/v1/admin/audit-logs', {
      headers: {
        Authorization: `Bearer ${limitedToken}`,
      },
      params: {
        limit: 20,
        offset: 0,
      },
    });
    expect(forbiddenAuditResponse.status()).toBe(403);

    // 被拒絕請求不可留下可登入帳號（防止僅擋授權但仍落資料）。
    const forbiddenLoginResponse = await page.request.post('/api/v1/admin/login', {
      data: {
        email: forbiddenEmail,
        password: 'AdminPass1234',
      },
    });
    expect(forbiddenLoginResponse.status()).toBe(401);
  });

  test('低權限被拒操作不應產生成功型審計紀錄', async ({ page }) => {
    if (!limitedCreds || !adminCreds) {
      test.skip();
      return;
    }

    await loginAsAdmin(page, limitedCreds.email, limitedCreds.password);
    await expect(page).toHaveURL(/\/admin\/ops\/jobs/);

    const limitedToken = await page.evaluate(() => {
      return window.sessionStorage.getItem('admin_token') || window.localStorage.getItem('admin_token') || '';
    });
    expect(limitedToken).toBeTruthy();

    const forbiddenEmail = `forbidden-audit-${Date.now()}@example.com`;
    const forbiddenCreateResponse = await page.request.post('/api/v1/admin/admin-users', {
      headers: {
        Authorization: `Bearer ${limitedToken}`,
      },
      data: {
        email: forbiddenEmail,
        password: 'AdminPass1234',
        name: 'Forbidden Audit E2E',
        roleKey: 'ops',
      },
    });
    expect(forbiddenCreateResponse.status()).toBe(403);
    const forbiddenCreatePayload = (await forbiddenCreateResponse.json()) as {
      error?: { code?: string };
    };
    expect(forbiddenCreatePayload.error?.code).toBe('FORBIDDEN');

    const adminLoginResponse = await page.request.post('/api/v1/admin/login', {
      data: {
        email: adminCreds.email,
        password: adminCreds.password,
      },
    });
    expect(adminLoginResponse.ok()).toBeTruthy();
    const adminLoginPayload = (await adminLoginResponse.json()) as {
      data?: { token?: string };
    };
    const superAdminToken = adminLoginPayload.data?.token || '';
    expect(superAdminToken).toBeTruthy();

    const auditResponse = await page.request.get('/api/v1/admin/audit-logs', {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      params: {
        entityType: 'admin_user',
        action: 'admin_user_create',
        limit: 100,
        offset: 0,
      },
    });
    expect(auditResponse.ok()).toBeTruthy();
    const auditPayload = (await auditResponse.json()) as {
      data?: {
        items?: Array<{
          detail?: { email?: string };
        }>;
      };
    };
    const pollutedEntry = (auditPayload.data?.items || []).find(
      (item) => item.detail?.email === forbiddenEmail
    );
    expect(pollutedEntry).toBeUndefined();
  });
});
