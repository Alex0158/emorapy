import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const JOIN_INPUT = /輸入邀請碼|Enter invite code/;
const JOIN_BUTTON = /用邀請碼加入|Join with Invite Code/;
const MESSAGE_INPUT = /輸入訊息|Type a message/;
const SEND_BUTTON = /送\s*出|Send/;
const CREATE_INVITE_BUTTON = /建立邀請|Create Invite/;

async function mockRoomReadApis(page: Page, roomId: string, streamStatus = 403, streamMessage = '聊天室連線授權異常') {
  await page.route('**/api/v1/chat/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

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
    await mockRoomReadApis(page, roomId, 403, '聊天室連線授權異常');
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

  test('429：聊天室串流超限應顯示流控錯誤訊息', async ({ page }) => {
    const roomId = 'room-429';
    await mockRoomReadApis(page, roomId, 429, '聊天室即時連線已達上限，請稍後重試');
    await page.goto(`/chat/room/${roomId}`);
    await expect(
      page.getByText(/聊天室即時連線已達上限，請稍後重試|Chat stream rate-limited\. Please try again shortly\./),
    ).toBeVisible();
  });
});
