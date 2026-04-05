import prisma from '../config/database';
import { Prisma, NotificationChannel, NotificationStatus } from '@prisma/client';
import logger from '../config/logger';

export type NotificationFeedState = 'unread' | 'all' | 'actionable' | 'snoozed' | 'archived';

export interface NotificationListOptions {
  status?: NotificationStatus;
  state?: NotificationFeedState;
  templateCode?: string;
  limit?: number;
  cursor?: string;
}

export interface RenderableNotification {
  id: string;
  channel: NotificationChannel;
  template_code: string;
  action_key: string | null;
  priority: string | null;
  group_key: string | null;
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
  };
}

type NotificationRecord = Awaited<ReturnType<typeof prisma.notification.findFirst>>;

function readString(input: unknown): string | null {
  return typeof input === 'string' && input.trim().length > 0 ? input : null;
}

function readObject(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

const TEMPLATE_RENDER_DEFAULTS: Record<string, {
  title: string;
  body: (payload: Record<string, unknown>) => string;
  ctaLabel?: string;
  actionKey?: string;
  priority?: 'now' | 'soon' | 'later';
}> = {
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

  private normalize(notification: NonNullable<NotificationRecord>): RenderableNotification {
    const payload = readObject(notification.payload);
    const journeyContext = readObject(payload.journey_context);
    const defaults = TEMPLATE_RENDER_DEFAULTS[notification.template_code];
    const actionKey = readString(notification.action_key) || defaults?.actionKey || null;
    const title = readString(payload.title) || defaults?.title || '通知';
    const body = readString(payload.body) || defaults?.body(payload) || '你有一則新的通知。';
    const path = readString(payload.path);
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
      channel: notification.channel,
      template_code: notification.template_code,
      action_key: actionKey,
      priority: readString(notification.priority) || defaults?.priority || null,
      group_key: readString(notification.group_key),
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
    const items = notifications.slice(0, limit).map((notification) => this.normalize(notification));
    const nextCursor = hasMore ? notifications[limit - 1]?.id ?? null : null;
    return {
      items,
      nextCursor,
      hasMore,
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
    }
  ) {
    return prisma.notification.create({
      data: {
        user_id: userId,
        template_code: data.template_code,
        action_key: data.action_key,
        priority: data.priority,
        group_key: data.group_key,
        payload: data.payload || {},
        channel: data.channel,
        dedup_key: data.dedup_key,
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
    }
  ) {
    const enabled = await this.isNotificationEnabled(userId);
    if (!enabled) {
      logger.debug('Notification skipped (user disabled)', { userId, template: data.template_code });
      return null;
    }
    return this.create(userId, data);
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

  async markRead(userId: string, notificationId: string) {
    const notification = await this.getOwnedNotification(userId, notificationId);
    if (!notification) return null;
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        read_at: notification.read_at ?? new Date(),
      },
    });
    return this.normalize(updated);
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

  async dismiss(userId: string, notificationId: string) {
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
    return this.normalize(updated);
  }

  async snooze(userId: string, notificationId: string, hours = 24) {
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
    return this.normalize(updated);
  }

  async act(userId: string, notificationId: string, actionKey?: string) {
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
    const normalized = this.normalize(updated);
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
}

export const notificationService = new NotificationService();
