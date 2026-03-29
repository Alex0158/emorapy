import { test, expect } from '@playwright/test';
import {
  waitForAuditEntry,
  expectNoPermissionDenied,
  loginAsAdmin,
  requireE2EAdminCreds,
} from './helpers';

const adminCreds = requireE2EAdminCreds();

test.describe('Admin critical flow', () => {
  test.skip(!adminCreds, '需要設定 E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD');

  test('登入→頁面覆蓋→權限頁可見', async ({ page }) => {
    if (!adminCreds) {
      test.skip();
      return;
    }
    await loginAsAdmin(page, adminCreds.email, adminCreds.password);
    await expectNoPermissionDenied(page);

    await page.goto('/admin/configs');
    await expect(page).toHaveURL(/\/admin\/configs/);
    await expect(page.getByText(/系統配置|configurations/i)).toBeVisible();
    await expectNoPermissionDenied(page);

    await page.goto('/admin/reports');
    await expect(page).toHaveURL(/\/admin\/reports/);
    await expect(page.getByText(/報表|reports/i)).toBeVisible();
    await expectNoPermissionDenied(page);

    await page.goto('/admin/audit-logs');
    await expect(page).toHaveURL(/\/admin\/audit-logs/);
    await expect(page.getByText(/審計|audit/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /csv/i })).toBeVisible();
    await expectNoPermissionDenied(page);

    await page.goto('/admin/ops/jobs');
    await expect(page).toHaveURL(/\/admin\/ops\/jobs/);
    await expect(page.getByText(/Cron 任務統計|Cron Job Stats/i)).toBeVisible();
    await expectNoPermissionDenied(page);
  });

  test('管理員寫操作應落審計紀錄（create admin user）', async ({ page }) => {
    if (!adminCreds) {
      test.skip();
      return;
    }

    await loginAsAdmin(page, adminCreds.email, adminCreds.password);
    await expectNoPermissionDenied(page);

    const adminToken = await page.evaluate(() => {
      return window.sessionStorage.getItem('admin_token') || window.localStorage.getItem('admin_token') || '';
    });
    expect(adminToken).toBeTruthy();

    const adminMeResponse = await page.request.get('/api/v1/admin/me', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(adminMeResponse.ok()).toBeTruthy();
    const adminMePayload = (await adminMeResponse.json()) as {
      data?: { admin?: { id?: string } };
    };
    const actorId = adminMePayload.data?.admin?.id || '';
    expect(actorId).toBeTruthy();

    const tempEmail = `audit-e2e-${Date.now()}@example.com`;
    const auditFrom = new Date(Date.now() - 5_000).toISOString();
    const createResponse = await page.request.post('/api/v1/admin/admin-users', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        email: tempEmail,
        password: 'AdminPass1234',
        name: 'Audit E2E User',
        roleKey: 'ops',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createPayload = (await createResponse.json()) as {
      data?: { item?: { id?: string; email?: string } };
    };
    const createdAdminId = createPayload.data?.item?.id || '';
    expect(createdAdminId).toBeTruthy();

    await page.goto('/admin/audit-logs');
    await expect(page).toHaveURL(/\/admin\/audit-logs/);
    await expectNoPermissionDenied(page);

    await page.getByPlaceholder(/實體類型|Entity Type/i).fill('admin_user');
    await page.getByPlaceholder(/操作類型|Action/i).fill('admin_user_create');

    await expect(page.getByRole('cell', { name: 'admin_user_create' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: tempEmail }).first()).toBeVisible();

    // API 層再校驗一次審計內容，避免僅依賴 UI 呈現造成假陽性。
    const matchedEntry = await waitForAuditEntry({
      page,
      token: adminToken,
      query: {
        entityType: 'admin_user',
        action: 'admin_user_create',
        from: auditFrom,
      },
      matcher: (item) =>
        item.entity_type === 'admin_user' &&
        item.action === 'admin_user_create' &&
        item.entity_id === createdAdminId &&
        (item.detail as { email?: string } | undefined)?.email === tempEmail,
    });
    expect(matchedEntry).toBeTruthy();
    expect(matchedEntry?.actor_id).toBe(actorId);

    const updateResponse = await page.request.patch(`/api/v1/admin/admin-users/${createdAdminId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        name: 'Audit E2E Updated',
        isActive: true,
      },
    });
    expect(updateResponse.ok()).toBeTruthy();

    const deleteResponse = await page.request.delete(`/api/v1/admin/admin-users/${createdAdminId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(deleteResponse.ok()).toBeTruthy();

    const updateEntry = await waitForAuditEntry({
      page,
      token: adminToken,
      query: {
        entityType: 'admin_user',
        action: 'admin_user_update',
        from: auditFrom,
      },
      matcher: (item) => item.action === 'admin_user_update' && item.entity_id === createdAdminId,
    });
    expect(updateEntry).toBeTruthy();
    expect(updateEntry?.actor_id).toBe(actorId);
    const updateDetail = (updateEntry?.detail as {
      changed?: { name?: boolean; isActive?: boolean | null; passwordReset?: boolean };
    } | undefined);
    expect(updateDetail?.changed?.name).toBe(true);
    expect(updateDetail?.changed?.isActive).toBe(true);
    expect(updateDetail?.changed?.passwordReset).toBe(false);

    const deleteEntry = await waitForAuditEntry({
      page,
      token: adminToken,
      query: {
        entityType: 'admin_user',
        action: 'admin_user_delete',
        from: auditFrom,
      },
      matcher: (item) =>
        item.action === 'admin_user_delete' &&
        item.entity_id === createdAdminId &&
        (item.detail as { email?: string } | undefined)?.email === tempEmail,
    });
    expect(deleteEntry).toBeTruthy();
    expect(deleteEntry?.actor_id).toBe(actorId);
  });

  test('治理護欄：不可自刪、不可停用自己', async ({ page }) => {
    if (!adminCreds) {
      test.skip();
      return;
    }

    await loginAsAdmin(page, adminCreds.email, adminCreds.password);
    await expectNoPermissionDenied(page);

    const adminToken = await page.evaluate(() => {
      return window.sessionStorage.getItem('admin_token') || window.localStorage.getItem('admin_token') || '';
    });
    expect(adminToken).toBeTruthy();

    const adminMeResponse = await page.request.get('/api/v1/admin/me', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(adminMeResponse.ok()).toBeTruthy();
    const adminMePayload = (await adminMeResponse.json()) as {
      data?: { admin?: { id?: string } };
    };
    const actorId = adminMePayload.data?.admin?.id || '';
    expect(actorId).toBeTruthy();

    const selfDisableResponse = await page.request.patch(`/api/v1/admin/admin-users/${actorId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        isActive: false,
      },
    });
    expect(selfDisableResponse.status()).toBe(403);

    const selfDeleteResponse = await page.request.delete(`/api/v1/admin/admin-users/${actorId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(selfDeleteResponse.status()).toBe(403);

    const auditFrom = new Date(Date.now() - 5_000).toISOString();
    const selfDeleteAudit = await waitForAuditEntry({
      page,
      token: adminToken,
      query: {
        entityType: 'admin_user',
        action: 'admin_user_delete',
        from: auditFrom,
      },
      matcher: (item) =>
        item.action === 'admin_user_delete' &&
        item.entity_id === actorId &&
        item.actor_id === actorId,
      attempts: 2,
      intervalMs: 400,
    });
    expect(selfDeleteAudit).toBeNull();

    const selfDisableAudit = await waitForAuditEntry({
      page,
      token: adminToken,
      query: {
        entityType: 'admin_user',
        action: 'admin_user_update',
        from: auditFrom,
      },
      matcher: (item) =>
        item.action === 'admin_user_update' &&
        item.entity_id === actorId &&
        item.actor_id === actorId &&
        ((item.detail as { changed?: { isActive?: boolean | null } } | undefined)?.changed
          ?.isActive === false),
      attempts: 2,
      intervalMs: 400,
    });
    expect(selfDisableAudit).toBeNull();
  });

  test('治理護欄：不可修改自己角色', async ({ page }) => {
    if (!adminCreds) {
      test.skip();
      return;
    }

    await loginAsAdmin(page, adminCreds.email, adminCreds.password);
    await expectNoPermissionDenied(page);

    const adminToken = await page.evaluate(() => {
      return window.sessionStorage.getItem('admin_token') || window.localStorage.getItem('admin_token') || '';
    });
    expect(adminToken).toBeTruthy();

    const adminMeResponse = await page.request.get('/api/v1/admin/me', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(adminMeResponse.ok()).toBeTruthy();
    const adminMePayload = (await adminMeResponse.json()) as {
      data?: { admin?: { id?: string } };
    };
    const actorId = adminMePayload.data?.admin?.id || '';
    expect(actorId).toBeTruthy();

    const auditFrom = new Date(Date.now() - 5_000).toISOString();
    const selfRoleUpdateResponse = await page.request.patch(`/api/v1/admin/admin-users/${actorId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        roleKey: 'ops',
      },
    });
    expect(selfRoleUpdateResponse.status()).toBe(403);

    const selfRoleAudit = await waitForAuditEntry({
      page,
      token: adminToken,
      query: {
        entityType: 'admin_user',
        action: 'admin_user_update',
        from: auditFrom,
      },
      matcher: (item) =>
        item.action === 'admin_user_update' &&
        item.entity_id === actorId &&
        item.actor_id === actorId &&
        ((item.detail as { changed?: { roleKey?: string | null } } | undefined)?.changed
          ?.roleKey === 'ops'),
      attempts: 2,
      intervalMs: 400,
    });
    expect(selfRoleAudit).toBeNull();
  });

  test('停用管理員後既有 token 應立即失效', async ({ page }) => {
    if (!adminCreds) {
      test.skip();
      return;
    }

    await loginAsAdmin(page, adminCreds.email, adminCreds.password);
    await expectNoPermissionDenied(page);

    const superAdminToken = await page.evaluate(() => {
      return window.sessionStorage.getItem('admin_token') || window.localStorage.getItem('admin_token') || '';
    });
    expect(superAdminToken).toBeTruthy();

    const superAdminMeResponse = await page.request.get('/api/v1/admin/me', {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(superAdminMeResponse.ok()).toBeTruthy();
    const superAdminMePayload = (await superAdminMeResponse.json()) as {
      data?: { admin?: { id?: string } };
    };
    const actorId = superAdminMePayload.data?.admin?.id || '';
    expect(actorId).toBeTruthy();

    const tempEmail = `revoke-e2e-${Date.now()}@example.com`;
    const tempPassword = 'TempAdminPass1234';
    const createResponse = await page.request.post('/api/v1/admin/admin-users', {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      data: {
        email: tempEmail,
        password: tempPassword,
        name: 'Revoke E2E User',
        roleKey: 'ops',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createPayload = (await createResponse.json()) as {
      data?: { item?: { id?: string } };
    };
    const tempAdminId = createPayload.data?.item?.id || '';
    expect(tempAdminId).toBeTruthy();

    const tempLoginResponse = await page.request.post('/api/v1/admin/login', {
      data: {
        email: tempEmail,
        password: tempPassword,
      },
    });
    expect(tempLoginResponse.ok()).toBeTruthy();
    const tempLoginPayload = (await tempLoginResponse.json()) as {
      data?: { token?: string };
    };
    const tempToken = tempLoginPayload.data?.token || '';
    expect(tempToken).toBeTruthy();

    const tempMeBeforeDisable = await page.request.get('/api/v1/admin/me', {
      headers: {
        Authorization: `Bearer ${tempToken}`,
      },
    });
    expect(tempMeBeforeDisable.ok()).toBeTruthy();

    const disableResponse = await page.request.patch(`/api/v1/admin/admin-users/${tempAdminId}`, {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      data: {
        isActive: false,
      },
    });
    expect(disableResponse.ok()).toBeTruthy();

    const tempMeAfterDisable = await page.request.get('/api/v1/admin/me', {
      headers: {
        Authorization: `Bearer ${tempToken}`,
      },
    });
    expect(tempMeAfterDisable.status()).toBe(401);

    const tempUsersAfterDisable = await page.request.get('/api/v1/admin/users', {
      headers: {
        Authorization: `Bearer ${tempToken}`,
      },
      params: {
        limit: 10,
        offset: 0,
      },
    });
    expect(tempUsersAfterDisable.status()).toBe(401);

    const tempAuditAfterDisable = await page.request.get('/api/v1/admin/audit-logs', {
      headers: {
        Authorization: `Bearer ${tempToken}`,
      },
      params: {
        limit: 10,
        offset: 0,
      },
    });
    expect(tempAuditAfterDisable.status()).toBe(401);

    const tempLoginAfterDisable = await page.request.post('/api/v1/admin/login', {
      data: {
        email: tempEmail,
        password: tempPassword,
      },
    });
    expect(tempLoginAfterDisable.status()).toBe(401);

    const matched = await waitForAuditEntry({
      page,
      token: superAdminToken,
      query: {
        entityType: 'admin_user',
        action: 'admin_user_update',
      },
      matcher: (item) =>
        item.entity_id === tempAdminId &&
        item.actor_id === actorId &&
        ((item.detail as { changed?: { isActive?: boolean | null } } | undefined)?.changed
          ?.isActive === false),
    });
    expect(matched).toBeTruthy();
  });
});
