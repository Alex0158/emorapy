import { expect, test } from '@playwright/test';

const NEXT_BUTTON = /下一步|Next/;
const SUBMIT_BUTTON = /提交並開始分析|Submit and Start Analysis|提交案件|Submit Case/;
const REGISTER_NOW_BUTTON = /立即註冊|Register Now/;
const SEND_CODE_BUTTON = /發送驗證碼|Send Verification Code/;
const VERIFY_BUTTON = /驗證並繼續|Verify & Continue/;
const FINISH_REGISTER_BUTTON = /完成註冊|Complete Registration/;

test.describe('Quick Experience 升格閉環', () => {
  test('訪客從 result 註冊後應觸發 claim-session 並回跳原結果頁（F01/F09）', async ({ page }) => {
    const plaintiffStatement = '我最近常感到被忽視，每次想好好說話都被敷衍，心裡很受傷，也不知道該怎麼把這段關係繼續下去。';
    const sessionId = 'session-e2e-claim';
    let registerCalled = false;
    let claimSessionCalled = false;

    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'GET' && pathname === '/api/v1/cases/by-session') {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'NOT_FOUND', message: '案件不存在' },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/sessions/quick') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              session_id: sessionId,
              expires_at: '2026-12-31T00:00:00.000Z',
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/cases/quick') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              session_id: sessionId,
              session_expires_at: '2026-12-31T00:00:00.000Z',
              case: {
                id: 'case-e2e-claim',
                plaintiff_statement: plaintiffStatement,
                defendant_statement: '',
                mode: 'quick',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-e2e-claim') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              case: {
                id: 'case-e2e-claim',
                status: 'completed',
                evidences: [],
                session_id: sessionId,
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-e2e-claim/judgment') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-e2e-claim',
                summary: '升格後仍可回看 quick result',
                judgment_content: '這是一段註冊後仍可回訪的判決內容',
                plaintiff_ratio: 58,
                defendant_ratio: 42,
                responsibility_ratio: { plaintiff: 58, defendant: 42 },
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/content-items') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [] },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/auth/send-verification-code') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/auth/verify-email') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { verified: true },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/auth/register') {
        registerCalled = true;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              token: 'token-e2e-claim',
              user: {
                id: 'user-e2e-claim',
                email: 'claim-e2e@example.com',
                nickname: 'ClaimUser',
                email_verified: true,
                created_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/auth/claim-session') {
        claimSessionCalled = true;
        const body = route.request().postDataJSON() as { session_id?: string };
        expect(body.session_id).toBe(sessionId);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { case_id: 'case-e2e-claim' },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/quick-experience/create');

    await page.locator('textarea').fill(plaintiffStatement);
    await page.getByRole('button', { name: NEXT_BUTTON }).click();
    await page.getByRole('button', { name: NEXT_BUTTON }).click();
    await page.getByRole('button', { name: SUBMIT_BUTTON }).click();

    await expect(page).toHaveURL(/\/quick-experience\/result\/case-e2e-claim$/);
    await expect(page.getByText('升格後仍可回看 quick result')).toBeVisible();

    const registerButton = page.getByRole('button', { name: REGISTER_NOW_BUTTON }).first();
    await expect(registerButton).toBeVisible();
    await registerButton.click();
    await expect(page).toHaveURL(/\/auth\/register$/);

    await page.locator('input[autocomplete="email"]').fill('claim-e2e@example.com');
    const sendCodeButton = page.getByRole('button', { name: SEND_CODE_BUTTON });
    await expect(sendCodeButton).toBeVisible();
    await sendCodeButton.click();

    const codeInputs = page.locator('input[autocomplete="one-time-code"]');
    for (let i = 0; i < 6; i++) {
      await codeInputs.nth(i).fill(String(i + 1));
    }
    const verifyButton = page.getByRole('button', { name: VERIFY_BUTTON });
    await expect(verifyButton).toBeVisible();
    await verifyButton.click();

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('Password123');
    await passwordInputs.nth(1).fill('Password123');
    const finishRegisterButton = page.getByRole('button', { name: FINISH_REGISTER_BUTTON });
    await expect(finishRegisterButton).toBeVisible();
    await finishRegisterButton.click();

    await expect(page).toHaveURL(/\/quick-experience\/result\/case-e2e-claim$/);
    await expect(page.getByText('升格後仍可回看 quick result')).toBeVisible();

    await expect.poll(() => registerCalled).toBe(true);
    await expect.poll(() => claimSessionCalled).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('token-e2e-claim');
    expect(await page.evaluate(() => localStorage.getItem('cj_session_id'))).toBe(sessionId);
  });
});
