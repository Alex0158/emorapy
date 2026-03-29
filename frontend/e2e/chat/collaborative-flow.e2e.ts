import { expect, test } from '@playwright/test';

test.describe('Collaborative 主鏈路', () => {
  test('訪客可完成協作聽證並進入 result', async ({ page }) => {
    const roleAStatement = '我想先把最近的衝突說清楚，我們每次談到陪伴與分工時都會吵架，彼此都覺得沒有被理解。';
    const roleBStatement = '我不是不在乎，而是最近真的壓力很大，也不知道怎麼回應才不會讓衝突更嚴重。';

    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'POST' && pathname === '/api/v1/cases/collaborative') {
        const body = route.request().postDataJSON() as {
          case_id?: string;
          plaintiff_statement?: string;
          defendant_statement?: string;
        };

        if (body.plaintiff_statement) {
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                session_id: 'session-collab-e2e-1',
                session_expires_at: '2026-12-31T00:00:00.000Z',
                phase: 'a_done',
                case: {
                  id: 'case-collab-e2e-1',
                  plaintiff_statement: roleAStatement,
                  mode: 'collaborative',
                  status: 'draft',
                },
              },
            }),
          });
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              session_id: 'session-collab-e2e-1',
              session_expires_at: '2026-12-31T00:00:00.000Z',
              phase: 'submitted',
              case: {
                id: 'case-collab-e2e-1',
                plaintiff_statement: roleAStatement,
                defendant_statement: roleBStatement,
                mode: 'collaborative',
                status: 'submitted',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-collab-e2e-1') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              case: {
                id: 'case-collab-e2e-1',
                status: 'completed',
                evidences: [],
                session_id: 'session-collab-e2e-1',
                mode: 'collaborative',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-collab-e2e-1/judgment') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-collab-e2e-1',
                summary: 'Collaborative E2E summary',
                judgment_content: 'Collaborative E2E judgment content',
                plaintiff_ratio: 55,
                defendant_ratio: 45,
                responsibility_ratio: {
                  plaintiff: 55,
                  defendant: 45,
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

    await page.goto('/quick-experience/collaborative');

    await page.getByRole('button', { name: 'Start — Role A Goes First' }).click();
    await page.getByPlaceholder('Write your thoughts and feelings here...').fill(roleAStatement);

    const roleARequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      request.url().includes('/api/v1/cases/collaborative') &&
      request.postData()?.includes('plaintiff_statement')
    );
    await page.getByRole('button', { name: 'Done — Pass to Role B →' }).click();
    await roleARequest;

    await expect(page.getByText('Please Pass the Device to Role B')).toBeVisible();
    await page.getByRole('button', { name: "I'm Role B — Start Writing" }).click();
    await expect(page.getByText("🅱️ Role B, It's Your Turn")).toBeVisible();

    await page.getByPlaceholder('Write your thoughts and feelings here...').fill(roleBStatement);

    const roleBRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      request.url().includes('/api/v1/cases/collaborative') &&
      request.postData()?.includes('defendant_statement')
    );
    await page.getByRole('button', { name: '✨ Submit Together' }).click();
    await roleBRequest;

    await expect(page).toHaveURL(/\/quick-experience\/result\/case-collab-e2e-1$/);
    await expect(page.getByText('Collaborative E2E summary')).toBeVisible();
  });

  test('role_b 提交失敗時應顯示錯誤、可再次提交且成功導向 result（F02 錯誤恢復）', async ({ page }) => {
    const roleAStatement = '我想先把最近的衝突說清楚，我們每次談到陪伴與分工時都會吵架，彼此都覺得沒有被理解。';
    const roleBStatement = '我不是不在乎，而是最近真的壓力很大，也不知道怎麼回應才不會讓衝突更嚴重。';
    let roleBCallCount = 0;

    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'POST' && pathname === '/api/v1/cases/collaborative') {
        const body = route.request().postDataJSON() as {
          case_id?: string;
          plaintiff_statement?: string;
          defendant_statement?: string;
        };

        if (body.plaintiff_statement) {
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                session_id: 'session-collab-retry',
                session_expires_at: '2026-12-31T00:00:00.000Z',
                phase: 'a_done',
                case: {
                  id: 'case-collab-retry',
                  plaintiff_statement: roleAStatement,
                  mode: 'collaborative',
                  status: 'draft',
                },
              },
            }),
          });
        }

        if (body.defendant_statement) {
          roleBCallCount++;
          if (roleBCallCount === 1) {
            return route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '暫時錯誤' },
              }),
            });
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                session_id: 'session-collab-retry',
                session_expires_at: '2026-12-31T00:00:00.000Z',
                phase: 'submitted',
                case: {
                  id: 'case-collab-retry',
                  plaintiff_statement: roleAStatement,
                  defendant_statement: roleBStatement,
                  mode: 'collaborative',
                  status: 'submitted',
                },
              },
            }),
          });
        }
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-collab-retry') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              case: {
                id: 'case-collab-retry',
                status: 'completed',
                evidences: [],
                session_id: 'session-collab-retry',
                mode: 'collaborative',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-collab-retry/judgment') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-collab-retry',
                summary: 'Collaborative retry summary',
                judgment_content: 'Retry success',
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

    await page.goto('/quick-experience/collaborative');
    await page.getByRole('button', { name: 'Start — Role A Goes First' }).click();
    await page.getByPlaceholder('Write your thoughts and feelings here...').fill(roleAStatement);
    await page.getByRole('button', { name: 'Done — Pass to Role B →' }).click();
    await expect(page.getByText('Please Pass the Device to Role B')).toBeVisible();
    await page.getByRole('button', { name: "I'm Role B — Start Writing" }).click();
    await expect(page.getByText("🅱️ Role B, It's Your Turn")).toBeVisible();
    await page.getByPlaceholder('Write your thoughts and feelings here...').fill(roleBStatement);

    await page.getByRole('button', { name: '✨ Submit Together' }).click();
    await expect(page.getByText(/提交失敗|Submission failed|暫時錯誤/).first()).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: '✨ Submit Together' }).click();
    await expect(page).toHaveURL(/\/quick-experience\/result\/case-collab-retry$/, { timeout: 15000 });
    await expect(page.getByText('Collaborative retry summary')).toBeVisible();
  });
});
