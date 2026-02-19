/**
 * 通知服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * NotificationService 符合此介面；Controller 可選改為依賴 INotificationService 並在建構時注入。
 */

import type { NotificationChannel, NotificationStatus } from '@prisma/client';

export interface CreateNotificationData {
  channel: NotificationChannel;
  template_code: string;
  payload?: Record<string, unknown>;
  dedup_key?: string;
}

export interface INotificationService {
  list(userId: string, status?: NotificationStatus): Promise<unknown[]>;

  create(userId: string, data: CreateNotificationData): Promise<unknown>;
}
