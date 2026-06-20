import type { Evidence } from '@emorapy/contracts/case';

import {
  isApiResponseEnvelope,
  readApiResponseError,
  toRequestError,
  type ApiResponseEnvelope,
} from './apiResponse.js';
import type { HttpResponse, M1HttpClient } from './m1.js';

export type NotificationFeedState = 'unread' | 'all' | 'actionable' | 'snoozed' | 'archived';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
export type NotificationChannel = 'email' | 'push';
export type NotificationPriority = 'now' | 'soon' | 'later' | string;

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
  channel: NotificationChannel;
  template_code: string;
  action_key: string | null;
  priority: NotificationPriority | null;
  group_key: string | null;
  status: NotificationStatus;
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
  journey_context: Record<string, unknown> | null;
  render_payload: NotificationRenderPayload;
}

export interface ListNotificationsParams {
  state?: NotificationFeedState;
  status?: NotificationStatus;
  template_code?: string;
  limit?: number;
  cursor?: string;
}

export interface ListNotificationsResult {
  notifications: NotificationItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface NotificationActionTarget {
  path: string | null;
  action_key: string | null;
  entity_type: string | null;
  entity_id: string | null;
}

export interface NotificationActionResult {
  notification: NotificationItem;
  target: NotificationActionTarget;
}

export interface MarkAllNotificationsReadResult {
  updatedCount: number;
  readAt: string;
}

export interface EvidenceUploadResult {
  evidences: Evidence[];
}

export interface RegisterPushDeviceTokenInput {
  token: string;
  platform: 'ios' | 'android';
  device_id?: string | null;
  app_version?: string | null;
  build_number?: string | null;
}

export interface PushDeviceToken {
  id: string;
  user_id: string;
  platform: 'ios' | 'android';
  device_id: string | null;
  app_version: string | null;
  build_number: string | null;
  revoked_at: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface RevokePushDeviceTokenInput {
  token?: string | null;
  device_id?: string | null;
}

export interface RevokePushDeviceTokenResult {
  revokedCount: number;
  revokedAt: string;
}

function unwrapResponse<T>(
  response: HttpResponse<ApiResponseEnvelope<T>>,
  fallbackMessage: string
): T {
  const body = response.data;
  if (!isApiResponseEnvelope(body)) {
    return body as T;
  }

  if (body.success) {
    if (body.data !== undefined && body.data !== null) return body.data as T;
    throw toRequestError('EMPTY_RESPONSE', fallbackMessage);
  }

  const bodyError = readApiResponseError(body);
  throw toRequestError(
    bodyError.code ?? 'API_ERROR',
    bodyError.message ?? fallbackMessage,
    bodyError.details
  );
}

function ensureValue<T>(value: T | null | undefined, code: string, message: string): T {
  if (value === undefined || value === null) {
    throw toRequestError(code, message);
  }
  return value;
}

function normalizeNotificationList(result: ListNotificationsResult | null | undefined): ListNotificationsResult {
  return {
    notifications: Array.isArray(result?.notifications) ? result.notifications : [],
    next_cursor: result?.next_cursor ?? null,
    has_more: Boolean(result?.has_more),
  };
}

export function createNotificationsApi(http: M1HttpClient) {
  return {
    async list(params?: ListNotificationsParams): Promise<ListNotificationsResult> {
      const response = await http.get<ApiResponseEnvelope<ListNotificationsResult>>('/notifications', { params });
      return normalizeNotificationList(unwrapResponse(response, 'Invalid notification list response from server'));
    },

    async unreadCount(): Promise<number> {
      const response = await http.get<ApiResponseEnvelope<{ unread_count: number }>>('/notifications/unread-count');
      const data = unwrapResponse(response, 'Invalid unread-count response from server');
      return typeof data.unread_count === 'number' ? data.unread_count : 0;
    },

    async markRead(notificationId: string): Promise<NotificationItem> {
      const response = await http.post<ApiResponseEnvelope<{ notification: NotificationItem }>>(
        `/notifications/${encodeURIComponent(notificationId)}/read`
      );
      const data = unwrapResponse(response, 'Invalid mark-read response from server');
      return ensureValue(data.notification, 'INVALID_NOTIFICATION_RESPONSE', 'Invalid mark-read response from server');
    },

    async markAllRead(): Promise<MarkAllNotificationsReadResult> {
      const response = await http.post<ApiResponseEnvelope<MarkAllNotificationsReadResult>>('/notifications/read-all');
      return unwrapResponse(response, 'Invalid mark-all-read response from server');
    },

    async dismiss(notificationId: string): Promise<NotificationItem> {
      const response = await http.post<ApiResponseEnvelope<{ notification: NotificationItem }>>(
        `/notifications/${encodeURIComponent(notificationId)}/dismiss`
      );
      const data = unwrapResponse(response, 'Invalid dismiss response from server');
      return ensureValue(data.notification, 'INVALID_NOTIFICATION_RESPONSE', 'Invalid dismiss response from server');
    },

    async snooze(notificationId: string, hours?: number): Promise<NotificationItem> {
      const response = await http.post<ApiResponseEnvelope<{ notification: NotificationItem }>>(
        `/notifications/${encodeURIComponent(notificationId)}/snooze`,
        typeof hours === 'number' ? { hours } : undefined
      );
      const data = unwrapResponse(response, 'Invalid snooze response from server');
      return ensureValue(data.notification, 'INVALID_NOTIFICATION_RESPONSE', 'Invalid snooze response from server');
    },

    async act(notificationId: string, actionKey?: string): Promise<NotificationActionResult> {
      const response = await http.post<ApiResponseEnvelope<NotificationActionResult>>(
        `/notifications/${encodeURIComponent(notificationId)}/act`,
        actionKey ? { action_key: actionKey } : undefined
      );
      const data = unwrapResponse(response, 'Invalid notification act response from server');
      ensureValue(data.notification, 'INVALID_NOTIFICATION_RESPONSE', 'Invalid notification act response from server');
      ensureValue(data.target, 'INVALID_NOTIFICATION_TARGET', 'Invalid notification act response from server');
      return data;
    },

    async registerDeviceToken(input: RegisterPushDeviceTokenInput): Promise<PushDeviceToken> {
      const response = await http.post<ApiResponseEnvelope<{ device_token: PushDeviceToken }>>(
        '/notifications/device-tokens',
        input
      );
      const data = unwrapResponse(response, 'Invalid push device token response from server');
      return ensureValue(data.device_token, 'INVALID_PUSH_DEVICE_TOKEN_RESPONSE', 'Invalid push device token response from server');
    },

    async revokeDeviceToken(input: RevokePushDeviceTokenInput): Promise<RevokePushDeviceTokenResult> {
      const response = await http.post<ApiResponseEnvelope<RevokePushDeviceTokenResult>>(
        '/notifications/device-tokens/revoke',
        input
      );
      return unwrapResponse(response, 'Invalid push device token revoke response from server');
    },
  };
}

export function createMediaUploadApi(http: M1HttpClient) {
  return {
    async uploadEvidence(caseId: string, formData: FormData, sessionId?: string | null): Promise<Evidence[]> {
      const response = await http.post<ApiResponseEnvelope<EvidenceUploadResult>>(
        `/cases/${encodeURIComponent(caseId)}/evidence`,
        formData,
        sessionId ? { headers: { 'X-Session-Id': sessionId } } : undefined
      );
      const data = unwrapResponse(response, 'Invalid evidence response from server');
      ensureValue(data.evidences, 'INVALID_EVIDENCE_RESPONSE', 'Invalid evidence response from server');
      return Array.isArray(data.evidences) ? data.evidences : [];
    },

    async deleteEvidence(caseId: string, evidenceId: string, sessionId?: string | null): Promise<void> {
      const response = await http.delete<ApiResponseEnvelope<unknown>>(
        `/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(evidenceId)}`,
        sessionId ? { headers: { 'X-Session-Id': sessionId } } : undefined
      );
      unwrapResponse(response, 'Invalid evidence delete response from server');
    },
  };
}

export function createM5ApiClient(http: M1HttpClient) {
  return {
    media: createMediaUploadApi(http),
    notifications: createNotificationsApi(http),
  };
}
