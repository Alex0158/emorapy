/**
 * 通知中心頁面
 *
 * 遷移: Ant Alert/Button/Card/Empty/Segmented/Space/Spin/Tag/Typography/message/Icons
 *       → shadcn + Tailwind + sonner + Lucide
 */

import { useEffect, useMemo } from 'react';
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
import type { NotificationFeedState, NotificationItem } from '@/services/api/notifications';

const stateOptions: Array<{ label: string; value: NotificationFeedState }> = [
  { label: '待處理', value: 'actionable' },
  { label: '未讀', value: 'unread' },
  { label: '全部', value: 'all' },
  { label: '稍後提醒', value: 'snoozed' },
  { label: '已封存', value: 'archived' },
];

function sectionTitle(notification: NotificationItem, activeState: NotificationFeedState): string {
  if (activeState === 'snoozed' || notification.snoozed_until) return '稍後提醒我';
  if (!notification.actionable || notification.acted_at || notification.dismissed_at) return '已完成與較早通知';
  if (notification.journey_context?.presentation_bucket === 'partner_waiting') return '等對方 / 等時間';
  if (notification.priority === 'now' || notification.render_payload.priority === 'now') return '現在要處理';
  return '等對方 / 等時間';
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
    toast.success('已封存這則通知');
  };

  const handleSnooze = async (notificationId: string) => {
    await snooze(notificationId, 24);
    toast.success('已稍後提醒你這則通知');
  };

  return (
    <ProtectedRoute>
      <SEO title="通知中心" description="查看修復旅程、邀請與重調相關通知" />
      <div className="mx-auto max-w-3xl px-4 py-8" role="main" aria-label="通知中心">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="size-5 text-primary" />
            <h2 className="text-2xl font-bold text-foreground font-heading">通知中心</h2>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">{unreadCount}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            這裡會把 repair journey 的邀請、等待回應、重新調整與恢復入口集中起來。
          </p>

          {/* Tabs + Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={activeState} onValueChange={(v: string) => void fetchNotifications(v as NotificationFeedState)}>
              <TabsList>
                {stateOptions.map((opt) => (
                  <TabsTrigger key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchNotifications(activeState)}>刷新</Button>
              <Button variant="outline" size="sm" onClick={() => void markAllRead()} disabled={unreadCount <= 0}>全部已讀</Button>
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
            <Button size="sm" onClick={() => { clearError(); void fetchNotifications(activeState); }}>重試</Button>
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
                          {notification.unread && <Badge variant="default" className="text-[10px]">未讀</Badge>}
                          {notification.acted_at && <Badge variant="secondary" className="text-[10px] bg-success/10 text-success">已處理</Badge>}
                          {notification.dismissed_at && <Badge variant="outline" className="text-[10px]">已封存</Badge>}
                          {notification.snoozed_until && <Badge variant="outline" className="text-[10px] text-warning">稍後提醒</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{notification.render_payload.body}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{new Date(notification.created_at).toLocaleString()}</span>
                          {notification.render_payload.journey_status && (
                            <Badge variant="outline" className="text-[10px]">{notification.render_payload.journey_status}</Badge>
                          )}
                          {(notification.priority || notification.render_payload.priority) === 'now' && (
                            <Badge variant="destructive" className="text-[10px]">現在處理</Badge>
                          )}
                          {notification.render_payload.path && (
                            <span className="flex items-center gap-0.5 text-primary">
                              進入 <ChevronRight className="size-3" />
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
                            <Clock className="size-3" />
                            稍後提醒
                          </Button>
                        )}
                        {!notification.dismissed_at && !notification.actionable && (
                          <Button variant="ghost" size="sm" onClick={() => void handleDismiss(notification.id)}>
                            <Trash2 className="size-3" />
                            封存
                          </Button>
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
                  載入更多
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default NotificationsPage;
