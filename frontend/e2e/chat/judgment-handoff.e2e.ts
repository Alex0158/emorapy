import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const SESSION_STORAGE_KEY = 'cj_session_id';

async function seedAuthenticatedUser(page: Page, userId = 'user-e2e-handoff') {
  await page.addInitScript(
    ({ id }: { id: string }) => {
      localStorage.setItem('token', `token-${id}`);
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id,
            email: `${id}@example.com`,
            nickname: 'E2E User',
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

async function seedGuestSession(page: Page, sessionId: string, baseURL: string) {
  await page.goto(baseURL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ key, sid }: { key: string; sid: string }) => {
      localStorage.setItem(key, sid);
    },
    { key: SESSION_STORAGE_KEY, sid: sessionId }
  );
}

test.describe('Judgment handoff 閉環', () => {
  test('未登入直連 /judgment/:id 應先進 login，登入後回跳原判決頁（P0-02）', async ({ page }) => {
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'POST' && pathname === '/api/v1/auth/login') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              token: 'token-judgment-direct',
              user: {
                id: 'user-judgment-direct',
                email: 'judgment-direct@example.com',
                nickname: 'JudgmentDirect',
                email_verified: true,
                created_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/judgments/judgment-direct-e2e') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-direct-e2e',
                case_id: 'case-direct-e2e',
                judgment_content: 'Direct judgment content after login redirect',
                plaintiff_ratio: 55,
                defendant_ratio: 45,
                responsibility_ratio: { plaintiff: 55, defendant: 45 },
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/psych-profile') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: null }),
        });
      }

      return route.fallback();
    });

    await page.goto('/judgment/judgment-direct-e2e');
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.locator('input[autocomplete="email"]').fill('judgment-direct@example.com');
    await page.locator('input[autocomplete="current-password"]').fill('Password123');
    await page.getByRole('button', { name: /登錄|Log In/ }).click();

    await expect(page).toHaveURL(/\/judgment\/judgment-direct-e2e$/);
    await expect(page.getByText('Direct judgment content after login redirect')).toBeVisible();
  });

  test('F03 -> F04：正式案件 review 頁查看判決應進入 judgment detail（P0-02）', async ({ page }) => {
    await seedAuthenticatedUser(page, 'user-case-review');

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
                id: 'user-case-review',
                email: 'user-case-review@example.com',
                nickname: 'CaseReview',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-review-e2e') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              case: {
                id: 'case-review-e2e',
                status: 'completed',
                title: '正式案件 handoff',
                evidences: [],
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/cases/case-review-e2e/judgment') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-case-review-e2e',
                case_id: 'case-review-e2e',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/judgments/judgment-case-review-e2e') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-case-review-e2e',
                case_id: 'case-review-e2e',
                judgment_content: 'Case review handoff judgment detail',
                plaintiff_ratio: 61,
                defendant_ratio: 39,
                responsibility_ratio: { plaintiff: 61, defendant: 39 },
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/psych-profile') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: null }),
        });
      }

      return route.fallback();
    });

    await page.goto('/case/case-review-e2e/review', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/判決已生成|Judgment Ready/)).toBeVisible();

    await page.getByRole('button', { name: /查看判決|View Judgment/ }).click();

    await expect(page).toHaveURL(/\/judgment\/judgment-case-review-e2e$/);
    await expect(page.getByText('Case review handoff judgment detail')).toBeVisible();
  });

  test('F07 -> F04：訪客 owner 從 chat 發起判決後應先登入，再回跳判決頁（P0-02）', async ({ page, baseURL }) => {
    const roomId = 'room-chat-handoff-e2e';
    const sessionId = 'guest-chat-owner-e2e';
    let claimSessionCalled = false;

    await seedGuestSession(page, sessionId, baseURL!);
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'POST' && pathname === '/api/v1/auth/login') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              token: 'token-chat-handoff',
              user: {
                id: 'user-chat-handoff',
                email: 'chat-handoff@example.com',
                nickname: 'ChatHandoff',
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
            data: { case_id: null },
          }),
        });
      }

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              room: {
                id: roomId,
                status: 'solo_active',
                owner_user_id: null,
                session_id: sessionId,
                history_visibility_mode: 'share_summary_only',
                participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true }],
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}/messages`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              messages: [
                {
                  id: 'msg-chat-handoff',
                  room_id: roomId,
                  sender_participant_id: 'p-a',
                  content: '請幫我整理這次對話後的判決',
                  message_type: 'user_text',
                  visibility_scope: 'all',
                  created_at: '2026-01-01T00:00:00.000Z',
                },
              ],
              nextCursor: null,
            },
          }),
        });
      }

      if (method === 'POST' && pathname === `/api/v1/chat/rooms/${roomId}/request-judgment`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgmentId: 'judgment-chat-handoff-e2e',
              roomId,
              status: 'judgment_requested',
            },
          }),
        });
      }

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}/stream`) {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: '聊天室連線授權異常',
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/judgments/judgment-chat-handoff-e2e') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              judgment: {
                id: 'judgment-chat-handoff-e2e',
                case_id: 'case-chat-handoff-e2e',
                judgment_content: 'Chat handoff judgment detail after login',
                plaintiff_ratio: 52,
                defendant_ratio: 48,
                responsibility_ratio: { plaintiff: 52, defendant: 48 },
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
        });
      }

      if (method === 'GET' && pathname === '/api/v1/psych-profile') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: null }),
        });
      }

      return route.fallback();
    });

    await page.goto(`/chat/room/${roomId}`);
    await expect(page.getByText(new RegExp(`聊天室：${roomId}|Room: ${roomId}|Chat Room: ${roomId}`))).toBeVisible();

    await page.getByRole('button', { name: /發起判決|Request Judgment/ }).click();
    await expect(page.getByText(/轉判決前確認|Confirm Before Judgment/)).toBeVisible();
    await page.getByRole('button', { name: /確認|Confirm/ }).click();

    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.locator('input[autocomplete="email"]').fill('chat-handoff@example.com');
    await page.locator('input[autocomplete="current-password"]').fill('Password123');
    await page.getByRole('button', { name: /登錄|Log In/ }).click();

    await expect(page).toHaveURL(/\/judgment\/judgment-chat-handoff-e2e$/);
    await expect(page.getByText('Chat handoff judgment detail after login')).toBeVisible();
    await expect.poll(() => claimSessionCalled).toBe(true);
  });
});
