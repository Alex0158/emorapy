import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const JOIN_INPUT = /輸入邀請碼|Enter invite code/;
const JOIN_BUTTON = /用邀請碼加入|Join with Invite Code/;
const MESSAGE_INPUT = /輸入訊息|Type a message/;
const SEND_BUTTON = /送\s*出|Send/;
const CREATE_INVITE_BUTTON = /建立邀請|Create Invite/;
const CREATE_ROOM_BUTTON = /建立聊天室|Create Room/;
const SESSION_STORAGE_KEY = 'cj_session_id';

async function setChatSession(page: Page, sessionId: string, baseURL: string) {
  await page.goto(baseURL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ key, sid }: { key: string; sid: string }) => {
      localStorage.setItem(key, sid);
    },
    { key: SESSION_STORAGE_KEY, sid: sessionId }
  );
}

async function mockRoomReadApis(
  page: Page,
  roomId: string,
  streamStatus = 403,
  streamMessage = '聊天室連線授權異常',
  sessionId?: string
) {
  await page.route('**/api/v1/chat/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}`) {
      const room: Record<string, unknown> = {
        id: roomId,
        status: 'group_active',
        history_visibility_mode: 'share_full_history',
        participants: [],
      };
      if (sessionId) room.session_id = sessionId;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { room },
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
        status: streamStatus,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: streamStatus === 429 ? 'RATE_LIMIT_EXCEEDED' : 'FORBIDDEN',
            message: streamMessage,
          },
        }),
      });
    }

    return route.fallback();
  });
}

test.describe('Chat 失敗矩陣', () => {
  test('401：邀請碼加入失敗應提示 session 類錯誤', async ({ page }) => {
    await page.route('**/api/v1/chat/invites/401CASE/accept', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session 已過期',
          },
        }),
      });
    });

    await page.goto('/chat/room');
    await page.getByPlaceholder(JOIN_INPUT).fill('401CASE');
    await page.getByRole('button', { name: JOIN_BUTTON }).click();
    await expect(page.getByText(/Session 已過期|Session expired/i).first()).toBeVisible();
  });

  test('403：聊天室發言被拒應提示無發言權限', async ({ page }) => {
    const roomId = 'room-403';
    await mockRoomReadApis(page, roomId, 403, '聊天室連線授權異常');
    await page.route(`**/api/v1/chat/rooms/${roomId}/messages`, async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'forbidden',
          },
        }),
      });
    });

    await page.goto(`/chat/room/${roomId}`);
    await page.getByPlaceholder(MESSAGE_INPUT).fill('測試 403');
    await page.getByRole('button', { name: SEND_BUTTON }).click();
    await expect(page.getByText(/目前沒有發言權限|You are not allowed to send messages now/)).toBeVisible();
  });

  test('409：建立邀請衝突應提示已自動刷新', async ({ page }) => {
    const roomId = 'room-409';
    const sessionId = 'e2e-session-409';
    await setChatSession(page, sessionId, 'http://127.0.0.1:4173');
    await mockRoomReadApis(page, roomId, 403, '聊天室連線授權異常', sessionId);
    await page.route(`**/api/v1/chat/rooms/${roomId}/invites`, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'conflict',
          },
        }),
      });
    });

    await page.goto(`/chat/room/${roomId}`);
    await page.getByRole('button', { name: CREATE_INVITE_BUTTON }).click();
    await expect(page.getByText(/聊天室狀態已更新，已自動刷新|Room state changed\. Refreshed automatically\./)).toBeVisible();
  });

  test('400：建立邀請 session 失配應提示 invalid session（P0-03）', async ({ page }) => {
    const roomId = 'room-invalid-session';
    const sessionId = 'e2e-session-invalid';
    await setChatSession(page, sessionId, 'http://127.0.0.1:4173');
    await mockRoomReadApis(page, roomId, 403, '聊天室連線授權異常', sessionId);
    await page.route(`**/api/v1/chat/rooms/${roomId}/invites`, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_SESSION_ID',
            message: 'owner session mismatch',
          },
        }),
      });
    });

    await page.goto(`/chat/room/${roomId}`);
    await page.getByRole('button', { name: CREATE_INVITE_BUTTON }).click();
    await expect(page.getByText(/Session 已過期或不一致，請刷新後重試|Session is invalid or expired\. Please refresh and retry\./)).toBeVisible();
  });

  test('404：弱入口直連不存在聊天室時應顯示錯誤並保留返回入口', async ({ page }) => {
    const roomId = 'room-expired';

    await page.route('**/api/v1/chat/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}`) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: '房間不存在或已封存',
            },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto(`/chat/room/${roomId}`);
    await expect(page.getByText(/房間不存在或已封存|Failed to load chat room/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /返回聊天室入口|Back to Chat Entry/ })).toBeVisible();
  });

  test('429：聊天室串流超限應顯示流控錯誤訊息', async ({ page }) => {
    const roomId = 'room-429';
    await mockRoomReadApis(page, roomId, 429, '聊天室即時連線已達上限，請稍後重試');
    await page.goto(`/chat/room/${roomId}`);
    await expect(
      page.getByText(/聊天室即時連線已達上限，請稍後重試|Chat stream rate-limited\. Please try again shortly\./),
    ).toBeVisible();
  });

  test('404：弱入口直連已失效房間應顯示 room unavailable 提示（P0-03）', async ({ page }) => {
    const roomId = 'room-404';
    await page.route('**/api/v1/chat/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}`) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'NOT_FOUND' },
          }),
        });
      }

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}/messages`) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'NOT_FOUND' },
          }),
        });
      }

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}/stream`) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'NOT_FOUND', message: 'room not found' },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto(`/chat/room/${roomId}`);
    await expect(
      page.getByText(/聊天室不存在或已失效，請返回入口重新進入|Chat room no longer exists or has expired\. Please return to the entry page\./),
    ).toBeVisible();
    await expect(page.getByText(/返回聊天室入口|Back to Chat Entry/)).toBeVisible();
  });

  test('getChatRoom 失敗時應顯示錯誤、點擊 retry 成功後應顯示聊天室（F07 錯誤恢復）', async ({ page }) => {
    const roomId = 'room-e2e-retry';
    const roomBasePath = `/api/v1/chat/rooms/${roomId}`;
    let initialLoadCallCount = 0;

    await page.route('**/api/v1/chat/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      const isRoomDetail = pathname === roomBasePath || pathname === `${roomBasePath}/`;
      const isRoomMessages = pathname.startsWith(`${roomBasePath}/messages`);
      if (method === 'GET' && (isRoomDetail || isRoomMessages)) {
        initialLoadCallCount++;
        if (initialLoadCallCount === 1) {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { code: 'INTERNAL_ERROR', message: '載入失敗' },
            }),
          });
        }
      }

      if (method === 'GET' && isRoomDetail) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              room: {
                id: roomId,
                status: 'solo_active',
                history_visibility_mode: 'share_full_history',
                participants: [],
              },
            },
          }),
        });
      }

      if (method === 'GET' && isRoomMessages) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { messages: [], nextCursor: null },
          }),
        });
      }

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}/stream`) {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'FORBIDDEN', message: '授權異常' },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto(`/chat/room/${roomId}`);
    await expect(page.getByText(/載入失敗|Failed to load chat room/)).toBeVisible({ timeout: 6000 });

    const retryByTestId = page.getByTestId('chat-room-load-retry');
    if ((await retryByTestId.count()) > 0 && (await retryByTestId.isVisible())) {
      await retryByTestId.click();
    } else {
      await expect(
        page.getByText(new RegExp(`Room:\\s*${roomId}|聊天室：\\s*${roomId}`))
      ).toBeVisible({ timeout: 6000 });
    }

    await expect(page.getByRole('button', { name: /建立邀請|Create Invite/ })).toBeVisible({ timeout: 8000 });
  });

  test('createChatRoom 失敗時應顯示錯誤、可再次點擊建立且成功導向聊天室（F07 錯誤恢復）', async ({ page }) => {
    const roomId = 'room-e2e-create-retry';
    let createRoomCallCount = 0;

    await page.route('**/api/v1/chat/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      if (method === 'POST' && pathname === '/api/v1/chat/rooms') {
        createRoomCallCount++;
        if (createRoomCallCount === 1) {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { code: 'INTERNAL_ERROR', message: '建立失敗' },
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              room: {
                id: roomId,
                status: 'solo_active',
                history_visibility_mode: 'share_full_history',
                participants: [],
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
                status: 'solo_active',
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
            data: { messages: [], nextCursor: null },
          }),
        });
      }

      if (method === 'GET' && pathname === `/api/v1/chat/rooms/${roomId}/stream`) {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'FORBIDDEN', message: '授權異常' },
          }),
        });
      }

      return route.fallback();
    });

    await page.goto('/chat/room');
    await page.getByRole('button', { name: CREATE_ROOM_BUTTON }).click();
    await expect(page.getByText(/建立失敗|建立聊天室失敗|Create room failed|Internal error/i).first()).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: CREATE_ROOM_BUTTON }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/room/${roomId}`), { timeout: 10000 });
    await expect(page.getByRole('button', { name: /建立邀請|Create Invite/ })).toBeVisible({ timeout: 8000 });
  });
});
