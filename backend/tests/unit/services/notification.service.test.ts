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
  },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { NotificationService } from '../../../src/services/notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

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
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    });

    it('有 status 時應傳入 where.status', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);

      await service.list('u1', NotificationStatus.sent);

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: { user_id: 'u1', status: NotificationStatus.sent },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    });

    it('應返回查詢結果', async () => {
      const list = [
        { id: 'n1', user_id: 'u1', template_code: 'T1', status: NotificationStatus.pending },
      ];
      prismaMock.notification.findMany.mockResolvedValue(list);

      const result = await service.list('u1');

      expect(result).toEqual(list);
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
  });
});
