import request from '../request';
import type { ApiResponse } from '@/types/common';
import type { RepairJourneyContext } from '@/types/repairJourney';

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

export const listNotifications = async (params?: {
  state?: NotificationFeedState;
  status?: 'pending' | 'sent' | 'failed';
  template_code?: string;
  limit?: number;
  cursor?: string;
}): Promise<ListNotificationsResult> => {
  const response = await request.get<ApiResponse<ListNotificationsResult>>('/notifications', { params });
  const data = (response.data as ApiResponse<ListNotificationsResult>)?.data;
  return {
    notifications: Array.isArray(data?.notifications) ? data.notifications : [],
    next_cursor: data?.next_cursor ?? null,
    has_more: Boolean(data?.has_more),
  };
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const response = await request.get<ApiResponse<{ unread_count: number }>>('/notifications/unread-count');
  const count = (response.data as ApiResponse<{ unread_count: number }>)?.data?.unread_count;
  return typeof count === 'number' ? count : 0;
};

export const markNotificationRead = async (notificationId: string): Promise<NotificationItem> => {
  const response = await request.post<ApiResponse<{ notification: NotificationItem }>>(`/notifications/${notificationId}/read`);
  const notification = (response.data as ApiResponse<{ notification: NotificationItem }>)?.data?.notification;
  if (!notification) throw new Error('Invalid mark read response from server');
  return notification;
};

export const markAllNotificationsRead = async (): Promise<{ updatedCount: number; readAt: string }> => {
  const response = await request.post<ApiResponse<{ updatedCount: number; readAt: string }>>('/notifications/read-all');
  const data = (response.data as ApiResponse<{ updatedCount: number; readAt: string }>)?.data;
  if (!data) throw new Error('Invalid mark all read response from server');
  return data;
};

export const dismissNotification = async (notificationId: string): Promise<NotificationItem> => {
  const response = await request.post<ApiResponse<{ notification: NotificationItem }>>(`/notifications/${notificationId}/dismiss`);
  const notification = (response.data as ApiResponse<{ notification: NotificationItem }>)?.data?.notification;
  if (!notification) throw new Error('Invalid dismiss response from server');
  return notification;
};

export const snoozeNotification = async (
  notificationId: string,
  hours?: number,
): Promise<NotificationItem> => {
  const response = await request.post<ApiResponse<{ notification: NotificationItem }>>(
    `/notifications/${notificationId}/snooze`,
    typeof hours === 'number' ? { hours } : undefined,
  );
  const notification = (response.data as ApiResponse<{ notification: NotificationItem }>)?.data?.notification;
  if (!notification) throw new Error('Invalid snooze response from server');
  return notification;
};

export const actOnNotification = async (
  notificationId: string,
  actionKey?: string,
): Promise<{ notification: NotificationItem; target: { path: string | null; action_key: string | null; entity_type: string | null; entity_id: string | null } }> => {
  const response = await request.post<ApiResponse<{
    notification: NotificationItem;
    target: { path: string | null; action_key: string | null; entity_type: string | null; entity_id: string | null };
  }>>(`/notifications/${notificationId}/act`, actionKey ? { action_key: actionKey } : undefined);
  const data = (response.data as ApiResponse<{
    notification: NotificationItem;
    target: { path: string | null; action_key: string | null; entity_type: string | null; entity_id: string | null };
  }>)?.data;
  if (!data) throw new Error('Invalid notification act response from server');
  return data;
};
