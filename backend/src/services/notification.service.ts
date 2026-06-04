import prisma from '../config/database';
import { Prisma, NotificationChannel, NotificationStatus } from '@prisma/client';
import crypto from 'crypto';
import logger from '../config/logger';
import { isCaseProductFlow, type CaseProductFlow } from '../utils/case-classifier';
import { Errors } from '../utils/errors';
import { normalizeNotificationDeepLinkPath } from '../utils/notification-deep-link';
import { pushNotificationService, redactPushTokens } from './push-notification.service';
import { normalizeLocale, type BackendLocale } from '../i18n';

export type NotificationFeedState = 'unread' | 'all' | 'actionable' | 'snoozed' | 'archived';

export interface NotificationListOptions {
  status?: NotificationStatus;
  state?: NotificationFeedState;
  templateCode?: string;
  limit?: number;
  cursor?: string;
  locale?: BackendLocale;
}

export interface AdminNotificationListOptions {
  status?: NotificationStatus;
  templateCode?: string;
  userId?: string;
  dedupKey?: string;
  limit?: number;
  offset?: number;
}

export interface AdminNotificationBulkCancelOptions {
  templateCode?: string;
  userId?: string;
  dedupKey?: string;
  groupKey?: string;
  limit?: number;
}

export type PushDevicePlatform = 'ios' | 'android';

export interface RegisterPushDeviceTokenInput {
  token: string;
  platform: PushDevicePlatform;
  device_id?: string | null;
  app_version?: string | null;
  build_number?: string | null;
}

export interface RevokePushDeviceTokenInput {
  token?: string | null;
  device_id?: string | null;
}

export interface PushDeviceTokenRecord {
  id: string;
  user_id: string;
  platform: PushDevicePlatform;
  device_id: string | null;
  app_version: string | null;
  build_number: string | null;
  revoked_at: Date | null;
  last_seen_at: Date;
  created_at: Date;
  updated_at: Date;
}

type StoredPushDeviceTokenRecord = PushDeviceTokenRecord & {
  token: string;
};

function normalizeNotificationDbString(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;

  const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  const prefixLength = Math.max(0, maxLength - hash.length - 1);
  return `${normalized.slice(0, prefixLength)}_${hash}`;
}

export interface RenderableNotification {
  id: string;
  user_id: string;
  channel: NotificationChannel;
  template_code: string;
  action_key: string | null;
  priority: string | null;
  group_key: string | null;
  dedup_key: string | null;
  status: NotificationStatus;
  error_message: string | null;
  created_at: Date;
  sent_at: Date | null;
  read_at: Date | null;
  dismissed_at: Date | null;
  acted_at: Date | null;
  snoozed_until: Date | null;
  unread: boolean;
  actionable: boolean;
  payload: Record<string, unknown>;
  journey_context: Record<string, unknown> | null;
  render_payload: {
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
    product_flow: CaseProductFlow | null;
  };
}

export type AdminRenderableNotification = RenderableNotification & {
  user: {
    id: string;
    email: string | null;
  };
};

type NotificationRecord = Awaited<ReturnType<typeof prisma.notification.findFirst>>;
const ADMIN_CANCELLED_ERROR_PREFIX = 'admin_cancelled:';

type PendingPushNotificationRecord = NonNullable<NotificationRecord> & {
  user: {
    notification_enabled: boolean;
    push_device_tokens: Array<{
      token: string;
      platform: PushDevicePlatform;
    }>;
  };
};

type NotificationTemplateRenderDefaults = {
  title: string;
  body: (payload: Record<string, unknown>) => string;
  ctaLabel?: string;
  actionKey?: string;
  priority?: 'now' | 'soon' | 'later';
};

type PushReceiptTrackedNotificationRecord = {
  id: string;
  push_ticket_id: string | null;
  push_receipt_status: string | null;
};

function readString(input: unknown): string | null {
  return typeof input === 'string' && input.trim().length > 0 ? input : null;
}

function readObject(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function readProductFlow(payload: Record<string, unknown>): CaseProductFlow | null {
  if (isCaseProductFlow(payload.product_flow)) {
    return payload.product_flow;
  }

  const journeyContext = readObject(payload.journey_context);
  const repairAccess = readObject(journeyContext.repair_access);
  return isCaseProductFlow(repairAccess.product_flow) ? repairAccess.product_flow : null;
}

function normalizeAdminReason(reason?: string | null): string {
  return typeof reason === 'string' && reason.trim().length > 0
    ? reason.trim().slice(0, 400)
    : 'no reason provided';
}

function normalizeNotificationPayloadForCreate(payload?: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, 'path')) {
    return payload;
  }

  if (record.path === null || record.path === undefined || record.path === '') {
    return { ...record, path: null } as Prisma.InputJsonValue;
  }

  const normalizedPath = normalizeNotificationDeepLinkPath(record.path);
  if (!normalizedPath) {
    throw Errors.VALIDATION_ERROR('notification payload.path 必須為已允許的前台相對路由');
  }

  return { ...record, path: normalizedPath } as Prisma.InputJsonValue;
}

function withNotificationLocale(payload: Prisma.InputJsonValue, locale: BackendLocale): Prisma.InputJsonValue {
  const record = readObject(payload);
  return {
    ...record,
    locale: normalizeLocale(readString(record.locale) ?? locale),
  } as Prisma.InputJsonValue;
}

function buildAdminBulkCancelWhere(options: AdminNotificationBulkCancelOptions): Prisma.NotificationWhereInput {
  const hasFilter = Boolean(options.templateCode || options.userId || options.dedupKey || options.groupKey);
  if (!hasFilter) {
    throw Errors.VALIDATION_ERROR('批量取消通知必須提供至少一個篩選條件');
  }

  return {
    status: NotificationStatus.pending,
    ...(options.templateCode ? { template_code: options.templateCode } : {}),
    ...(options.userId ? { user_id: options.userId } : {}),
    ...(options.dedupKey ? { dedup_key: options.dedupKey } : {}),
    ...(options.groupKey ? { group_key: options.groupKey } : {}),
  };
}

function normalizeBulkLimit(limit?: number): number {
  return Math.min(Math.max(Number.isFinite(limit) ? limit ?? 100 : 100, 1), 100);
}

function normalizeNullableString(input: string | null | undefined, maxLength: number): string | null {
  if (typeof input !== 'string') return null;
  const normalized = input.trim();
  return normalized.length > 0 ? normalized.slice(0, maxLength) : null;
}

function sanitizePushFailure(input: unknown): string {
  const message = input instanceof Error ? input.message : String(input || 'unknown push delivery error');
  return redactPushTokens(message).slice(0, 400);
}

function trimPushText(input: string | null | undefined, fallback: string, maxLength: number): string {
  const value = typeof input === 'string' && input.trim().length > 0 ? input.trim() : fallback;
  return value.slice(0, maxLength);
}

function sanitizePushProviderFailure(
  message: string | null | undefined,
  details: Record<string, unknown> | undefined,
  fallback: string
): string {
  const detailError = readString(details?.error);
  const base = message && message.trim().length > 0 ? message.trim() : fallback;
  return sanitizePushFailure(detailError ? `${base} (${detailError})` : base);
}

const TEMPLATE_RENDER_DEFAULTS_ZH_TW: Record<string, NotificationTemplateRenderDefaults> = {
  repair_journey_choose_direction: {
    title: '先選一個方向',
    body: (payload) => `你們的關係分析已經完成，${readString(payload.case_title) || '現在'}可以先選一個最適合的下一步。`,
    ctaLabel: '看看最適合你們的下一步',
    actionKey: 'open_reconciliation_entry',
    priority: 'soon',
  },
  repair_journey_start_step: {
    title: '今天只要先做一小步',
    body: () => '這一輪已經準備好，不需要一次做到很多，只要先開始第一小步。',
    ctaLabel: '開始今天的一小步',
    actionKey: 'continue_today_step',
    priority: 'now',
  },
  repair_journey_partner_invited: {
    title: '對方邀請你一起試試看',
    body: () => '你們已經有一個為目前狀態量身調整的方案，你可以先看一眼，不必急著馬上決定。',
    ctaLabel: '查看這個邀請',
    actionKey: 'review_invitation',
    priority: 'now',
  },
  repair_journey_partner_no_response: {
    title: '對方還沒有回應',
    body: () => '這一輪暫時還在等對方表態，你也可以先看看是否要自己先走一小步。',
    ctaLabel: '查看目前狀態',
    actionKey: 'view_invitation_status',
    priority: 'soon',
  },
  repair_journey_partner_viewed: {
    title: '對方已經看過這個邀請',
    body: () => '對方已經進來看過這一輪修復旅程，接下來可以留一些空間，等待他或她自己的節奏。',
    ctaLabel: '查看旅程狀態',
    actionKey: 'view_invitation_status',
    priority: 'later',
  },
  repair_journey_partner_committed: {
    title: '對方願意一起試',
    body: () => '你們現在都已經點頭，這一輪可以正式從更低壓、更清楚的一步開始。',
    ctaLabel: '回到今天的一小步',
    actionKey: 'continue_today_step',
    priority: 'now',
  },
  repair_journey_partner_deferred: {
    title: '對方需要一點時間',
    body: () => '對方不是直接拒絕，而是先為自己留一點空間。你可以先自己低壓地往前走，或晚一點再回來看。',
    ctaLabel: '查看目前狀態',
    actionKey: 'view_invitation_status',
    priority: 'soon',
  },
  repair_journey_partner_declined: {
    title: '對方暫時還不想加入',
    body: () => '這不代表這一輪完全失敗，你仍可以決定是否先由自己開始，或先暫停一下。',
    ctaLabel: '查看目前狀態',
    actionKey: 'review_invitation',
    priority: 'soon',
  },
  repair_journey_replan: {
    title: '這一輪可能需要重新調整',
    body: () => '當前狀態看起來有點太吃力了，先把節奏調整到更能承受，比硬撐更重要。',
    ctaLabel: '重新調整這一輪',
    actionKey: 'replan_track',
    priority: 'now',
  },
  repair_journey_replan_ready: {
    title: '調整後的新版本已經準備好',
    body: () => '系統已把這一輪調整成更貼近現在狀態的版本，你可以直接回來接續下一步。',
    ctaLabel: '查看調整後的版本',
    actionKey: 'continue_today_step',
    priority: 'now',
  },
  repair_journey_resume: {
    title: '這一輪可以再回來',
    body: () => '暫停不代表之前白費。如果現在比較有空間了，可以回來接續這一輪。',
    ctaLabel: '恢復這一輪',
    actionKey: 'resume_track',
    priority: 'soon',
  },
};

const TEMPLATE_RENDER_DEFAULTS_EN_US: Record<string, NotificationTemplateRenderDefaults> = {
  repair_journey_choose_direction: {
    title: 'Choose a direction first',
    body: (payload) => `Your relationship analysis is ready. ${readString(payload.case_title) || 'Now'} you can choose the next step that fits best.`,
    ctaLabel: 'See the best next step',
    actionKey: 'open_reconciliation_entry',
    priority: 'soon',
  },
  repair_journey_start_step: {
    title: 'Start with one small step today',
    body: () => 'This round is ready. You do not need to do everything at once; just begin with one small step.',
    ctaLabel: 'Start today\'s small step',
    actionKey: 'continue_today_step',
    priority: 'now',
  },
  repair_journey_partner_invited: {
    title: 'Your partner invited you to try together',
    body: () => 'There is a plan shaped for your current situation. You can take a look first without deciding right away.',
    ctaLabel: 'Review this invitation',
    actionKey: 'review_invitation',
    priority: 'now',
  },
  repair_journey_partner_no_response: {
    title: 'Your partner has not responded yet',
    body: () => 'This round is still waiting for their response. You can also decide whether to take a small step on your own first.',
    ctaLabel: 'View current status',
    actionKey: 'view_invitation_status',
    priority: 'soon',
  },
  repair_journey_partner_viewed: {
    title: 'Your partner has viewed the invitation',
    body: () => 'They have opened this repair journey. Next, it may help to leave some room and let them move at their own pace.',
    ctaLabel: 'View journey status',
    actionKey: 'view_invitation_status',
    priority: 'later',
  },
  repair_journey_partner_committed: {
    title: 'Your partner is willing to try together',
    body: () => 'You have both agreed. This round can now begin with a lower-pressure, clearer first step.',
    ctaLabel: 'Return to today\'s small step',
    actionKey: 'continue_today_step',
    priority: 'now',
  },
  repair_journey_partner_deferred: {
    title: 'Your partner needs a little time',
    body: () => 'This is not a direct refusal. They are making some room for themselves first. You can move forward gently on your own, or check back later.',
    ctaLabel: 'View current status',
    actionKey: 'view_invitation_status',
    priority: 'soon',
  },
  repair_journey_partner_declined: {
    title: 'Your partner does not want to join yet',
    body: () => 'This does not mean the whole round has failed. You can still decide whether to begin on your own or pause for now.',
    ctaLabel: 'View current status',
    actionKey: 'review_invitation',
    priority: 'soon',
  },
  repair_journey_replan: {
    title: 'This round may need an adjustment',
    body: () => 'The current pace looks a bit too heavy. Adjusting it to something more manageable matters more than pushing through.',
    ctaLabel: 'Adjust this round',
    actionKey: 'replan_track',
    priority: 'now',
  },
  repair_journey_replan_ready: {
    title: 'The adjusted version is ready',
    body: () => 'The system has adjusted this round to better match the current situation. You can return and continue from the next step.',
    ctaLabel: 'View the adjusted version',
    actionKey: 'continue_today_step',
    priority: 'now',
  },
  repair_journey_resume: {
    title: 'You can return to this round',
    body: () => 'Pausing does not erase what you already did. If there is more room now, you can come back and continue this round.',
    ctaLabel: 'Resume this round',
    actionKey: 'resume_track',
    priority: 'soon',
  },
};

function readLocaleFromPayload(payload: Record<string, unknown>): BackendLocale {
  return normalizeLocale(readString(payload.locale));
}

function localeFromUserLanguage(language: unknown): BackendLocale {
  return language === 'en' ? 'en-US' : 'zh-TW';
}

function getTemplateRenderDefaults(locale: BackendLocale, templateCode: string): NotificationTemplateRenderDefaults | undefined {
  return (locale === 'en-US' ? TEMPLATE_RENDER_DEFAULTS_EN_US : TEMPLATE_RENDER_DEFAULTS_ZH_TW)[templateCode];
}

function localizeNotificationFallback(locale: BackendLocale, key: 'title' | 'body' | 'pushTitle' | 'pushBody'): string {
  const values: Record<BackendLocale, Record<typeof key, string>> = {
    'zh-TW': {
      title: '通知',
      body: '你有一則新的通知。',
      pushTitle: 'CJ 提醒',
      pushBody: '你有一則新的提醒。',
    },
    'en-US': {
      title: 'Notification',
      body: 'You have a new notification.',
      pushTitle: 'CJ Reminder',
      pushBody: 'You have a new reminder.',
    },
  };
  return values[locale][key];
}

export class NotificationService {
  private buildWhere(userId: string, options: NotificationListOptions = {}): Prisma.NotificationWhereInput {
    const where: Prisma.NotificationWhereInput = { user_id: userId };
    if (options.status) where.status = options.status;
    if (options.templateCode) where.template_code = options.templateCode;

    switch (options.state) {
      case 'unread':
        where.read_at = null;
        where.dismissed_at = null;
        break;
      case 'actionable':
        where.dismissed_at = null;
        where.acted_at = null;
        where.OR = [
          { snoozed_until: null },
          { snoozed_until: { lte: new Date() } },
        ];
        break;
      case 'snoozed':
        where.dismissed_at = null;
        where.acted_at = null;
        where.snoozed_until = { gt: new Date() };
        break;
      case 'archived':
        where.OR = [
          { dismissed_at: { not: null } },
          { acted_at: { not: null } },
        ];
        break;
      case 'all':
      default:
        break;
    }
    return where;
  }

  private normalize(notification: NonNullable<NotificationRecord>, locale?: BackendLocale): RenderableNotification {
    const payload = readObject(notification.payload);
    const journeyContext = readObject(payload.journey_context);
    const renderLocale = locale ?? readLocaleFromPayload(payload);
    const defaults = getTemplateRenderDefaults(renderLocale, notification.template_code);
    const productFlow = readProductFlow(payload);
    const actionKey = readString(notification.action_key) || defaults?.actionKey || null;
    const title = readString(payload.title) || defaults?.title || localizeNotificationFallback(renderLocale, 'title');
    const body = readString(payload.body) || defaults?.body(payload) || localizeNotificationFallback(renderLocale, 'body');
    const path = normalizeNotificationDeepLinkPath(payload.path);
    const ctaLabel = readString(payload.cta_label) || defaults?.ctaLabel || null;
    const entityType =
      readString(payload.entity_type)
      || (readString(payload.repair_track_id) ? 'repair_track'
        : readString(payload.plan_id) ? 'reconciliation_plan'
          : readString(payload.judgment_id) ? 'judgment'
            : readString(payload.case_id) ? 'case'
              : null);
    const entityId =
      readString(payload.entity_id)
      || readString(payload.repair_track_id)
      || readString(payload.plan_id)
      || readString(payload.judgment_id)
      || readString(payload.case_id);

    return {
      id: notification.id,
      user_id: notification.user_id,
      channel: notification.channel,
      template_code: notification.template_code,
      action_key: actionKey,
      priority: readString(notification.priority) || defaults?.priority || null,
      group_key: readString(notification.group_key),
      dedup_key: readString(notification.dedup_key),
      status: notification.status,
      error_message: notification.error_message,
      created_at: notification.created_at,
      sent_at: notification.sent_at,
      read_at: notification.read_at,
      dismissed_at: notification.dismissed_at,
      acted_at: notification.acted_at,
      snoozed_until: notification.snoozed_until,
      unread: !notification.read_at,
      actionable: !notification.dismissed_at
        && !notification.acted_at
        && (!notification.snoozed_until || notification.snoozed_until.getTime() <= Date.now()),
      payload,
      journey_context: Object.keys(journeyContext).length > 0 ? journeyContext : null,
      render_payload: {
        title,
        body,
        path,
        cta_label: ctaLabel,
        entity_type: entityType,
        entity_id: entityId,
        journey_status: readString(payload.journey_status),
        track_id: readString(payload.repair_track_id),
        plan_id: readString(payload.plan_id),
        judgment_id: readString(payload.judgment_id),
        case_id: readString(payload.case_id),
        priority: readString(notification.priority) || defaults?.priority || null,
        partner_state: readString(payload.partner_state),
        reason_code: readString(payload.reason_code),
        product_flow: productFlow,
      },
    };
  }

  async list(userId: string, options: NotificationListOptions = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const notifications = await prisma.notification.findMany({
      where: this.buildWhere(userId, options),
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options.cursor
        ? {
            skip: 1,
            cursor: { id: options.cursor },
          }
        : {}),
    });

    const hasMore = notifications.length > limit;
    const items = notifications.slice(0, limit).map((notification) => this.normalize(notification, options.locale));
    const nextCursor = hasMore ? notifications[limit - 1]?.id ?? null : null;
    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  private buildAdminWhere(options: AdminNotificationListOptions = {}): Prisma.NotificationWhereInput {
    return {
      ...(options.status ? { status: options.status } : {}),
      ...(options.templateCode ? { template_code: options.templateCode } : {}),
      ...(options.userId ? { user_id: options.userId } : {}),
      ...(options.dedupKey ? { dedup_key: options.dedupKey } : {}),
    };
  }

  async listForAdmin(options: AdminNotificationListOptions = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const where = this.buildAdminWhere(options);
    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      items: notifications.map((notification): AdminRenderableNotification => ({
          ...this.normalize(notification),
        user: {
          id: notification.user.id,
          email: notification.user.email,
        },
      })),
      total,
      limit,
      offset,
    };
  }

  async create(
    userId: string,
    data: {
      template_code: string;
      payload?: Prisma.InputJsonValue;
      channel: NotificationChannel;
      dedup_key?: string;
      action_key?: string;
      priority?: string;
      group_key?: string;
      locale?: BackendLocale;
  }
  ) {
    const targetLocale = data.locale ?? await this.getUserLocale(userId);
    const normalizedPayload = withNotificationLocale(normalizeNotificationPayloadForCreate(data.payload), targetLocale);
    return prisma.notification.create({
      data: {
        user_id: userId,
        template_code: normalizeNotificationDbString(data.template_code, 50)!,
        action_key: normalizeNotificationDbString(data.action_key, 50),
        priority: normalizeNotificationDbString(data.priority, 20),
        group_key: normalizeNotificationDbString(data.group_key, 100),
        payload: normalizedPayload,
        channel: data.channel,
        dedup_key: normalizeNotificationDbString(data.dedup_key, 100),
        status: NotificationStatus.pending,
      },
    });
  }

  async markAsSent(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.sent, sent_at: new Date() },
    });
  }

  async markFailed(id: string, errorMessage: string) {
    return prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.failed, error_message: errorMessage },
    });
  }

  async cancelPendingByAdmin(notificationId: string, reason?: string | null) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) return null;
    if (notification.status !== NotificationStatus.pending) {
      throw Errors.VALIDATION_ERROR('只有 pending 通知可以取消');
    }

    const normalizedReason = normalizeAdminReason(reason);
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.cancelled,
        error_message: `${ADMIN_CANCELLED_ERROR_PREFIX} ${normalizedReason}`,
      },
    });

    return this.normalize(updated);
  }

  async bulkCancelPendingByAdmin(options: AdminNotificationBulkCancelOptions, reason?: string | null) {
    const where = buildAdminBulkCancelWhere(options);
    const limit = normalizeBulkLimit(options.limit);
    const normalizedReason = normalizeAdminReason(reason);
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        user_id: true,
        template_code: true,
        dedup_key: true,
        group_key: true,
      },
    });

    const notificationIds = notifications.map((notification) => notification.id);
    if (notificationIds.length === 0) {
      return {
        matchedCount: 0,
        cancelledCount: 0,
        limit,
        reason: normalizedReason,
        filters: options,
        notificationIds,
        items: [],
      };
    }

    const updateResult = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        status: NotificationStatus.pending,
      },
      data: {
        status: NotificationStatus.cancelled,
        error_message: `${ADMIN_CANCELLED_ERROR_PREFIX} ${normalizedReason}`,
      },
    });

    return {
      matchedCount: notificationIds.length,
      cancelledCount: updateResult.count,
      limit,
      reason: normalizedReason,
      filters: options,
      notificationIds,
      items: notifications,
    };
  }

  async retryFailedByAdmin(notificationId: string, reason?: string | null) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) return null;
    if (notification.status === NotificationStatus.cancelled) {
      throw Errors.VALIDATION_ERROR('已由 Admin 取消的通知不可重送');
    }
    if (notification.status !== NotificationStatus.failed) {
      throw Errors.VALIDATION_ERROR('只有 failed 通知可以重送');
    }
    if (notification.error_message?.startsWith(ADMIN_CANCELLED_ERROR_PREFIX)) {
      throw Errors.VALIDATION_ERROR('已由 Admin 取消的通知不可重送');
    }

    const normalizedReason = normalizeAdminReason(reason);
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.pending,
        error_message: null,
        sent_at: null,
      },
    });

    return {
      notification: this.normalize(updated),
      previousError: notification.error_message ?? null,
      reason: normalizedReason,
    };
  }

  async getPending(limit = 50) {
    return prisma.notification.findMany({
      where: { status: NotificationStatus.pending },
      orderBy: { created_at: 'asc' },
      take: limit,
      include: { user: { select: { email: true, notification_enabled: true } } },
    });
  }

  async isNotificationEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notification_enabled: true },
    });
    return user?.notification_enabled ?? false;
  }

  private async getUserLocale(userId: string): Promise<BackendLocale> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    return localeFromUserLanguage(user?.language);
  }

  private async getUserNotificationPreferences(userId: string): Promise<{ enabled: boolean; locale: BackendLocale }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notification_enabled: true,
        language: true,
      },
    });
    return {
      enabled: user?.notification_enabled ?? false,
      locale: localeFromUserLanguage(user?.language),
    };
  }

  async createIfEnabled(
    userId: string,
    data: {
      template_code: string;
      payload?: Prisma.InputJsonValue;
      channel: NotificationChannel;
      dedup_key?: string;
      action_key?: string;
      priority?: string;
      group_key?: string;
      locale?: BackendLocale;
    }
  ) {
    const preferences = await this.getUserNotificationPreferences(userId);
    if (!preferences.enabled) {
      logger.debug('Notification skipped (user disabled)', { userId, template: data.template_code });
      return null;
    }
    return this.create(userId, { ...data, locale: data.locale ?? preferences.locale });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        user_id: userId,
        read_at: null,
        dismissed_at: null,
        OR: [
          { snoozed_until: null },
          { snoozed_until: { lte: new Date() } },
        ],
      },
    });
  }

  private async getOwnedNotification(userId: string, notificationId: string) {
    return prisma.notification.findFirst({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });
  }

  async markRead(userId: string, notificationId: string, locale?: BackendLocale) {
    const notification = await this.getOwnedNotification(userId, notificationId);
    if (!notification) return null;
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        read_at: notification.read_at ?? new Date(),
      },
    });
    return this.normalize(updated, locale);
  }

  async markAllRead(userId: string) {
    const readAt = new Date();
    const result = await prisma.notification.updateMany({
      where: {
        user_id: userId,
        read_at: null,
        dismissed_at: null,
      },
      data: {
        read_at: readAt,
      },
    });
    return { updatedCount: result.count, readAt };
  }

  async dismiss(userId: string, notificationId: string, locale?: BackendLocale) {
    const notification = await this.getOwnedNotification(userId, notificationId);
    if (!notification) return null;
    const now = new Date();
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        dismissed_at: now,
        read_at: notification.read_at ?? now,
        snoozed_until: null,
      },
    });
    return this.normalize(updated, locale);
  }

  async snooze(userId: string, notificationId: string, hours = 24, locale?: BackendLocale) {
    const notification = await this.getOwnedNotification(userId, notificationId);
    if (!notification) return null;
    const now = new Date();
    const snoozedUntil = new Date(now.getTime() + Math.max(1, Math.min(hours, 168)) * 60 * 60 * 1000);
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        snoozed_until: snoozedUntil,
        read_at: notification.read_at ?? now,
      },
    });
    return this.normalize(updated, locale);
  }

  async act(userId: string, notificationId: string, actionKey?: string, locale?: BackendLocale) {
    const notification = await this.getOwnedNotification(userId, notificationId);
    if (!notification) return null;
    const now = new Date();
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        acted_at: now,
        read_at: notification.read_at ?? now,
        snoozed_until: null,
        action_key: actionKey ?? notification.action_key ?? undefined,
      },
    });
    const normalized = this.normalize(updated, locale);
    return {
      notification: normalized,
      target: {
        path: normalized.render_payload.path,
        action_key: normalized.action_key,
        entity_type: normalized.render_payload.entity_type,
        entity_id: normalized.render_payload.entity_id,
      },
    };
  }

  async registerDeviceToken(userId: string, input: RegisterPushDeviceTokenInput): Promise<PushDeviceTokenRecord> {
    const now = new Date();
    const token = input.token.trim();
    const pushDeviceToken = (prisma as unknown as {
      pushDeviceToken: {
        upsert(args: unknown): Promise<StoredPushDeviceTokenRecord>;
      };
    }).pushDeviceToken;

    const record = await pushDeviceToken.upsert({
      where: { token },
      create: {
        user_id: userId,
        token,
        platform: input.platform,
        device_id: normalizeNullableString(input.device_id, 128),
        app_version: normalizeNullableString(input.app_version, 40),
        build_number: normalizeNullableString(input.build_number, 40),
        last_seen_at: now,
      },
      update: {
        user_id: userId,
        platform: input.platform,
        device_id: normalizeNullableString(input.device_id, 128),
        app_version: normalizeNullableString(input.app_version, 40),
        build_number: normalizeNullableString(input.build_number, 40),
        revoked_at: null,
        last_seen_at: now,
      },
    });

    logger.info('Push device token registered', {
      userId,
      platform: input.platform,
      hasDeviceId: Boolean(record.device_id),
    });

    return {
      id: record.id,
      user_id: record.user_id,
      platform: record.platform,
      device_id: record.device_id,
      app_version: record.app_version,
      build_number: record.build_number,
      revoked_at: record.revoked_at,
      last_seen_at: record.last_seen_at,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  async revokeDeviceToken(userId: string, input: RevokePushDeviceTokenInput): Promise<{ revokedCount: number; revokedAt: Date }> {
    const token = normalizeNullableString(input.token, 255);
    const deviceId = normalizeNullableString(input.device_id, 128);
    if (!token && !deviceId) {
      throw Errors.VALIDATION_ERROR('token 或 device_id 至少需要一項');
    }
    const revokedAt = new Date();
    const pushDeviceToken = (prisma as unknown as {
      pushDeviceToken: {
        updateMany(args: unknown): Promise<{ count: number }>;
      };
    }).pushDeviceToken;

    const result = await pushDeviceToken.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
        ...(token ? { token } : {}),
        ...(deviceId ? { device_id: deviceId } : {}),
      },
      data: {
        revoked_at: revokedAt,
      },
    });

    logger.info('Push device token revoked', {
      userId,
      byToken: Boolean(token),
      byDeviceId: Boolean(deviceId),
      count: result.count,
    });

    return {
      revokedAt,
      revokedCount: result.count,
    };
  }

  async dispatchPendingPushNotifications(limit = 50): Promise<{
    scannedCount: number;
    sentCount: number;
    failedCount: number;
    ticketCount: number;
  }> {
    const take = Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 100);
    const notificationStore = (prisma as unknown as {
      notification: {
        findMany(args: unknown): Promise<PendingPushNotificationRecord[]>;
        update(args: unknown): Promise<NonNullable<NotificationRecord>>;
      };
    }).notification;
    const notifications = await notificationStore.findMany({
      where: {
        channel: NotificationChannel.push,
        status: NotificationStatus.pending,
      },
      orderBy: { created_at: 'asc' },
      take,
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

    let sentCount = 0;
    let failedCount = 0;
    let ticketCount = 0;

    for (const notification of notifications) {
      const tokens = notification.user?.push_device_tokens
        ?.map((item) => item.token)
        .filter((token): token is string => typeof token === 'string' && token.trim().length > 0) ?? [];

      if (!notification.user?.notification_enabled) {
        await notificationStore.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.failed,
            error_message: 'user_notifications_disabled',
          },
        });
        failedCount += 1;
        continue;
      }

      if (tokens.length === 0) {
        await notificationStore.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.failed,
            error_message: 'no_active_push_device_token',
          },
        });
        failedCount += 1;
        continue;
      }

      const payload = readObject(notification.payload);
      const pushLocale = readLocaleFromPayload(payload);
      const rendered = this.normalize(notification, pushLocale);
      const messages = tokens.map((token) => ({
        to: token,
        title: trimPushText(rendered.render_payload.title, localizeNotificationFallback(pushLocale, 'pushTitle'), 80),
        body: trimPushText(rendered.render_payload.body, localizeNotificationFallback(pushLocale, 'pushBody'), 180),
        sound: 'default' as const,
        priority: rendered.priority === 'now' ? 'high' as const : 'default' as const,
        data: {
          notification_id: rendered.id,
          template_code: rendered.template_code,
          path: rendered.render_payload.path,
          target_path: rendered.render_payload.path,
          action_key: rendered.action_key,
          entity_type: rendered.render_payload.entity_type,
          entity_id: rendered.render_payload.entity_id,
        },
      }));

      try {
        const tickets = await pushNotificationService.sendMessages(messages);
        ticketCount += tickets.length;
        const accepted = tickets.filter((ticket) => ticket.status === 'ok').length;
        const acceptedTicket = tickets.find((ticket) => ticket.status === 'ok' && ticket.id);
        const errorTicket = tickets.find((ticket) => ticket.status === 'error');
        if (accepted > 0) {
          await notificationStore.update({
            where: { id: notification.id },
            data: {
              status: NotificationStatus.sent,
              sent_at: new Date(),
              error_message: tickets.length > accepted ? 'expo_push_partial_failure' : null,
              push_provider: 'expo',
              push_ticket_id: acceptedTicket?.id ?? null,
              push_ticket_status: 'ok',
              push_receipt_status: acceptedTicket?.id ? 'pending' : null,
              push_receipt_checked_at: null,
              push_receipt_error: null,
            },
          });
          sentCount += 1;
        } else {
          const message = sanitizePushProviderFailure(
            errorTicket?.message,
            errorTicket?.details,
            'expo_push_no_accepted_tickets'
          );
          await notificationStore.update({
            where: { id: notification.id },
            data: {
              status: NotificationStatus.failed,
              error_message: message,
              push_provider: 'expo',
              push_ticket_status: 'error',
              push_receipt_status: 'error',
              push_receipt_checked_at: new Date(),
              push_receipt_error: message,
            },
          });
          failedCount += 1;
        }
      } catch (error) {
        const message = sanitizePushFailure(error);
        await notificationStore.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.failed,
            error_message: message,
            push_provider: 'expo',
            push_ticket_status: 'error',
            push_receipt_status: 'error',
            push_receipt_checked_at: new Date(),
            push_receipt_error: message,
          },
        });
        failedCount += 1;
      }
    }

    if (sentCount > 0 || failedCount > 0) {
      logger.info('Pending push notifications dispatched', {
        scannedCount: notifications.length,
        sentCount,
        failedCount,
        ticketCount,
      });
    }

    return {
      scannedCount: notifications.length,
      sentCount,
      failedCount,
      ticketCount,
    };
  }

  async pollPushNotificationReceipts(limit = 100): Promise<{
    scannedCount: number;
    receiptCount: number;
    okCount: number;
    failedCount: number;
    pendingCount: number;
  }> {
    const take = Math.min(Math.max(Number.isFinite(limit) ? limit : 100, 1), 300);
    const notificationStore = (prisma as unknown as {
      notification: {
        findMany(args: unknown): Promise<PushReceiptTrackedNotificationRecord[]>;
        update(args: unknown): Promise<unknown>;
      };
    }).notification;

    const notifications = await notificationStore.findMany({
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
      take,
      select: {
        id: true,
        push_ticket_id: true,
        push_receipt_status: true,
      },
    });

    const ticketIds = notifications
      .map((notification) => notification.push_ticket_id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const receipts = await pushNotificationService.getReceipts(ticketIds);
    const now = new Date();

    let okCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    for (const notification of notifications) {
      const ticketId = notification.push_ticket_id;
      if (!ticketId) continue;
      const receipt = receipts[ticketId];

      if (!receipt) {
        await notificationStore.update({
          where: { id: notification.id },
          data: {
            push_receipt_status: notification.push_receipt_status || 'pending',
            push_receipt_checked_at: now,
          },
        });
        pendingCount += 1;
        continue;
      }

      if (receipt.status === 'ok') {
        await notificationStore.update({
          where: { id: notification.id },
          data: {
            push_receipt_status: 'ok',
            push_receipt_checked_at: now,
            push_receipt_error: null,
          },
        });
        okCount += 1;
        continue;
      }

      const message = sanitizePushProviderFailure(
        receipt.message,
        receipt.details,
        'expo_push_receipt_error'
      );
      await notificationStore.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.failed,
          error_message: message,
          push_receipt_status: 'error',
          push_receipt_checked_at: now,
          push_receipt_error: message,
        },
      });
      failedCount += 1;
    }

    if (okCount > 0 || failedCount > 0 || pendingCount > 0) {
      logger.info('Push notification receipts polled', {
        scannedCount: notifications.length,
        receiptCount: Object.keys(receipts).length,
        okCount,
        failedCount,
        pendingCount,
      });
    }

    return {
      scannedCount: notifications.length,
      receiptCount: Object.keys(receipts).length,
      okCount,
      failedCount,
      pendingCount,
    };
  }
}

export const notificationService = new NotificationService();
