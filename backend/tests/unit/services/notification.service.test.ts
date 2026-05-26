/**
 * NotificationService 單元測試（mock Prisma）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NotificationStatus, NotificationChannel } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  notification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  pushDeviceToken: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockSendPushMessages = jest.fn();
const mockGetPushReceipts = jest.fn();
jest.mock('../../../src/services/push-notification.service', () => ({
  __esModule: true,
  pushNotificationService: {
    sendMessages: (...args: unknown[]) => mockSendPushMessages(...args),
    getReceipts: (...args: unknown[]) => mockGetPushReceipts(...args),
  },
  redactPushTokens: (input: string) => input.replace(/\b(?:Expo|Exponent)PushToken\[[^\]]+\]/g, '[push-token]'),
}));

import { NotificationService } from '../../../src/services/notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  const baseNotification = (overrides: Record<string, unknown> = {}) => ({
    id: 'n1',
    user_id: 'u1',
    template_code: 'repair_journey_choose_direction',
    action_key: null,
    priority: null,
    group_key: null,
    status: NotificationStatus.pending,
    error_message: null,
    payload: {},
    channel: NotificationChannel.email,
    created_at: new Date('2026-05-04T00:00:00.000Z'),
    sent_at: null,
    read_at: null,
    dismissed_at: null,
    acted_at: null,
    snoozed_until: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
    (mockSendPushMessages as any).mockResolvedValue([]);
    (mockGetPushReceipts as any).mockResolvedValue({});
  });

  describe('list', () => {
    it('無 status 時應查詢全部並限制 50 條', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      await service.list('u1');

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: { user_id: 'u1' },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 21,
      });
    });

    it('無通知時應返回空陣列（F09/F10 邊界：用戶尚未收到任何通知）', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      const result = await service.list('u1');

      expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
    });

    it('有 status 時應傳入 where.status', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      await service.list('u1', { status: NotificationStatus.sent });

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: { user_id: 'u1', status: NotificationStatus.sent },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 21,
      });
    });

    it('應返回查詢結果', async () => {
      const list = [
        { id: 'n1', user_id: 'u1', template_code: 'T1', status: NotificationStatus.pending },
      ];
      prismaMock.notification.findMany.mockResolvedValue(list);

      const result = await service.list('u1');

      expect(result).toEqual({
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'n1', template_code: 'T1' }),
        ]),
        nextCursor: null,
        hasMore: false,
      });
    });

    it('通知列表應從 payload.product_flow 輸出產品流', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        baseNotification({
          payload: {
            product_flow: 'chat_to_case',
            path: '/reconciliation/judge-1',
          },
        }),
      ]);

      const result = await service.list('u1');

      expect(result.items[0]?.render_payload.product_flow).toBe('chat_to_case');
    });

    it('通知列表遇到非法 payload.path 應保守輸出 null', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        baseNotification({
          payload: {
            path: 'https://evil.example/phishing',
          },
        }),
      ]);

      const result = await service.list('u1');

      expect(result.items[0]?.render_payload.path).toBeNull();
    });

    it('通知列表應從 journey_context.repair_access fallback 輸出產品流', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        baseNotification({
          payload: {
            journey_context: {
              repair_access: {
                product_flow: 'formal_collaborative',
              },
            },
          },
        }),
      ]);

      const result = await service.list('u1');

      expect(result.items[0]?.render_payload.product_flow).toBe('formal_collaborative');
    });
  });

  describe('create', () => {
    it('應創建通知並返回', async () => {
      const data = {
        template_code: 'welcome',
        payload: { name: 'U' },
        channel: NotificationChannel.email,
        dedup_key: 'key1',
      };
      prismaMock.notification.create.mockResolvedValue({
        id: 'n1',
        user_id: 'u1',
        template_code: data.template_code,
        payload: data.payload,
        channel: data.channel,
        dedup_key: data.dedup_key,
        status: NotificationStatus.pending,
      });

      const result = (await service.create('u1', data)) as { template_code: string; status: typeof NotificationStatus.pending };

      expect(result.template_code).toBe('welcome');
      expect(result.status).toBe(NotificationStatus.pending);
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          user_id: 'u1',
          template_code: data.template_code,
          payload: data.payload,
          channel: data.channel,
          dedup_key: data.dedup_key,
          status: NotificationStatus.pending,
        },
      });
    });

    it('無 payload 時應傳入空對象', async () => {
      prismaMock.notification.create.mockResolvedValue({});

      await service.create('u1', {
        template_code: 'T1',
        channel: NotificationChannel.push,
      });

      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'u1',
          template_code: 'T1',
          payload: {},
          channel: NotificationChannel.push,
          status: NotificationStatus.pending,
        }),
      });
    });

    it('應接受並修剪已允許的 payload.path', async () => {
      prismaMock.notification.create.mockResolvedValue({});

      await service.create('u1', {
        template_code: 'T1',
        channel: NotificationChannel.push,
        payload: { path: '  /execution/plan-1/checkin  ' },
      });

      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: { path: '/execution/plan-1/checkin' },
        }),
      });
    });

    it('應接受 chat invite landing payload.path 但不允許直接 accept side effect', async () => {
      prismaMock.notification.create.mockResolvedValue({});

      await service.create('u1', {
        template_code: 'T1',
        channel: NotificationChannel.push,
        payload: { path: '  /chat/invite/ABC123  ' },
      });

      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: { path: '/chat/invite/ABC123' },
        }),
      });

      await expect(service.create('u1', {
        template_code: 'T1',
        channel: NotificationChannel.push,
        payload: { path: '/chat/invites/ABC123/accept' },
      })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    });

    it('應將超過 schema 長度的 notification keys 穩定縮短，避免 repair journey 500', async () => {
      prismaMock.notification.create.mockResolvedValue({});
      const longDedupKey = `repair_journey_viewed_${'t'.repeat(36)}_${'u'.repeat(36)}_${new Date('2026-05-08T00:00:00.000Z').toISOString()}`;
      const longGroupKey = `repair_track_${'g'.repeat(120)}`;

      await service.create('u1', {
        template_code: 'repair_journey_partner_viewed',
        channel: NotificationChannel.push,
        dedup_key: longDedupKey,
        group_key: longGroupKey,
        payload: { path: '/execution/dashboard' },
      });

      const data = prismaMock.notification.create.mock.calls[0][0].data;
      expect(data.dedup_key).toHaveLength(100);
      expect(data.dedup_key).toMatch(/^repair_journey_viewed_/);
      expect(data.dedup_key).not.toBe(longDedupKey);
      expect(data.group_key).toHaveLength(100);
      expect(data.group_key).toMatch(/^repair_track_/);
    });

    it('應拒絕外部 payload.path', async () => {
      await expect(service.create('u1', {
        template_code: 'T1',
        channel: NotificationChannel.push,
        payload: { path: 'https://evil.example/phishing' },
      })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });

    it('應拒絕未列入前台路由白名單的 payload.path', async () => {
      await expect(service.create('u1', {
        template_code: 'T1',
        channel: NotificationChannel.push,
        payload: { path: '/admin/reports' },
      })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('markAsSent', () => {
    it('應更新狀態為 sent 並設定 sent_at', async () => {
      prismaMock.notification.update.mockResolvedValue({ id: 'n1', status: NotificationStatus.sent });

      await service.markAsSent('n1');

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: NotificationStatus.sent, sent_at: expect.any(Date) },
      });
    });

    it('notification 不存在時應拋錯（候選功能邊界：Prisma P2025 會由 errorHandler 轉為 404）', async () => {
      const p2025 = Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
      prismaMock.notification.update.mockRejectedValue(p2025);

      await expect(service.markAsSent('nonexistent')).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  describe('markFailed', () => {
    it('應更新狀態為 failed 並寫入錯誤訊息', async () => {
      prismaMock.notification.update.mockResolvedValue({ id: 'n1', status: NotificationStatus.failed });

      await service.markFailed('n1', 'SMTP timeout');

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: NotificationStatus.failed, error_message: 'SMTP timeout' },
      });
    });

    it('notification 不存在時應拋錯（候選功能邊界：Prisma P2025 會由 errorHandler 轉為 404）', async () => {
      const p2025 = Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
      prismaMock.notification.update.mockRejectedValue(p2025);

      await expect(service.markFailed('nonexistent', 'err')).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  describe('getPending', () => {
    it('應查詢 pending 通知並 include user 偏好', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      await service.getPending(10);

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: { status: NotificationStatus.pending },
        orderBy: { created_at: 'asc' },
        take: 10,
        include: { user: { select: { email: true, notification_enabled: true } } },
      });
    });

    it('預設 limit 為 50', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      await service.getPending();

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it('無待處理通知時應返回空陣列（F10 邊界：queue 為空）', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      const result = await service.getPending(10);

      expect(result).toEqual([]);
    });
  });

  describe('isNotificationEnabled', () => {
    it('用戶啟用通知時應返回 true', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ notification_enabled: true });

      const result = await service.isNotificationEnabled('u1');

      expect(result).toBe(true);
    });

    it('用戶停用通知時應返回 false', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ notification_enabled: false });

      const result = await service.isNotificationEnabled('u1');

      expect(result).toBe(false);
    });

    it('用戶不存在時應返回 false', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.isNotificationEnabled('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('createIfEnabled', () => {
    it('用戶啟用通知時應建立通知', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ notification_enabled: true });
      prismaMock.notification.create.mockResolvedValue({ id: 'n1' });

      const result = await service.createIfEnabled('u1', {
        template_code: 'T1',
        channel: NotificationChannel.email,
      });

      expect(result).toEqual({ id: 'n1' });
      expect(prismaMock.notification.create).toHaveBeenCalled();
    });

    it('用戶停用通知時應跳過並返回 null', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ notification_enabled: false });

      const result = await service.createIfEnabled('u1', {
        template_code: 'T1',
        channel: NotificationChannel.email,
      });

      expect(result).toBeNull();
      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });

    it('用戶不存在時應跳過並返回 null（F10 邊界：isNotificationEnabled 回傳 false）', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.createIfEnabled('nonexistent', {
        template_code: 'T1',
        channel: NotificationChannel.email,
      });

      expect(result).toBeNull();
      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('App notification state sync', () => {
    it('getUnreadCount 應排除已讀、已封存與仍在稍後提醒的通知', async () => {
      prismaMock.notification.count.mockResolvedValue(3);

      const result = await service.getUnreadCount('u1');

      expect(result).toBe(3);
      expect(prismaMock.notification.count).toHaveBeenCalledWith({
        where: {
          user_id: 'u1',
          read_at: null,
          dismissed_at: null,
          OR: [
            { snoozed_until: null },
            { snoozed_until: { lte: expect.any(Date) } },
          ],
        },
      });
    });

    it('markRead 只更新使用者自己的通知並保留既有 read_at', async () => {
      const readAt = new Date('2026-05-08T00:00:00.000Z');
      prismaMock.notification.findFirst.mockResolvedValue(baseNotification({ read_at: readAt }));
      prismaMock.notification.update.mockResolvedValue(baseNotification({ read_at: readAt }));

      const result = await service.markRead('u1', 'n1');

      expect(prismaMock.notification.findFirst).toHaveBeenCalledWith({
        where: { id: 'n1', user_id: 'u1' },
      });
      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { read_at: readAt },
      });
      expect(result).toMatchObject({ id: 'n1', unread: false });
    });

    it('markRead 找不到 owned notification 時返回 null', async () => {
      prismaMock.notification.findFirst.mockResolvedValue(null);

      await expect(service.markRead('u1', 'missing')).resolves.toBeNull();
      expect(prismaMock.notification.update).not.toHaveBeenCalled();
    });

    it('markAllRead 應只標記仍未讀且未封存的通知', async () => {
      prismaMock.notification.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.markAllRead('u1');

      expect(result).toEqual({ updatedCount: 2, readAt: expect.any(Date) });
      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: {
          user_id: 'u1',
          read_at: null,
          dismissed_at: null,
        },
        data: { read_at: expect.any(Date) },
      });
    });

    it('dismiss 應同時標記已讀、清除 snooze 並輸出 archived item', async () => {
      prismaMock.notification.findFirst.mockResolvedValue(baseNotification());
      prismaMock.notification.update.mockResolvedValue(baseNotification({
        read_at: new Date('2026-05-08T00:00:00.000Z'),
        dismissed_at: new Date('2026-05-08T00:00:00.000Z'),
        snoozed_until: null,
      }));

      const result = await service.dismiss('u1', 'n1');

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          dismissed_at: expect.any(Date),
          read_at: expect.any(Date),
          snoozed_until: null,
        },
      });
      expect(result).toMatchObject({ id: 'n1', unread: false, actionable: false });
    });

    it('snooze 應限制 hours 範圍並標記已讀', async () => {
      prismaMock.notification.findFirst.mockResolvedValue(baseNotification());
      prismaMock.notification.update.mockResolvedValue(baseNotification({
        read_at: new Date('2026-05-08T00:00:00.000Z'),
        snoozed_until: new Date('2026-05-15T00:00:00.000Z'),
      }));

      const result = await service.snooze('u1', 'n1', 999);

      const updateArg = prismaMock.notification.update.mock.calls[0][0];
      expect(updateArg).toMatchObject({
        where: { id: 'n1' },
        data: {
          snoozed_until: expect.any(Date),
          read_at: expect.any(Date),
        },
      });
      const deltaHours = (updateArg.data.snoozed_until.getTime() - updateArg.data.read_at.getTime()) / (60 * 60 * 1000);
      expect(deltaHours).toBeCloseTo(168, 1);
      expect(result).toMatchObject({ id: 'n1', unread: false, actionable: true });
    });

    it('act 應標記 acted/read 並回傳可被 App Deep Link resolver 使用的 target', async () => {
      prismaMock.notification.findFirst.mockResolvedValue(baseNotification({
        action_key: 'continue_today_step',
        payload: {
          path: '/execution/plan-1/checkin',
          repair_track_id: 'track-1',
        },
      }));
      prismaMock.notification.update.mockResolvedValue(baseNotification({
        action_key: 'continue_today_step',
        read_at: new Date('2026-05-08T00:00:00.000Z'),
        acted_at: new Date('2026-05-08T00:00:00.000Z'),
        payload: {
          path: '/execution/plan-1/checkin',
          repair_track_id: 'track-1',
        },
      }));

      const result = await service.act('u1', 'n1', 'continue_today_step');

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          acted_at: expect.any(Date),
          read_at: expect.any(Date),
          snoozed_until: null,
          action_key: 'continue_today_step',
        },
      });
      expect(result).toMatchObject({
        notification: { id: 'n1', unread: false, actionable: false },
        target: {
          path: '/execution/plan-1/checkin',
          action_key: 'continue_today_step',
          entity_type: 'repair_track',
          entity_id: 'track-1',
        },
      });
    });
  });

  describe('App push device token lifecycle', () => {
    it('registerDeviceToken 應 upsert token 並且不回傳原始 token', async () => {
      prismaMock.pushDeviceToken.upsert.mockResolvedValue({
        id: 'pdt-1',
        user_id: 'u1',
        token: 'ExpoPushToken[test]',
        platform: 'ios',
        device_id: 'device-1',
        app_version: '1.3.1',
        build_number: '42',
        revoked_at: null,
        last_seen_at: new Date('2026-05-08T00:00:00.000Z'),
        created_at: new Date('2026-05-08T00:00:00.000Z'),
        updated_at: new Date('2026-05-08T00:00:00.000Z'),
      });

      const result = await service.registerDeviceToken('u1', {
        token: '  ExpoPushToken[test]  ',
        platform: 'ios',
        device_id: ' device-1 ',
        app_version: ' 1.3.1 ',
        build_number: ' 42 ',
      });

      expect(prismaMock.pushDeviceToken.upsert).toHaveBeenCalledWith({
        where: { token: 'ExpoPushToken[test]' },
        create: expect.objectContaining({
          user_id: 'u1',
          token: 'ExpoPushToken[test]',
          platform: 'ios',
          device_id: 'device-1',
          app_version: '1.3.1',
          build_number: '42',
          last_seen_at: expect.any(Date),
        }),
        update: expect.objectContaining({
          user_id: 'u1',
          platform: 'ios',
          device_id: 'device-1',
          app_version: '1.3.1',
          build_number: '42',
          revoked_at: null,
          last_seen_at: expect.any(Date),
        }),
      });
      expect(result).toEqual(expect.objectContaining({
        id: 'pdt-1',
        user_id: 'u1',
        platform: 'ios',
        device_id: 'device-1',
      }));
      expect(result).not.toHaveProperty('token');
    });

    it('revokeDeviceToken 應支援 token 與 device_id 篩選並只撤銷當前使用者未撤銷 token', async () => {
      prismaMock.pushDeviceToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.revokeDeviceToken('u1', {
        token: ' ExpoPushToken[test] ',
        device_id: ' device-1 ',
      });

      expect(result).toEqual({ revokedCount: 1, revokedAt: expect.any(Date) });
      expect(prismaMock.pushDeviceToken.updateMany).toHaveBeenCalledWith({
        where: {
          user_id: 'u1',
          revoked_at: null,
          token: 'ExpoPushToken[test]',
          device_id: 'device-1',
        },
        data: {
          revoked_at: expect.any(Date),
        },
      });
    });

    it('revokeDeviceToken 缺少 token 與 device_id 時應拒絕', async () => {
      await expect(service.revokeDeviceToken('u1', {})).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(prismaMock.pushDeviceToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('App push provider delivery', () => {
    it('dispatchPendingPushNotifications 應把 pending push notification 發到 Expo provider 並標記 sent', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        baseNotification({
          channel: NotificationChannel.push,
          payload: {
            path: '/execution/plan-1/checkin',
            repair_track_id: 'track-1',
          },
          user: {
            notification_enabled: true,
            push_device_tokens: [{ token: 'ExpoPushToken[test]', platform: 'ios' }],
          },
        }),
      ]);
      (mockSendPushMessages as any).mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
      prismaMock.notification.update.mockResolvedValue(baseNotification({ status: NotificationStatus.sent }));

      const result = await service.dispatchPendingPushNotifications(10);

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: {
          channel: NotificationChannel.push,
          status: NotificationStatus.pending,
        },
        orderBy: { created_at: 'asc' },
        take: 10,
        include: {
          user: {
            select: {
              notification_enabled: true,
              push_device_tokens: {
                where: { revoked_at: null },
                select: { token: true, platform: true },
              },
            },
          },
        },
      });
      expect(mockSendPushMessages).toHaveBeenCalledWith([
        expect.objectContaining({
          to: 'ExpoPushToken[test]',
          title: '先選一個方向',
          data: expect.objectContaining({
            notification_id: 'n1',
            path: '/execution/plan-1/checkin',
            target_path: '/execution/plan-1/checkin',
            action_key: 'open_reconciliation_entry',
            entity_type: 'repair_track',
            entity_id: 'track-1',
          }),
        }),
      ]);
      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          status: NotificationStatus.sent,
          sent_at: expect.any(Date),
          error_message: null,
          push_provider: 'expo',
          push_ticket_id: 'ticket-1',
          push_ticket_status: 'ok',
          push_receipt_status: 'pending',
          push_receipt_checked_at: null,
          push_receipt_error: null,
        },
      });
      expect(result).toEqual({ scannedCount: 1, sentCount: 1, failedCount: 0, ticketCount: 1 });
    });

    it('dispatchPendingPushNotifications 沒有 active token 時應標記 failed 且不呼叫 provider', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        baseNotification({
          channel: NotificationChannel.push,
          user: {
            notification_enabled: true,
            push_device_tokens: [],
          },
        }),
      ]);
      prismaMock.notification.update.mockResolvedValue(baseNotification({ status: NotificationStatus.failed }));

      const result = await service.dispatchPendingPushNotifications();

      expect(mockSendPushMessages).not.toHaveBeenCalled();
      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          status: NotificationStatus.failed,
          error_message: 'no_active_push_device_token',
        },
      });
      expect(result).toEqual({ scannedCount: 1, sentCount: 0, failedCount: 1, ticketCount: 0 });
    });

    it('dispatchPendingPushNotifications provider error 應清洗 push token 後寫入 failure', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        baseNotification({
          channel: NotificationChannel.push,
          user: {
            notification_enabled: true,
            push_device_tokens: [{ token: 'ExpoPushToken[secret-token]', platform: 'ios' }],
          },
        }),
      ]);
      (mockSendPushMessages as any).mockRejectedValue(new Error('failed for ExpoPushToken[secret-token]'));
      prismaMock.notification.update.mockResolvedValue(baseNotification({ status: NotificationStatus.failed }));

      await service.dispatchPendingPushNotifications();

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          status: NotificationStatus.failed,
          error_message: 'failed for [push-token]',
          push_provider: 'expo',
          push_ticket_status: 'error',
          push_receipt_status: 'error',
          push_receipt_checked_at: expect.any(Date),
          push_receipt_error: 'failed for [push-token]',
        },
      });
    });

    it('dispatchPendingPushNotifications provider ticket error 應回寫 ticket/receipt failure metadata', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        baseNotification({
          channel: NotificationChannel.push,
          user: {
            notification_enabled: true,
            push_device_tokens: [{ token: 'ExpoPushToken[test]', platform: 'ios' }],
          },
        }),
      ]);
      (mockSendPushMessages as any).mockResolvedValue([
        { status: 'error', message: 'Device not registered', details: { error: 'DeviceNotRegistered' } },
      ]);
      prismaMock.notification.update.mockResolvedValue(baseNotification({ status: NotificationStatus.failed }));

      const result = await service.dispatchPendingPushNotifications();

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          status: NotificationStatus.failed,
          error_message: 'Device not registered (DeviceNotRegistered)',
          push_provider: 'expo',
          push_ticket_status: 'error',
          push_receipt_status: 'error',
          push_receipt_checked_at: expect.any(Date),
          push_receipt_error: 'Device not registered (DeviceNotRegistered)',
        },
      });
      expect(result).toEqual({ scannedCount: 1, sentCount: 0, failedCount: 1, ticketCount: 1 });
    });

    it('pollPushNotificationReceipts 應把 ok receipt 回寫為 ok', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        { id: 'n1', push_ticket_id: 'ticket-1', push_receipt_status: 'pending' },
      ]);
      (mockGetPushReceipts as any).mockResolvedValue({
        'ticket-1': { status: 'ok' },
      });
      prismaMock.notification.update.mockResolvedValue(baseNotification({ status: NotificationStatus.sent }));

      const result = await service.pollPushNotificationReceipts(20);

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: {
          channel: NotificationChannel.push,
          status: NotificationStatus.sent,
          push_ticket_id: { not: null },
          OR: [
            { push_receipt_status: null },
            { push_receipt_status: 'pending' },
          ],
        },
        orderBy: [
          { sent_at: 'asc' },
          { created_at: 'asc' },
        ],
        take: 20,
        select: {
          id: true,
          push_ticket_id: true,
          push_receipt_status: true,
        },
      });
      expect(mockGetPushReceipts).toHaveBeenCalledWith(['ticket-1']);
      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          push_receipt_status: 'ok',
          push_receipt_checked_at: expect.any(Date),
          push_receipt_error: null,
        },
      });
      expect(result).toEqual({ scannedCount: 1, receiptCount: 1, okCount: 1, failedCount: 0, pendingCount: 0 });
    });

    it('pollPushNotificationReceipts 應把 error receipt 回寫 failed 且保留 provider reason', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        { id: 'n1', push_ticket_id: 'ticket-1', push_receipt_status: 'pending' },
      ]);
      (mockGetPushReceipts as any).mockResolvedValue({
        'ticket-1': {
          status: 'error',
          message: 'The device cannot receive notifications',
          details: { error: 'DeviceNotRegistered' },
        },
      });
      prismaMock.notification.update.mockResolvedValue(baseNotification({ status: NotificationStatus.failed }));

      const result = await service.pollPushNotificationReceipts();

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          status: NotificationStatus.failed,
          error_message: 'The device cannot receive notifications (DeviceNotRegistered)',
          push_receipt_status: 'error',
          push_receipt_checked_at: expect.any(Date),
          push_receipt_error: 'The device cannot receive notifications (DeviceNotRegistered)',
        },
      });
      expect(result).toEqual({ scannedCount: 1, receiptCount: 1, okCount: 0, failedCount: 1, pendingCount: 0 });
    });

    it('pollPushNotificationReceipts 缺少 receipt 時應保持 pending 並只記錄 checked_at', async () => {
      prismaMock.notification.findMany.mockResolvedValue([
        { id: 'n1', push_ticket_id: 'ticket-1', push_receipt_status: 'pending' },
      ]);
      (mockGetPushReceipts as any).mockResolvedValue({});
      prismaMock.notification.update.mockResolvedValue(baseNotification({ status: NotificationStatus.sent }));

      const result = await service.pollPushNotificationReceipts();

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          push_receipt_status: 'pending',
          push_receipt_checked_at: expect.any(Date),
        },
      });
      expect(result).toEqual({ scannedCount: 1, receiptCount: 0, okCount: 0, failedCount: 0, pendingCount: 1 });
    });
  });
});
