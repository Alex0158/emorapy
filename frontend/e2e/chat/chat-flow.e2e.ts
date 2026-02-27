import { expect, test } from '@playwright/test';

test.describe('Chat 多角色流程', () => {
  test('A 建房 -> 發話 -> 建邀請 -> 發起判決', async ({ page }) => {
    const roomId = 'room-e2e-a';
    let roomStatus = 'solo_active';
    const messages: Array<Record<string, unknown>> = [];

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

    await page.getByRole('button', { name: /發起判決|Request Judgment/ }).click();
    await expect(page.getByText(/已發起判決，正在等待結果|Judgment requested\. Waiting for result\./)).toBeVisible();
  });

  test('B 以邀請碼加入，並可在入口拒絕邀請', async ({ page }) => {
    const roomId = 'room-e2e-b';

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
    await page.getByRole('button', { name: /拒絕邀請|Decline Invite/ }).click();
    await expect(page.getByText(/已拒絕邀請|Invite declined/)).toBeVisible();
  });
});
