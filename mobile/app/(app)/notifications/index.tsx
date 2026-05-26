import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationFeedState, NotificationItem, NotificationStatus } from '@cj/api-client';

import { getRuntimeConfig } from '@/src/config/runtime';
import { m5Api, normalizeM5Error } from '@/src/features/m5/api';
import { registerPushTokenForCurrentUser } from '@/src/features/m5/pushLifecycle';
import { resolveAppHrefFromBackendPath } from '@/src/platform/linking/native';
import { getPushTokenPayload, requestPushPermission } from '@/src/platform/notifications/native';
import { tokenStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

const feedStates: Array<{ label: string; value: NotificationFeedState }> = [
  { label: '未讀', value: 'unread' },
  { label: '待行動', value: 'actionable' },
  { label: '全部', value: 'all' },
  { label: '稍後', value: 'snoozed' },
];

const feedStateLabels: Record<NotificationFeedState, string> = {
  unread: '未讀',
  actionable: '待行動',
  all: '全部',
  snoozed: '稍後',
  archived: '已封存',
};

function labelFeedState(state: NotificationFeedState): string {
  return feedStateLabels[state] ?? '提醒';
}

function getPriorityTone(priority?: string | null): 'teal' | 'coral' | 'amber' | 'blue' | 'neutral' {
  if (priority === 'now') return 'coral';
  if (priority === 'soon') return 'amber';
  if (priority === 'later') return 'blue';
  return 'neutral';
}

const notificationPriorityLabels: Record<string, string> = {
  now: '需要現在處理',
  soon: '近期提醒',
  later: '稍後提醒',
};

const notificationStatusLabels: Record<NotificationStatus, string> = {
  pending: '等待送出',
  sent: '已送出',
  failed: '送出失敗',
  cancelled: '已取消',
};

const notificationStatusTones: Record<NotificationStatus, 'teal' | 'coral' | 'amber' | 'blue' | 'neutral'> = {
  pending: 'amber',
  sent: 'teal',
  failed: 'coral',
  cancelled: 'neutral',
};

const notificationTimeFormatter = new Intl.DateTimeFormat('zh-Hant', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'numeric',
  year: 'numeric',
});

function labelNotificationBadge(item: NotificationItem): string {
  if (item.priority) return notificationPriorityLabels[item.priority] ?? '重要提醒';
  return notificationStatusLabels[item.status] ?? '提醒已更新';
}

function getNotificationBadgeTone(item: NotificationItem): 'teal' | 'coral' | 'amber' | 'blue' | 'neutral' {
  if (item.priority) return getPriorityTone(item.priority);
  return notificationStatusTones[item.status] ?? 'neutral';
}

function getNotificationTitle(item: NotificationItem): string {
  return item.render_payload?.title || '通知';
}

function getNotificationBody(item: NotificationItem): string {
  return item.render_payload?.body || '有新的狀態需要你查看。';
}

function formatNotificationTime(value?: string | null): string {
  if (!value) return '時間待同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '時間待同步';
  return notificationTimeFormatter.format(date);
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [feedState, setFeedState] = useState<NotificationFeedState>('unread');
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const authQuery = useQuery({
    queryKey: ['app', 'auth-token'],
    queryFn: () => tokenStorage.getToken(),
  });
  const isAuthenticated = Boolean(authQuery.data);

  const notificationsQuery = useQuery({
    queryKey: ['m5', 'notifications', feedState],
    queryFn: () => m5Api.notifications.list({ state: feedState, limit: 20 }),
    enabled: isAuthenticated,
  });

  const unreadQuery = useQuery({
    queryKey: ['m5', 'notifications', 'unread-count'],
    queryFn: () => m5Api.notifications.unreadCount(),
    enabled: isAuthenticated,
  });

  const refreshNotifications = async () => {
    await queryClient.invalidateQueries({ queryKey: ['m5', 'notifications'] });
  };

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => m5Api.notifications.markRead(notificationId),
    onSuccess: refreshNotifications,
  });
  const markAllReadMutation = useMutation({
    mutationFn: () => m5Api.notifications.markAllRead(),
    onSuccess: refreshNotifications,
  });
  const snoozeMutation = useMutation({
    mutationFn: (notificationId: string) => m5Api.notifications.snooze(notificationId, 24),
    onSuccess: refreshNotifications,
  });
  const dismissMutation = useMutation({
    mutationFn: (notificationId: string) => m5Api.notifications.dismiss(notificationId),
    onSuccess: refreshNotifications,
  });
  const actMutation = useMutation({
    mutationFn: (item: NotificationItem) => m5Api.notifications.act(item.id, item.action_key ?? undefined),
    onSuccess: async (result) => {
      await refreshNotifications();
      const href = resolveAppHrefFromBackendPath(result.target.path);
      captureTelemetry({
        name: 'notification_act_open',
        route: '/notifications',
        context: {
          entityType: result.target.entity_type,
          hasTarget: Boolean(result.target.path),
          notificationId: result.notification.id,
        },
      });
      router.push(href as Href);
    },
    onError: (error) => {
      captureTelemetry({
        name: 'notification_act_error',
        severity: 'error',
        route: '/notifications',
        context: {
          code: normalizeM5Error(error).code,
        },
      });
    },
  });

  const handlePushSetup = async () => {
    try {
      const permission = await requestPushPermission();
      if (permission.status !== 'granted') {
        setPushStatus(permission.canAskAgain ? '尚未授權，可稍後再開啟。' : '系統已拒絕，需要到設定中開啟。');
        return;
      }
      const tokenPayload = await getPushTokenPayload();
      if (!tokenPayload) {
        setPushStatus('目前還不能在這台裝置開啟提醒。');
        return;
      }
      const runtime = getRuntimeConfig();
      await registerPushTokenForCurrentUser(tokenPayload, runtime.appVersion);
      setPushStatus('已同步這台裝置的提醒。');
    } catch (error) {
      setPushStatus(normalizeM5Error(error).message);
    }
  };

  const errorMessage = notificationsQuery.error
    ? normalizeM5Error(notificationsQuery.error).message
    : unreadQuery.error
      ? normalizeM5Error(unreadQuery.error).message
      : markReadMutation.error
        ? normalizeM5Error(markReadMutation.error).message
        : markAllReadMutation.error
          ? normalizeM5Error(markAllReadMutation.error).message
          : snoozeMutation.error
            ? normalizeM5Error(snoozeMutation.error).message
            : dismissMutation.error
              ? normalizeM5Error(dismissMutation.error).message
              : actMutation.error
                ? normalizeM5Error(actMutation.error).message
                : null;

  if (!isAuthenticated) {
    return (
      <Screen
        eyebrow="提醒"
        title="先登入"
        subtitle="通知只承接正式案件、對話與修復旅程，需要登入後同步。"
        testID="notifications.auth-gate.screen">
        <Panel title="提醒狀態">
          <FeatureRow title="登入後同步" detail="通知讀取、稍後、封存與行動狀態會回寫後端。" tone="teal" />
          <FeatureRow title="快速整理不打擾" detail="匿名快速整理流程不會建立長期提醒通道。" tone="blue" />
        </Panel>
        <LinkButton href="/auth" label="登入或註冊" tone="teal" testID="notifications.auth-gate.login" />
      </Screen>
    );
  }

  const notifications = notificationsQuery.data?.notifications ?? [];

  return (
    <Screen
      eyebrow="提醒"
      title="通知與回到現場"
      subtitle="在該行動時回來，不讓提醒變成壓力。"
      testID="notifications.screen">
      <Panel title="通知同步">
        <View style={styles.row}>
          <StatusPill label={`未讀 ${unreadQuery.data ?? 0}`} tone="amber" />
          <StatusPill label={`目前：${labelFeedState(feedState)}`} tone="blue" />
        </View>
        <View style={styles.segment}>
          {feedStates.map((state) => (
            <ActionButton
              key={state.value}
              label={state.label}
              onPress={() => setFeedState(state.value)}
              testID={`notifications.feed.${state.value}`}
              tone={feedState === state.value ? 'teal' : 'neutral'}
              variant={feedState === state.value ? 'filled' : 'outline'}
            />
          ))}
        </View>
        <ActionButton
          disabled={!notifications.length}
          label="全部標記已讀"
          loading={markAllReadMutation.isPending}
          onPress={() => markAllReadMutation.mutate()}
          testID="notifications.mark-all-read"
          tone="blue"
          variant="outline"
        />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      <Panel title="提醒設備">
        <FeatureRow title="本機權限" detail="允許後，只用於案件、對話與修復旅程的重要提醒。" tone="teal" />
        <FeatureRow title="設備同步" detail="這台裝置會和帳號同步，登出時會先撤銷提醒通道。" tone="amber" />
        <ActionButton
          label="檢查提醒權限"
          onPress={handlePushSetup}
          testID="notifications.push-setup"
          tone="teal"
          variant="outline"
        />
        {pushStatus ? <Text style={styles.metaText}>{pushStatus}</Text> : null}
      </Panel>

      <Panel title="提醒列表">
        {notificationsQuery.isFetching ? <Text style={styles.metaText}>同步中...</Text> : null}
        {notifications.map((item) => (
          <View key={item.id} style={styles.notificationCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{getNotificationTitle(item)}</Text>
              <StatusPill label={labelNotificationBadge(item)} tone={getNotificationBadgeTone(item)} />
            </View>
            <Text style={styles.bodyText}>{getNotificationBody(item)}</Text>
            <Text
              accessibilityLabel={`提醒時間：${formatNotificationTime(item.created_at)}`}
              style={styles.metaText}
              testID={`notifications.item.${item.id}.time`}>
              提醒時間：{formatNotificationTime(item.created_at)}
            </Text>
            <View style={styles.row}>
              {item.unread ? <StatusPill label="未讀" tone="amber" /> : <StatusPill label="已讀" tone="neutral" />}
              {item.actionable ? <StatusPill label="可行動" tone="teal" /> : null}
            </View>
            <View style={styles.actions}>
              <ActionButton
                label={item.render_payload?.cta_label ?? '打開'}
                loading={actMutation.isPending}
                onPress={() => actMutation.mutate(item)}
                testID={`notifications.item.${item.id}.act`}
                tone="teal"
              />
              {item.unread ? (
                <ActionButton
                  label="已讀"
                  loading={markReadMutation.isPending}
                  onPress={() => markReadMutation.mutate(item.id)}
                  testID={`notifications.item.${item.id}.read`}
                  tone="blue"
                  variant="outline"
                />
              ) : null}
              <ActionButton
                label="稍後 24h"
                loading={snoozeMutation.isPending}
                onPress={() => snoozeMutation.mutate(item.id)}
                testID={`notifications.item.${item.id}.snooze`}
                tone="amber"
                variant="outline"
              />
              <ActionButton
                label="封存"
                loading={dismissMutation.isPending}
                onPress={() => dismissMutation.mutate(item.id)}
                testID={`notifications.item.${item.id}.dismiss`}
                tone="neutral"
                variant="outline"
              />
            </View>
          </View>
        ))}
        {notifications.length ? null : <Text style={styles.emptyText}>目前沒有這類提醒。</Text>}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segment: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
  notificationCard: {
    gap: spacing.sm,
    borderRadius: 8,
    backgroundColor: palette.panel,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cardTitle: {
    ...typography.bodyStrong,
    color: palette.ink,
    flex: 1,
  },
  bodyText: {
    ...typography.body,
    color: palette.ink,
  },
  metaText: {
    ...typography.small,
    color: palette.muted,
  },
  emptyText: {
    ...typography.small,
    color: palette.muted,
  },
  errorText: {
    ...typography.small,
    color: palette.coral,
  },
});
