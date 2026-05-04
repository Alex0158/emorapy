/**
 * NotificationService 單元測試（mock Prisma）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NotificationStatus, NotificationChannel } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  notification: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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
});
