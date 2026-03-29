import { expect, test } from '@playwright/test';

async function seedAuthenticatedUser(page: import('@playwright/test').Page, userId = 'user-exec-e2e') {
  await page.addInitScript(
    ({ id }: { id: string }) => {
      localStorage.setItem('token', `token-${id}`);
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id,
            email: `${id}@example.com`,
            nickname: 'ExecUser',
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

test.describe('Execution 三段鏈路', () => {
  test('reconciliation detail -> execution/checkin 應可連續閉環，且 confirm/checkin 快速連點只送一次（P1-05）', async ({ page }) => {
    await seedAuthenticatedUser(page, 'user-exec-bridge');

    let confirmExecutionCalls = 0;
    let checkinCalls = 0;
    let statusFetchCount = 0;
    let latestProgress = 20;

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
                id: 'user-exec-bridge',
                email: 'user-exec-bridge@example.com',
                nickname: 'ExecUser',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/reconciliation-plans/plan-exec-bridge') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              plan: {
                id: 'plan-exec-bridge',
                judgment_id: 'judgment-exec-bridge',
                judgment: { case_id: 'case-exec-bridge' },
                plan_content: '一起整理家務並在晚餐後做 15 分鐘對話',
                plan_type: 'activity',
                difficulty_level: 'easy',
                estimated_duration: 5,
                time_cost: 1,
                money_cost: 1,
                emotion_cost: 2,
                skill_requirement: 1,
                user1_selected: true,
                user2_selected: false,
                created_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/execution/confirm') {
        confirmExecutionCalls += 1;
        expect(route.request().postDataJSON()).toEqual({ plan_id: 'plan-exec-bridge' });
        await new Promise((resolve) => setTimeout(resolve, 150));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              execution: {
                id: 'record-confirm-bridge',
                reconciliation_plan_id: 'plan-exec-bridge',
                user_id: 'user-exec-bridge',
                action: 'confirm',
                status: 'in_progress',
                notes: '',
                photos_urls: [],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/execution/status') {
        statusFetchCount += 1;
        const progress = statusFetchCount >= 2 ? latestProgress : 20;
        const records = statusFetchCount >= 2
          ? [
              {
                id: 'record-checkin-bridge',
                reconciliation_plan_id: 'plan-exec-bridge',
                user_id: 'user-exec-bridge',
                action: 'checkin',
                status: 'in_progress',
                notes: '今晚有做到並完成記錄',
                photos_urls: [],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            ]
          : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              plan_id: 'plan-exec-bridge',
              status: 'in_progress',
              progress,
              records,
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/execution/checkin') {
        checkinCalls += 1;
        const body = route.request().postDataJSON() as { plan_id?: string; notes?: string; photos?: string[] };
        expect(body.plan_id).toBe('plan-exec-bridge');
        expect(body.notes).toBe('今晚有做到並完成記錄');
        expect(body.photos).toEqual([]);
        latestProgress = 45;
        await new Promise((resolve) => setTimeout(resolve, 150));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              execution: {
                id: 'record-checkin-bridge',
                reconciliation_plan_id: 'plan-exec-bridge',
                user_id: 'user-exec-bridge',
                action: 'checkin',
                status: 'in_progress',
                notes: '今晚有做到並完成記錄',
                photos_urls: [],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/reconciliation/judgment-exec-bridge/plan-exec-bridge');
    const startExecutionButton = page.getByRole('button', { name: /開始執行|Start Execution/ });
    await expect(startExecutionButton).toBeVisible();
    await startExecutionButton.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

    await page.waitForURL('**/execution/plan-exec-bridge/checkin');
    await expect(page.getByText(/執行打卡|Check In/)).toBeVisible();
    expect(confirmExecutionCalls).toBe(1);

    await page.getByPlaceholder(/請描述您執行方案的情況|Describe how you executed the plan/).fill('今晚有做到並完成記錄');
    const submitButton = page.getByRole('button', { name: /提交打卡|Submit Check-in/ });
    await submitButton.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByText(/打卡成功！|Check-in successful!/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/執行進度：45%|Progress: 45%/)).toBeVisible({ timeout: 5000 });
    expect(checkinCalls).toBe(1);
  });

  test('有照片時應完成 uploadEvidence -> checkin -> dashboard 回寫（P0-04）', async ({ page }) => {
    await seedAuthenticatedUser(page, 'user-exec-photo-success');

    let statusFetchCount = 0;
    let dashboardFetchCount = 0;
    let uploadedFiles = 0;
    let latestProgress = 75;

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
                id: 'user-exec-photo-success',
                email: 'user-exec-photo-success@example.com',
                nickname: 'ExecUser',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/execution/status') {
        statusFetchCount += 1;
        const progress = statusFetchCount >= 2 ? latestProgress : 50;
        const records = statusFetchCount >= 2
          ? [
              {
                id: 'record-1',
                reconciliation_plan_id: 'plan-exec-1',
                user_id: 'user-exec-photo-success',
                action: 'checkin',
                status: 'in_progress',
                notes: '今天有明顯進步',
                photos_urls: ['https://example.com/evidence-photo-1.jpg'],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            ]
          : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              plan_id: 'plan-exec-1',
              status: 'in_progress',
              progress,
              records,
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/reconciliation-plans/plan-exec-1') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              plan: {
                id: 'plan-exec-1',
                judgment_id: 'judgment-exec-1',
                judgment: { case_id: 'case-exec-1' },
                plan_content: '週末一起散步並聊聊最近感受',
                plan_type: 'activity',
                difficulty_level: 'easy',
                estimated_duration: 7,
                time_cost: 1,
                money_cost: 1,
                emotion_cost: 2,
                skill_requirement: 1,
                user1_selected: true,
                user2_selected: false,
                created_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/cases/case-exec-1/evidence') {
        uploadedFiles = 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              evidences: [
                { id: 'e1', file_url: 'https://example.com/evidence-photo-1.jpg', file_type: 'image/jpeg' },
              ],
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/execution/checkin') {
        const body = route.request().postDataJSON() as { plan_id?: string; notes?: string; photos?: string[] };
        expect(body.plan_id).toBe('plan-exec-1');
        expect(body.notes).toBe('今天有明顯進步');
        expect(body.photos).toEqual(['https://example.com/evidence-photo-1.jpg']);
        latestProgress = 75;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              execution: {
                id: 'record-1',
                reconciliation_plan_id: 'plan-exec-1',
                user_id: 'user-exec-photo-success',
                action: 'checkin',
                status: 'in_progress',
                notes: '今天有明顯進步',
                photos_urls: ['https://example.com/evidence-photo-1.jpg'],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/execution/dashboard') {
        dashboardFetchCount += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              executions: [
                {
                  plan_id: 'plan-exec-1',
                  status: 'in_progress',
                  progress: latestProgress,
                  records: [
                    {
                      id: 'record-1',
                      reconciliation_plan_id: 'plan-exec-1',
                      user_id: 'user-exec-photo-success',
                      action: 'checkin',
                      status: 'in_progress',
                      notes: '今天有明顯進步',
                      photos_urls: ['https://example.com/evidence-photo-1.jpg'],
                      created_at: '2026-01-01T00:00:00.000Z',
                      updated_at: '2026-01-01T00:00:00.000Z',
                    },
                  ],
                  plan_summary: {
                    title: '週末散步方案',
                    plan_type: 'activity',
                    difficulty_level: 'easy',
                    estimated_duration: 7,
                  },
                },
              ],
            },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/execution/plan-exec-1/checkin');
    await expect(page.getByText(/執行打卡|Check In/)).toBeVisible();
    await expect(page.getByPlaceholder(/請描述您執行方案的情況|Describe how you executed the plan/)).toBeVisible();

    await page.getByPlaceholder(/請描述您執行方案的情況|Describe how you executed the plan/).fill('今天有明顯進步');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'progress-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-content'),
    });
    await page.getByRole('button', { name: /提交打卡|Submit Check-in/ }).click();

    await expect(page.getByText(/打卡成功！|Check-in successful!/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/執行進度：75%|Progress: 75%/)).toBeVisible({ timeout: 5000 });
    expect(uploadedFiles).toBe(1);

    await page.goto('/execution/dashboard');
    await expect(page.getByText(/執行儀表板|Execution Dashboard/)).toBeVisible();
    await expect(page.getByText('週末散步方案')).toBeVisible();
    await expect(page.getByText('75%')).toBeVisible();
    expect(dashboardFetchCount).toBeGreaterThan(0);
  });

  test('照片上傳失敗時應降級純文字 checkin，之後 dashboard 仍可見（P0-04）', async ({ page }) => {
    await seedAuthenticatedUser(page, 'user-exec-photo-fallback');

    let latestProgress = 60;
    let uploadAttempted = false;

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
                id: 'user-exec-photo-fallback',
                email: 'user-exec-photo-fallback@example.com',
                nickname: 'ExecUser',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/execution/status') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              plan_id: 'plan-exec-fallback',
              status: 'in_progress',
              progress: latestProgress,
              records: [],
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/reconciliation-plans/plan-exec-fallback') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              plan: {
                id: 'plan-exec-fallback',
                judgment_id: 'judgment-exec-fallback',
                judgment: { case_id: 'case-exec-fallback' },
                plan_content: '每晚睡前分享一件今天感謝對方的事',
                plan_type: 'communication',
                difficulty_level: 'medium',
                estimated_duration: 5,
                time_cost: 1,
                money_cost: 0,
                emotion_cost: 3,
                skill_requirement: 2,
                user1_selected: true,
                user2_selected: false,
                created_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/cases/case-exec-fallback/evidence') {
        uploadAttempted = true;
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'upload failed' },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/execution/checkin') {
        const body = route.request().postDataJSON() as { notes?: string; photos?: string[] };
        expect(body.notes).toBe('今天先用文字記錄');
        expect(body.photos).toEqual([]);
        latestProgress = 60;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              execution: {
                id: 'record-fallback',
                reconciliation_plan_id: 'plan-exec-fallback',
                user_id: 'user-exec-photo-fallback',
                action: 'checkin',
                status: 'in_progress',
                notes: '今天先用文字記錄',
                photos_urls: [],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/execution/dashboard') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              executions: [
                {
                  plan_id: 'plan-exec-fallback',
                  status: 'in_progress',
                  progress: latestProgress,
                  records: [
                    {
                      id: 'record-fallback',
                      reconciliation_plan_id: 'plan-exec-fallback',
                      user_id: 'user-exec-photo-fallback',
                      action: 'checkin',
                      status: 'in_progress',
                      notes: '今天先用文字記錄',
                      photos_urls: [],
                      created_at: '2026-01-01T00:00:00.000Z',
                      updated_at: '2026-01-01T00:00:00.000Z',
                    },
                  ],
                  plan_summary: {
                    title: '感謝對話方案',
                    plan_type: 'communication',
                    difficulty_level: 'medium',
                    estimated_duration: 5,
                  },
                },
              ],
            },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/execution/plan-exec-fallback/checkin');
    await page.getByPlaceholder(/請描述您執行方案的情況|Describe how you executed the plan/).fill('今天先用文字記錄');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'fallback-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-content'),
    });
    await page.getByRole('button', { name: /提交打卡|Submit Check-in/ }).click();

    await expect(page.getByText(/打卡成功！|Check-in successful!/)).toBeVisible({ timeout: 5000 });
    expect(uploadAttempted).toBe(true);

    await page.goto('/execution/dashboard');
    await expect(page.getByText('感謝對話方案')).toBeVisible();
    await expect(page.getByText('60%')).toBeVisible();
  });

  test('checkin 成功後即使 refresh 失敗，仍應保留 checkin 頁並可在 dashboard 看到最新進度（P0-04）', async ({ page }) => {
    await seedAuthenticatedUser(page, 'user-exec-refresh-fail');

    let shouldFailRefresh = false;

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
                id: 'user-exec-refresh-fail',
                email: 'user-exec-refresh-fail@example.com',
                nickname: 'ExecUser',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/execution/status') {
        if (shouldFailRefresh) {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { code: 'SERVER_ERROR', message: 'refresh failed' },
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              plan_id: 'plan-exec-refresh',
              status: 'in_progress',
              progress: 40,
              records: [],
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/execution/checkin') {
        const body = route.request().postDataJSON() as { notes?: string; photos?: string[] };
        expect(body.notes).toBe('刷新失敗也要保留頁面');
        expect(body.photos).toEqual([]);
        shouldFailRefresh = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              execution: {
                id: 'record-refresh',
                reconciliation_plan_id: 'plan-exec-refresh',
                user_id: 'user-exec-refresh-fail',
                action: 'checkin',
                status: 'in_progress',
                notes: '刷新失敗也要保留頁面',
                photos_urls: [],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/execution/dashboard') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              executions: [
                {
                  plan_id: 'plan-exec-refresh',
                  status: 'in_progress',
                  progress: 55,
                  records: [
                    {
                      id: 'record-refresh',
                      reconciliation_plan_id: 'plan-exec-refresh',
                      user_id: 'user-exec-refresh-fail',
                      action: 'checkin',
                      status: 'in_progress',
                      notes: '刷新失敗也要保留頁面',
                      photos_urls: [],
                      created_at: '2026-01-01T00:00:00.000Z',
                      updated_at: '2026-01-01T00:00:00.000Z',
                    },
                  ],
                  plan_summary: {
                    title: '刷新容錯方案',
                    plan_type: 'activity',
                    difficulty_level: 'easy',
                    estimated_duration: 4,
                  },
                },
              ],
            },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/execution/plan-exec-refresh/checkin');
    await expect(page.getByText(/執行打卡|Check In/)).toBeVisible();
    await page.getByPlaceholder(/請描述您執行方案的情況|Describe how you executed the plan/).fill('刷新失敗也要保留頁面');
    await page.getByRole('button', { name: /提交打卡|Submit Check-in/ }).click();

    await expect(page.getByText(/打卡成功！|Check-in successful!/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/歷史紀錄更新失敗|Failed to refresh history/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/執行打卡|Check In/)).toBeVisible();

    await page.goto('/execution/dashboard');
    await expect(page.getByText('刷新容錯方案')).toBeVisible();
    await expect(page.getByText('55%')).toBeVisible();
  });
});
