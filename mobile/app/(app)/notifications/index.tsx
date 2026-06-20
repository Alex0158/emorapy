import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationFeedState, NotificationItem, NotificationStatus } from '@emorapy/api-client';

import { getRuntimeConfig } from '@/src/config/runtime';
import { m5Api, normalizeM5Error } from '@/src/features/m5/api';
import { registerPushTokenForCurrentUser } from '@/src/features/m5/pushLifecycle';
import { getLocale, t, useLocale } from '@/src/i18n';
import { resolveAppHrefFromBackendPath } from '@/src/platform/linking/native';
import { getPushTokenPayload, requestPushPermission } from '@/src/platform/notifications/native';
import { tokenStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

const feedStates: NotificationFeedState[] = ['unread', 'actionable', 'all', 'snoozed'];

const feedStateLabelKeys: Record<NotificationFeedState, string> = {
  unread: 'notifications.feed.unread',
  actionable: 'notifications.feed.actionable',
  all: 'notifications.feed.all',
  snoozed: 'notifications.feed.snoozed',
  archived: 'notifications.feed.archived',
};

function labelFeedState(state: NotificationFeedState): string {
  return t(feedStateLabelKeys[state] ?? 'notifications.feed.fallback');
}

function getPriorityTone(priority?: string | null): 'teal' | 'coral' | 'amber' | 'blue' | 'neutral' {
  if (priority === 'now') return 'coral';
  if (priority === 'soon') return 'amber';
  if (priority === 'later') return 'blue';
  return 'neutral';
}

const notificationPriorityLabelKeys: Record<string, string> = {
  now: 'notifications.priority.now',
  soon: 'notifications.priority.soon',
  later: 'notifications.priority.later',
};

const notificationStatusLabelKeys: Record<NotificationStatus, string> = {
  pending: 'notifications.status.pending',
  sent: 'notifications.status.sent',
  failed: 'notifications.status.failed',
  cancelled: 'notifications.status.cancelled',
};

const notificationStatusTones: Record<NotificationStatus, 'teal' | 'coral' | 'amber' | 'blue' | 'neutral'> = {
  pending: 'amber',
  sent: 'teal',
  failed: 'coral',
  cancelled: 'neutral',
};

function labelNotificationBadge(item: NotificationItem): string {
  if (item.priority) return t(notificationPriorityLabelKeys[item.priority] ?? 'notifications.priority.fallback');
  return t(notificationStatusLabelKeys[item.status] ?? 'notifications.status.updated');
}

function getNotificationBadgeTone(item: NotificationItem): 'teal' | 'coral' | 'amber' | 'blue' | 'neutral' {
  if (item.priority) return getPriorityTone(item.priority);
  return notificationStatusTones[item.status] ?? 'neutral';
}

function getNotificationTitle(item: NotificationItem): string {
  return item.render_payload?.title || t('notifications.fallback.title');
}

function getNotificationBody(item: NotificationItem): string {
  return item.render_payload?.body || t('notifications.fallback.body');
}

function formatNotificationTime(value?: string | null): string {
  if (!value) return t('notifications.time.unsynced');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('notifications.time.unsynced');
  return new Intl.DateTimeFormat(getLocale() === 'en-US' ? 'en-US' : 'zh-Hant', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function NotificationsScreen() {
  useLocale();
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
        setPushStatus(permission.canAskAgain ? t('notifications.push.deniedCanAsk') : t('notifications.push.deniedBlocked'));
        return;
      }
      const tokenPayload = await getPushTokenPayload();
      if (!tokenPayload) {
        setPushStatus(t('notifications.push.unsupported'));
        return;
      }
      const runtime = getRuntimeConfig();
      await registerPushTokenForCurrentUser(tokenPayload, runtime.appVersion);
      setPushStatus(t('notifications.push.synced'));
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
        eyebrow={t('notifications.eyebrow')}
        title={t('notifications.authGate.title')}
        subtitle={t('notifications.authGate.subtitle')}
        testID="notifications.auth-gate.screen">
        <Panel title={t('notifications.authGate.panel')}>
          <FeatureRow title={t('notifications.authGate.sync.title')} detail={t('notifications.authGate.sync.detail')} tone="teal" />
          <FeatureRow title={t('notifications.authGate.quick.title')} detail={t('notifications.authGate.quick.detail')} tone="blue" />
        </Panel>
        <LinkButton href="/auth" label={t('profile.authGate.login')} tone="teal" testID="notifications.auth-gate.login" />
      </Screen>
    );
  }

  const notifications = notificationsQuery.data?.notifications ?? [];

  return (
    <Screen
      eyebrow={t('notifications.eyebrow')}
      title={t('notifications.title')}
      subtitle={t('notifications.subtitle')}
      testID="notifications.screen">
      <Panel title={t('notifications.syncPanel')}>
        <View style={styles.row}>
          <StatusPill label={t('notifications.unreadCount', { count: unreadQuery.data ?? 0 })} tone="amber" />
          <StatusPill label={t('notifications.currentFeed', { state: labelFeedState(feedState) })} tone="blue" />
        </View>
        <View style={styles.segment}>
          {feedStates.map((state) => (
            <ActionButton
              key={state}
              label={labelFeedState(state)}
              onPress={() => setFeedState(state)}
              testID={`notifications.feed.${state}`}
              tone={feedState === state ? 'teal' : 'neutral'}
              variant={feedState === state ? 'filled' : 'outline'}
            />
          ))}
        </View>
        <ActionButton
          disabled={!notifications.length}
          label={t('notifications.markAllRead')}
          loading={markAllReadMutation.isPending}
          onPress={() => markAllReadMutation.mutate()}
          testID="notifications.mark-all-read"
          tone="blue"
          variant="outline"
        />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      <Panel title={t('notifications.devicePanel')}>
        <FeatureRow title={t('notifications.localPermission.title')} detail={t('notifications.localPermission.detail')} tone="teal" />
        <FeatureRow title={t('notifications.deviceSync.title')} detail={t('notifications.deviceSync.detail')} tone="amber" />
        <ActionButton
          label={t('notifications.pushSetup')}
          onPress={handlePushSetup}
          testID="notifications.push-setup"
          tone="teal"
          variant="outline"
        />
        {pushStatus ? <Text style={styles.metaText}>{pushStatus}</Text> : null}
      </Panel>

      <Panel title={t('notifications.listPanel')}>
        {notificationsQuery.isFetching ? <Text style={styles.metaText}>{t('notifications.syncing')}</Text> : null}
        {notifications.map((item) => (
          <View key={item.id} style={styles.notificationCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{getNotificationTitle(item)}</Text>
              <StatusPill label={labelNotificationBadge(item)} tone={getNotificationBadgeTone(item)} />
            </View>
            <Text style={styles.bodyText}>{getNotificationBody(item)}</Text>
            <Text
              accessibilityLabel={t('notifications.time.accessibility', { time: formatNotificationTime(item.created_at) })}
              style={styles.metaText}
              testID={`notifications.item.${item.id}.time`}>
              {t('notifications.time.prefix', { time: formatNotificationTime(item.created_at) })}
            </Text>
            <View style={styles.row}>
              {item.unread ? <StatusPill label={t('notifications.unread')} tone="amber" /> : <StatusPill label={t('notifications.read')} tone="neutral" />}
              {item.actionable ? <StatusPill label={t('notifications.actionable')} tone="teal" /> : null}
            </View>
            <View style={styles.actions}>
              <ActionButton
                label={item.render_payload?.cta_label ?? t('notifications.open')}
                loading={actMutation.isPending}
                onPress={() => actMutation.mutate(item)}
                testID={`notifications.item.${item.id}.act`}
                tone="teal"
              />
              {item.unread ? (
                <ActionButton
                  label={t('notifications.markRead')}
                  loading={markReadMutation.isPending}
                  onPress={() => markReadMutation.mutate(item.id)}
                  testID={`notifications.item.${item.id}.read`}
                  tone="blue"
                  variant="outline"
                />
              ) : null}
              <ActionButton
                label={t('notifications.snooze24h')}
                loading={snoozeMutation.isPending}
                onPress={() => snoozeMutation.mutate(item.id)}
                testID={`notifications.item.${item.id}.snooze`}
                tone="amber"
                variant="outline"
              />
              <ActionButton
                label={t('notifications.archive')}
                loading={dismissMutation.isPending}
                onPress={() => dismissMutation.mutate(item.id)}
                testID={`notifications.item.${item.id}.dismiss`}
                tone="neutral"
                variant="outline"
              />
            </View>
          </View>
        ))}
        {notifications.length ? null : <Text style={styles.emptyText}>{t('notifications.empty')}</Text>}
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
