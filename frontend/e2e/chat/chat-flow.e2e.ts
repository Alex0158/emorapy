import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const SESSION_STORAGE_KEY = 'cj_session_id';
const REQUEST_ANALYSIS_BUTTON = /發起梳理|發起判決|Request Analysis|Request Judgment/;
const CONFIRM_ANALYSIS_TITLE = /轉梳理前確認|轉判決前確認|Confirm Before Analysis|Confirm Before Judgment/;
const ANALYSIS_REQUESTED_TEXT = /梳理請求中|判決請求中|Analysis requested|Judgment requested/;

async function setChatSession(page: Page, sessionId: string, baseURL: string) {
  await page.goto(baseURL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ key, sid }: { key: string; sid: string }) => {
      localStorage.setItem(key, sid);
    },
    { key: SESSION_STORAGE_KEY, sid: sessionId }
  );
}

test.describe('Chat 多角色流程', () => {
  test('A 建房 -> 發話 -> 建邀請 -> 發起判決', async ({ page }) => {
    const roomId = 'room-e2e-a';
    const sessionId = 'e2e-session-flow-a';
    let roomStatus = 'solo_active';
    const messages: Array<Record<string, unknown>> = [];

    await setChatSession(page, sessionId, 'http://127.0.0.1:4173');
    await page.route('**/api/v1/chat/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'POST' && pathname === '/api/v1/chat/rooms') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              room: {
                id: roomId,
                status: roomStatus,
                history_visibility_mode: 'share_full_history',
                participants: [],
                session_id: sessionId,
              },
            },
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
                status: roomStatus,
                history_visibility_mode: 'share_full_history',
                participants: [],
                session_id: sessionId,
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
              messages,
              nextCursor: null,
            },
          }),
        });
      }

      if (method === 'POST' && pathname === `/api/v1/chat/rooms/${roomId}/messages`) {
        const body = route.request().postDataJSON() as { content?: string };
        const message = {
          id: `msg-${messages.length + 1}`,
          room_id: roomId,
          sender_participant_id: 'p-a',
          content: body.content || '',
          message_type: 'user_text',
          visibility_scope: 'all',
          created_at: new Date().toISOString(),
        };
        messages.push(message);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              message,
            },
          }),
        });
      }

      if (method === 'POST' && pathname === `/api/v1/chat/rooms/${roomId}/invites`) {
        roomStatus = 'invite_pending';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              invite: {
                id: 'inv-a',
                room_id: roomId,
                status: 'pending',
                invite_code: 'FLOWA1',
              },
            },
          }),
        });
      }

      if (method === 'POST' && pathname === `/api/v1/chat/rooms/${roomId}/request-judgment`) {
        roomStatus = 'judgment_requested';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              roomId,
              caseId: 'case-a',
              linkId: 'link-a',
              status: 'judgment_requested',
            },
          }),
        });
      }

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}/judgment-status`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              roomStatus: roomStatus,
              latestLink: {
                id: 'link-a',
                case: { id: 'case-a', status: 'in_progress' },
                judgment: null,
              },
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

      return route.fallback();
    });

    await page.goto('/chat/room');
    await page.getByRole('button', { name: /建立聊天室|Create Room/ }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/room/${roomId}$`));

    await page.getByPlaceholder(/輸入訊息|Type a message/).fill('先整理一下我的感受');
    await page.getByRole('button', { name: /送\s*出|Send/ }).click();
    await expect(page.getByText('先整理一下我的感受')).toBeVisible();

    await page.getByRole('button', { name: /建立邀請|Create Invite/ }).click();
    await expect(page.getByText(/邀請碼：FLOWA1|Invite Code:\s*FLOWA1/)).toBeVisible();

    await page.getByRole('button', { name: REQUEST_ANALYSIS_BUTTON }).click();
    await expect(page.getByText(CONFIRM_ANALYSIS_TITLE)).toBeVisible();
    await page.getByRole('button', { name: /確認|Confirm/ }).click();
    await expect(page.getByText(ANALYSIS_REQUESTED_TEXT).first()).toBeVisible({ timeout: 10000 });
  });

  test('已登入 B 以邀請碼加入，並可在入口拒絕邀請', async ({ page }) => {
    const roomId = 'room-e2e-b';

    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token-b');
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 'user-b',
            email: 'b@example.com',
            nickname: 'B',
          },
        },
        version: 0,
      }));
    });

    await page.route('**/api/v1/user/profile', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'user-b',
              email: 'b@example.com',
              nickname: 'B',
            },
          },
        }),
      });
    });

    await page.route('**/api/v1/chat/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'POST' && pathname === '/api/v1/chat/invites/FLOWJOIN/accept') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              room: {
                id: roomId,
                status: 'group_active',
                history_visibility_mode: 'share_full_history',
                participants: [],
              },
            },
          }),
        });
      }

      if (method === 'POST' && pathname === '/api/v1/chat/invites/FLOWNOPE/decline') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              invite: {
                id: 'inv-nope',
                room_id: 'room-nope',
                status: 'declined',
              },
            },
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
                status: 'group_active',
                history_visibility_mode: 'share_full_history',
                participants: [],
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
              messages: [],
              nextCursor: null,
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

      return route.fallback();
    });

    await page.goto('/chat/room');
    await page.getByPlaceholder(/輸入邀請碼|Enter invite code/).fill('FLOWJOIN');
    await page.getByRole('button', { name: /用邀請碼加入|Join with Invite Code/ }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/room/${roomId}$`));

    await page.goto('/chat/room');
    await page.getByPlaceholder(/輸入邀請碼|Enter invite code/).fill('FLOWNOPE');
    const declineResponse = page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/v1/chat/invites/FLOWNOPE/decline') &&
      response.ok()
    );
    await page.getByRole('button', { name: /拒絕邀請|Decline Invite/ }).click();
    await declineResponse;
  });
});
