import { expect, test } from '@playwright/test';

test.describe('Quick Experience 主鏈路', () => {
  test('訪客可完成 quick create 並進入 result', async ({ page }) => {
    const plaintiffStatement = '我最近常感到被忽視，每次想好好說話都被敷衍，心裡很受傷，也不知道該怎麼把這段關係繼續下去。';
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
            error: {
              code: 'NOT_FOUND',
              message: '案件不存在',
            },
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
              session_id: 'session-e2e-1',
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
              session_id: 'session-e2e-1',
              session_expires_at: '2026-12-31T00:00:00.000Z',
              case: {
                id: 'case-e2e-1',
                plaintiff_statement: plaintiffStatement,
                defendant_statement: '',
                mode: 'quick',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-e2e-1') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              case: {
                id: 'case-e2e-1',
                status: 'completed',
                evidences: [],
                session_id: 'session-e2e-1',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-e2e-1/judgment') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-e2e-1',
                summary: 'E2E summary text',
                judgment_content: 'E2E judgment content',
                plaintiff_ratio: 60,
                defendant_ratio: 40,
                responsibility_ratio: {
                  plaintiff: 60,
                  defendant: 40,
                },
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
            data: {
              items: [],
            },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/quick-experience/create');

    await page.locator('textarea').fill(plaintiffStatement);
    await expect(page.locator('.next-btn')).toBeEnabled();
    await page.locator('.next-btn').click();
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('.next-btn').click();
    const createQuickCaseRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && request.url().includes('/api/v1/cases/quick')
    );
    const createQuickCaseResponse = page.waitForResponse((response) =>
      response.request().method() === 'POST' && response.url().includes('/api/v1/cases/quick')
    );
    await page.locator('.submit-btn').click();
    await createQuickCaseRequest;
    await createQuickCaseResponse;

    await expect(page).toHaveURL(/\/quick-experience\/result\/case-e2e-1$/);
    await expect(page.getByText('E2E summary text')).toBeVisible();
  });

  test('createQuickCase 失敗時應顯示錯誤、可再次提交且成功導向 result（F01 錯誤恢復）', async ({ page }) => {
    const plaintiffStatement = '我最近常感到被忽視，每次想好好說話都被敷衍，心裡很受傷，也不知道該怎麼把這段關係繼續下去。';
    let quickCaseCallCount = 0;

    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'GET' && pathname === '/api/v1/cases/by-session') {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/sessions/quick') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { session_id: 'session-e2e-retry', expires_at: '2026-12-31T00:00:00.000Z' },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/cases/quick') {
        quickCaseCallCount++;
        if (quickCaseCallCount === 1) {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { code: 'INTERNAL_ERROR', message: '伺服器暫時錯誤' },
            }),
          });
        }
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              session_id: 'session-e2e-retry',
              session_expires_at: '2026-12-31T00:00:00.000Z',
              case: {
                id: 'case-e2e-retry',
                plaintiff_statement: plaintiffStatement,
                defendant_statement: '',
                mode: 'quick',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-e2e-retry') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              case: {
                id: 'case-e2e-retry',
                status: 'completed',
                evidences: [],
                session_id: 'session-e2e-retry',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-e2e-retry/judgment') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-e2e-retry',
                summary: 'E2E retry summary',
                judgment_content: 'Retry success content',
                plaintiff_ratio: 50,
                defendant_ratio: 50,
                responsibility_ratio: { plaintiff: 50, defendant: 50 },
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/content-items') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { items: [] } }),
        });
      }

      return route.fallback();
    });

    await page.goto('/quick-experience/create');

    await page.locator('textarea').fill(plaintiffStatement);
    await page.locator('.next-btn').click();
    await page.locator('.next-btn').click();

    await page.locator('.submit-btn').click();
    await expect(page.getByText(/提交失敗|Submission failed|伺服器暫時錯誤/).first()).toBeVisible({ timeout: 5000 });

    await page.locator('.submit-btn').click();
    await expect(page).toHaveURL(/\/quick-experience\/result\/case-e2e-retry$/, { timeout: 15000 });
    await expect(page.getByText('E2E retry summary')).toBeVisible();
  });

  test('Result 頁 getJudgment 失敗時應顯示錯誤、點擊 retry 成功後應顯示判決內容（F01 錯誤恢復）', async ({ page }) => {
    const plaintiffStatement = '我最近常感到被忽視，每次想好好說話都被敷衍，心裡很受傷，也不知道該怎麼把這段關係繼續下去。';
    let judgmentCallCount = 0;

    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'GET' && pathname === '/api/v1/cases/by-session') {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/sessions/quick') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { session_id: 'session-e2e-judgment-retry', expires_at: '2026-12-31T00:00:00.000Z' },
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
              session_id: 'session-e2e-judgment-retry',
              session_expires_at: '2026-12-31T00:00:00.000Z',
              case: {
                id: 'case-e2e-judgment-retry',
                plaintiff_statement: plaintiffStatement,
                defendant_statement: '',
                mode: 'quick',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-e2e-judgment-retry') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              case: {
                id: 'case-e2e-judgment-retry',
                status: 'completed',
                evidences: [],
                session_id: 'session-e2e-judgment-retry',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-e2e-judgment-retry/judgment') {
        judgmentCallCount++;
        if (judgmentCallCount === 1) {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { code: 'INTERNAL_ERROR', message: '暫時無法取得判決' },
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-e2e-retry-success',
                summary: 'Retry 成功後顯示',
                judgment_content: '判決內容已載入',
                plaintiff_ratio: 55,
                defendant_ratio: 45,
                responsibility_ratio: { plaintiff: 55, defendant: 45 },
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/content-items') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { items: [] } }),
        });
      }

      return route.fallback();
    });

    await page.goto('/quick-experience/create');
    await page.locator('textarea').fill(plaintiffStatement);
    await page.locator('.next-btn').click();
    await page.locator('.next-btn').click();
    await page.locator('.submit-btn').click();
    await expect(page).toHaveURL(/\/quick-experience\/result\/case-e2e-judgment-retry$/, { timeout: 15000 });

    await expect(page.getByRole('button', { name: /重試|Retry/ }).first()).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /重試|Retry/ }).first().click();
    await expect(page.getByText('Retry 成功後顯示')).toBeVisible({ timeout: 15000 });
  });
});
