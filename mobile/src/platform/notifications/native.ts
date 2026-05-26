import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { resolveAppHrefFromBackendPath } from '@/src/platform/linking/native';

import type { NotificationLandingTarget, PushPermissionResult, PushTokenPayload } from './types';

type ExpoNotificationsModule = typeof import('expo-notifications');

function isNativePushPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

async function loadExpoNotifications(): Promise<ExpoNotificationsModule | null> {
  if (!isNativePushPlatform()) return null;
  return import('expo-notifications');
}

function toPermissionStatus(status: string): PushPermissionResult['status'] {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function requestPushPermission(): Promise<PushPermissionResult> {
  const notifications = await loadExpoNotifications();
  if (!notifications) {
    return {
      status: 'undetermined',
      canAskAgain: false,
    };
  }

  const current = await notifications.getPermissionsAsync();
  const permission = current.granted ? current : await notifications.requestPermissionsAsync();
  return {
    status: toPermissionStatus(permission.status),
    canAskAgain: permission.canAskAgain,
  };
}

export async function getPushTokenPayload(): Promise<PushTokenPayload | null> {
  const notifications = await loadExpoNotifications();
  if (!notifications) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const token = await notifications.getExpoPushTokenAsync({ projectId });
  return {
    token: token.data,
    platform: Platform.OS as 'ios' | 'android',
  };
}

function readRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function readString(input: unknown): string | null {
  return typeof input === 'string' && input.trim().length > 0 ? input : null;
}

export function resolveNotificationLandingTargetFromData(
  rawData?: Record<string, unknown> | null,
  requestId?: string
): NotificationLandingTarget | null {
  const data = readRecord(rawData);
  const renderPayload = readRecord(data.render_payload);
  const sourcePath =
    readString(data.path)
    ?? readString(data.target_path)
    ?? readString(data.deep_link_path)
    ?? readString(renderPayload.path);
  const notificationId =
    readString(data.notification_id)
    ?? readString(data.notificationId)
    ?? readString(data.id);
  const actionKey =
    readString(data.action_key)
    ?? readString(data.actionKey)
    ?? readString(renderPayload.action_key);

  if (!sourcePath && !notificationId && !actionKey) {
    return null;
  }

  return {
    href: resolveAppHrefFromBackendPath(sourcePath),
    sourcePath,
    ...(notificationId ? { notificationId } : {}),
    ...(actionKey ? { actionKey } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

function resolveNotificationResponseTarget(response: unknown): NotificationLandingTarget | null {
  const record = readRecord(response);
  const notification = readRecord(record.notification);
  const request = readRecord(notification.request);
  const content = readRecord(request.content);
  return resolveNotificationLandingTargetFromData(
    readRecord(content.data),
    readString(request.identifier) ?? undefined
  );
}

export async function getLastNotificationLandingTarget(): Promise<NotificationLandingTarget | null> {
  const notifications = await loadExpoNotifications();
  if (!notifications || typeof notifications.getLastNotificationResponseAsync !== 'function') {
    return null;
  }
  const response = await notifications.getLastNotificationResponseAsync();
  return resolveNotificationResponseTarget(response);
}

export async function subscribeToNotificationLandingTargets(
  onTarget: (target: NotificationLandingTarget) => void
): Promise<() => void> {
  const notifications = await loadExpoNotifications();
  if (!notifications || typeof notifications.addNotificationResponseReceivedListener !== 'function') {
    return () => undefined;
  }

  const subscription = notifications.addNotificationResponseReceivedListener((response) => {
    const target = resolveNotificationResponseTarget(response);
    if (target) {
      onTarget(target);
    }
  });

  return () => {
    subscription.remove();
  };
}
