import type { Evidence } from '@emorapy/contracts/case';
import type { M1HttpClient } from './m1.js';
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
export declare function createNotificationsApi(http: M1HttpClient): {
    list(params?: ListNotificationsParams): Promise<ListNotificationsResult>;
    unreadCount(): Promise<number>;
    markRead(notificationId: string): Promise<NotificationItem>;
    markAllRead(): Promise<MarkAllNotificationsReadResult>;
    dismiss(notificationId: string): Promise<NotificationItem>;
    snooze(notificationId: string, hours?: number): Promise<NotificationItem>;
    act(notificationId: string, actionKey?: string): Promise<NotificationActionResult>;
    registerDeviceToken(input: RegisterPushDeviceTokenInput): Promise<PushDeviceToken>;
    revokeDeviceToken(input: RevokePushDeviceTokenInput): Promise<RevokePushDeviceTokenResult>;
};
export declare function createMediaUploadApi(http: M1HttpClient): {
    uploadEvidence(caseId: string, formData: FormData, sessionId?: string | null): Promise<Evidence[]>;
    deleteEvidence(caseId: string, evidenceId: string, sessionId?: string | null): Promise<void>;
};
export declare function createM5ApiClient(http: M1HttpClient): {
    media: {
        uploadEvidence(caseId: string, formData: FormData, sessionId?: string | null): Promise<Evidence[]>;
        deleteEvidence(caseId: string, evidenceId: string, sessionId?: string | null): Promise<void>;
    };
    notifications: {
        list(params?: ListNotificationsParams): Promise<ListNotificationsResult>;
        unreadCount(): Promise<number>;
        markRead(notificationId: string): Promise<NotificationItem>;
        markAllRead(): Promise<MarkAllNotificationsReadResult>;
        dismiss(notificationId: string): Promise<NotificationItem>;
        snooze(notificationId: string, hours?: number): Promise<NotificationItem>;
        act(notificationId: string, actionKey?: string): Promise<NotificationActionResult>;
        registerDeviceToken(input: RegisterPushDeviceTokenInput): Promise<PushDeviceToken>;
        revokeDeviceToken(input: RevokePushDeviceTokenInput): Promise<RevokePushDeviceTokenResult>;
    };
};
//# sourceMappingURL=m5.d.ts.map