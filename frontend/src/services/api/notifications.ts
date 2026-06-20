import { createM5ApiClient } from '@emorapy/api-client';
import type { RepairJourneyContext } from '@/types/repairJourney';
import request from '../request';

export type NotificationFeedState = 'unread' | 'all' | 'actionable' | 'snoozed' | 'archived';

export interface NotificationRenderPayload {
  title: string;
  body: string;
  path: string | null;
  cta_label: string | null;
  entity_type: string | null;
  entity_id: string | null;
  journey_status: string | null;
  track_id: string | null;
  plan_id: string | null;
  judgment_id: string | null;
  case_id: string | null;
  priority: string | null;
  partner_state: string | null;
  reason_code: string | null;
}

export interface NotificationItem {
  id: string;
  channel: 'email' | 'push';
  template_code: string;
  action_key: string | null;
  priority: string | null;
  group_key: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  acted_at: string | null;
  snoozed_until: string | null;
  unread: boolean;
  actionable: boolean;
  payload: Record<string, unknown>;
  journey_context: RepairJourneyContext | null;
  render_payload: NotificationRenderPayload;
}

export interface ListNotificationsResult {
  notifications: NotificationItem[];
  next_cursor: string | null;
  has_more: boolean;
}

const sharedNotificationsApi = createM5ApiClient(request).notifications;

export const listNotifications = async (params?: {
  state?: NotificationFeedState;
  status?: 'pending' | 'sent' | 'failed';
  template_code?: string;
  limit?: number;
  cursor?: string;
}): Promise<ListNotificationsResult> => {
  return sharedNotificationsApi.list(params) as Promise<ListNotificationsResult>;
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  return sharedNotificationsApi.unreadCount();
};

export const markNotificationRead = async (notificationId: string): Promise<NotificationItem> => {
  return sharedNotificationsApi.markRead(notificationId) as Promise<NotificationItem>;
};

export const markAllNotificationsRead = async (): Promise<{ updatedCount: number; readAt: string }> => {
  return sharedNotificationsApi.markAllRead();
};

export const dismissNotification = async (notificationId: string): Promise<NotificationItem> => {
  return sharedNotificationsApi.dismiss(notificationId) as Promise<NotificationItem>;
};

export const snoozeNotification = async (
  notificationId: string,
  hours?: number,
): Promise<NotificationItem> => {
  return sharedNotificationsApi.snooze(notificationId, hours) as Promise<NotificationItem>;
};

export const actOnNotification = async (
  notificationId: string,
  actionKey?: string,
): Promise<{ notification: NotificationItem; target: { path: string | null; action_key: string | null; entity_type: string | null; entity_id: string | null } }> => {
  return sharedNotificationsApi.act(notificationId, actionKey) as Promise<{
    notification: NotificationItem;
    target: { path: string | null; action_key: string | null; entity_type: string | null; entity_id: string | null };
  }>;
};
