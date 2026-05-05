/**
 * 通知中心頁面
 *
 * 遷移: Ant Alert/Button/Card/Empty/Segmented/Space/Spin/Tag/Typography/message/Icons
 *       → shadcn + Tailwind + sonner + Lucide
 */

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, Clock, Trash2, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/notificationStore';
import { t } from '@/utils/i18n';
import type { NotificationFeedState, NotificationItem } from '@/services/api/notifications';

const getStateOptions = (): Array<{ label: string; value: NotificationFeedState }> => [
  { label: t('notifications.tab.actionable'), value: 'actionable' },
  { label: t('notifications.tab.unread'), value: 'unread' },
  { label: t('notifications.tab.all'), value: 'all' },
  { label: t('notifications.tab.snoozed'), value: 'snoozed' },
  { label: t('notifications.tab.archived'), value: 'archived' },
];

function sectionTitle(notification: NotificationItem, activeState: NotificationFeedState): string {
  if (activeState === 'snoozed' || notification.snoozed_until) return t('notifications.section.snoozed');
  if (!notification.actionable || notification.acted_at || notification.dismissed_at) return t('notifications.section.completed');
  if (notification.journey_context?.presentation_bucket === 'partner_waiting') return t('notifications.section.partnerWaiting');
  if (notification.priority === 'now' || notification.render_payload.priority === 'now') return t('notifications.section.now');
  return t('notifications.section.partnerWaiting');
}

const NotificationsPage = () => {
  const navigate = useNavigate();
  const {
    items, unreadCount, activeState, hasMore,
    isLoading, isLoadingMore, error,
    fetchNotifications, fetchUnreadCount,
    markRead, markAllRead, dismiss, snooze, act, clearError,
  } = useNotificationStore();

  useEffect(() => {
    void fetchNotifications(activeState);
    void fetchUnreadCount();
  }, [activeState, fetchNotifications, fetchUnreadCount]);

  const sections = useMemo(() => {
    return items.reduce<Record<string, NotificationItem[]>>((acc, item) => {
      const key = sectionTitle(item, activeState);
      acc[key] = [...(acc[key] || []), item];
      return acc;
    }, {});
  }, [activeState, items]);

  const handleOpen = async (notification: NotificationItem) => {
    if (notification.unread) await markRead(notification.id);
    const path = notification.journey_context?.entry_path || notification.render_payload.path;
    if (path) navigate(path);
  };

  const handleAct = async (notification: NotificationItem) => {
    const target = await act(notification.id, notification.action_key ?? undefined);
    const path = target?.path || notification.journey_context?.primary_cta.path || notification.render_payload.path;
    if (path) navigate(path);
  };

  const handleDismiss = async (notificationId: string) => {
    await dismiss(notificationId);
    toast.success(t('notifications.toast.dismissed'));
  };

  const handleSnooze = async (notificationId: string) => {
    await snooze(notificationId, 24);
    toast.success(t('notifications.toast.snoozed'));
  };

  return (
    <ProtectedRoute>
      <SEO title={t("notifications.seo.title")} description={t("notifications.seo.desc")} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-3xl px-4 py-8" role="main" aria-label={t("notifications.pageLabel")}>
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="size-5 text-primary" />
            <h2 className="text-2xl font-bold text-foreground font-heading">{t("notifications.heading")}</h2>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">{unreadCount}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("notifications.subtitle")}
          </p>

          {/* Tabs + Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={activeState} onValueChange={(v: string) => void fetchNotifications(v as NotificationFeedState)}>
              <TabsList>
                {getStateOptions().map((opt) => (
                  <TabsTrigger key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchNotifications(activeState)}>{t("notifications.action.refresh")}</Button>
              <Button variant="outline" size="sm" onClick={() => void markAllRead()} disabled={unreadCount <= 0}>{t("notifications.action.markAllRead")}</Button>
            </div>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm text-foreground">{error}</p>
            </div>
            <Button size="sm" onClick={() => { clearError(); void fetchNotifications(activeState); }}>{t('common.retry')}</Button>
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState variant="notifications" />
        ) : (
          <div className="space-y-6">
            {Object.entries(sections).map(([title, sectionItems]) => (
              <div key={title}>
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h3>
                <div className="space-y-2">
                  {sectionItems.map((notification) => (
                    <div
                      key={notification.id}
                      className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className={cn(
                          'w-full text-left',
                          (notification.journey_context?.entry_path || notification.render_payload.path) && 'cursor-pointer',
                        )}
                        onClick={() => void handleOpen(notification)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void handleOpen(notification); } }}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-foreground">{notification.render_payload.title}</span>
                          {notification.unread && <Badge variant="default" className="text-[10px]">{t("notifications.badge.unread")}</Badge>}
                          {notification.acted_at && <Badge variant="secondary" className="text-[10px] bg-success/10 text-success">{t("notifications.badge.acted")}</Badge>}
                          {notification.dismissed_at && <Badge variant="outline" className="text-[10px]">{t("notifications.badge.dismissed")}</Badge>}
                          {notification.snoozed_until && <Badge variant="outline" className="text-[10px] text-warning">{t("notifications.badge.snoozed")}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{notification.render_payload.body}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{new Date(notification.created_at).toLocaleString()}</span>
                          {notification.render_payload.journey_status && (
                            <Badge variant="outline" className="text-[10px]">{notification.render_payload.journey_status}</Badge>
                          )}
                          {(notification.priority || notification.render_payload.priority) === 'now' && (
                            <Badge variant="destructive" className="text-[10px]">{t("notifications.badge.now")}</Badge>
                          )}
                          {notification.render_payload.path && (
                            <span className="flex items-center gap-0.5 text-primary">
                              {t("notifications.goTo")} <ChevronRight className="size-3" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {notification.actionable && (notification.journey_context?.primary_cta.label || notification.render_payload.cta_label) && (
                          <Button size="sm" onClick={() => void handleAct(notification)}>
                            {notification.journey_context?.primary_cta.label || notification.render_payload.cta_label}
                          </Button>
                        )}
                        {notification.actionable && !notification.snoozed_until && (
                          <Button variant="outline" size="sm" onClick={() => void handleSnooze(notification.id)}>
                            <Clock className="size-3" />{t("notifications.action.snooze")}                          </Button>
                        )}
                        {!notification.dismissed_at && !notification.actionable && (
                          <Button variant="ghost" size="sm" onClick={() => void handleDismiss(notification.id)}>
                            <Trash2 className="size-3" />{t("notifications.action.dismiss")}                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" disabled={isLoadingMore} onClick={() => void fetchNotifications(activeState, { append: true })}>
                  {isLoadingMore && <Loader2 className="size-4 animate-spin" />}
                  {t('common.loadMore')}
                </Button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </ProtectedRoute>
  );
};

export default NotificationsPage;
