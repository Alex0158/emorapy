import { expect, test } from '@playwright/test';

async function seedAuthenticatedUser(page: import('@playwright/test').Page, userId = 'user-interview-e2e') {
  await page.addInitScript(
    ({ id }: { id: string }) => {
      localStorage.setItem('token', `token-${id}`);
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id,
            email: `${id}@example.com`,
            nickname: 'InterviewUser',
            email_verified: true,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        },
        version: 0,
      }));
    },
    { id: userId }
  );
}

test.describe('Interview 恢復與跨頁回流', () => {
  test('MyStory 失敗重試後應回到 result 並從 processing 走到 completed（P0-05）', async ({ page }) => {
    await seedAuthenticatedUser(page, 'user-interview-retry');

    let sessionStatus: 'processing_failed' | 'processing' | 'completed' = 'processing_failed';
    let getSessionCount = 0;
    let retryCalled = false;

    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'GET' && pathname === '/api/v1/user/profile') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                id: 'user-interview-retry',
                email: 'user-interview-retry@example.com',
                nickname: 'InterviewUser',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/psych-profile') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              consent_given: true,
              richness_score: 62,
              narratives: [
                {
                  id: 'n-1',
                  domain: 'attachment',
                  is_latest: true,
                  completeness: 0.62,
                  ai_summary: '你正在學會更穩定地描述需要。',
                },
              ],
              insights: [],
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/psych-profile/feedback') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { history: [] },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/interview/resume') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              has_pending: false,
              has_failed: true,
              failed_session_id: 'session-retry-e2e',
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/interview/session-retry-e2e/retry') {
        retryCalled = true;
        sessionStatus = 'processing';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/interview/session-retry-e2e') {
        getSessionCount += 1;
        if (getSessionCount >= 3) {
          sessionStatus = 'completed';
        }

        const feedbackCard = sessionStatus === 'completed'
          ? JSON.stringify({
              summary: '這次你更清楚說出了自己的受傷點。',
              richness_score: 74,
              domains_explored: ['attachment'],
              domains_unexplored: [],
              key_insights: ['你更能辨識被忽略時的感受'],
              encouragement: '你已經比之前更靠近自己的情緒。',
              continuation_hint: '之後可以繼續補充更多例子。',
            })
          : null;

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'session-retry-e2e',
              status: sessionStatus,
              trigger: 'organic',
              turns: [],
              domains_touched: ['attachment'],
              feedback_card: feedbackCard,
            },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/profile/my-story');

    await expect(page.getByText(/上次對話的分析遇到問題|Previous analysis encountered an issue/)).toBeVisible();
    await page.getByRole('button', { name: /重新處理|Retry Processing/ }).click();

    await expect.poll(() => retryCalled).toBe(true);
    await expect(page).toHaveURL(/\/interview\/session-retry-e2e\/result$/);
    await expect(page.getByText(/正在為你整理故事，請稍候|Organizing your story, please wait/)).toBeVisible();
    await expect(page.getByText('這次你更清楚說出了自己的受傷點。')).toBeVisible({ timeout: 10000 });
  });

  test('Profile Index 有 pending session 時應回流到既有 interview（P0-05）', async ({ page }) => {
    await seedAuthenticatedUser(page, 'user-interview-resume');

    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'GET' && pathname === '/api/v1/user/profile') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                id: 'user-interview-resume',
                email: 'user-interview-resume@example.com',
                nickname: 'InterviewUser',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/psych-profile') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              consent_given: true,
              richness_score: 48,
              narratives: [
                {
                  id: 'n-2',
                  domain: 'family_origin',
                  is_latest: true,
                  completeness: 0.48,
                  ai_summary: '你已開始回看原生家庭對衝突的影響。',
                },
              ],
              insights: [],
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/interview/resume') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              has_pending: true,
              session_id: 'session-pending-e2e',
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/interview/session-pending-e2e') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'session-pending-e2e',
              status: 'in_progress',
              trigger: 'onboarding',
              domains_touched: ['family_origin'],
              turns: [
                {
                  id: 'turn-1',
                  turn_order: 1,
                  ai_message: '最近有哪件事，讓你特別想重新理解自己？',
                  user_response: null,
                  skipped: false,
                  safety_flag: false,
                  created_at: '2026-01-01T00:00:00.000Z',
                },
              ],
            },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/profile/index');

    await expect(page.getByRole('heading', { name: /個人資料|Profile/ })).toBeVisible();
    await page.getByRole('button', { name: /繼續聊聊|Continue chatting/ }).click();

    await expect(page).toHaveURL(/\/interview\/session-pending-e2e$/);
    await expect(page.getByText(/與 AI 聊聊|Chat with AI/)).toBeVisible();
    await expect(page.getByText('最近有哪件事，讓你特別想重新理解自己？')).toBeVisible();
  });

  test('Interview 首次載入失敗時應停留頁內並提供 retry/back 出口（P1-03）', async ({ page }) => {
    await seedAuthenticatedUser(page, 'user-interview-load-fail');

    let sessionFetchCount = 0;

    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'GET' && pathname === '/api/v1/user/profile') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                id: 'user-interview-load-fail',
                email: 'user-interview-load-fail@example.com',
                nickname: 'InterviewUser',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/interview/session-load-fail-e2e') {
        sessionFetchCount += 1;
        if (sessionFetchCount <= 2) {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: {
                code: 'SERVER_ERROR',
                message: '訪談載入暫時失敗',
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
              id: 'session-load-fail-e2e',
              status: 'in_progress',
              trigger: 'organic',
              domains_touched: ['attachment'],
              turns: [
                {
                  id: 'turn-load-1',
                  turn_order: 1,
                  ai_message: '這次先從最近最卡住的一次爭執開始，好嗎？',
                  user_response: null,
                  skipped: false,
                  safety_flag: false,
                  created_at: '2026-01-01T00:00:00.000Z',
                },
              ],
            },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/interview/session-load-fail-e2e');

    await expect(page.locator('main').getByText('訪談載入暫時失敗').first()).toBeVisible();
    await expect(page.getByText(/回到個人頁面|interview.backToProfile|Back to Profile/)).toBeVisible();

    await page.getByTestId('interview-chat-load-retry').click();
    await expect(page.getByText('這次先從最近最卡住的一次爭執開始，好嗎？')).toBeVisible();
  });
});
