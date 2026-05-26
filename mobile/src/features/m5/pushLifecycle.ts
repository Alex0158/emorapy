import type { PushTokenPayload } from '@/src/platform/notifications/types';
import {
  clearAppStorage,
  getDeviceMetadata,
  setDeviceMetadata,
} from '@/src/platform/storage/secureStore';
import type { DeviceMetadata } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';

import { m5Api, normalizeM5Error } from './api';

export async function registerPushTokenForCurrentUser(
  tokenPayload: PushTokenPayload,
  appVersion?: string
) {
  const metadata = await getDeviceMetadata();
  if (metadata?.pushToken && metadata.pushToken !== tokenPayload.token) {
    await revokePushToken(metadata.pushToken, metadata.platform, 'rotation');
  }

  const deviceToken = await m5Api.notifications.registerDeviceToken({
    token: tokenPayload.token,
    platform: tokenPayload.platform,
    app_version: appVersion,
  });

  await setDeviceMetadata({
    appVersion,
    platform: tokenPayload.platform,
    pushToken: tokenPayload.token,
  });

  return deviceToken;
}

async function revokePushToken(
  token: string,
  platform?: DeviceMetadata['platform'],
  reason: 'logout' | 'rotation' = 'logout'
): Promise<{ revoked: boolean; reason?: string }> {
  try {
    await m5Api.notifications.revokeDeviceToken({ token });
    return { revoked: true };
  } catch (error) {
    const normalized = normalizeM5Error(error);
    captureTelemetry({
      name: 'app_push_token_revoke_failed',
      severity: 'warning',
      context: {
        code: normalized.code,
        hasPushToken: true,
        platform: platform ?? 'unknown',
        reason,
      },
    });
    return { revoked: false, reason: 'request_failed' };
  }
}

export async function revokeStoredPushToken(): Promise<{ revoked: boolean; reason?: string }> {
  const metadata = await getDeviceMetadata();
  if (!metadata?.pushToken) {
    return { revoked: false, reason: 'missing_push_token' };
  }

  return revokePushToken(metadata.pushToken, metadata.platform, 'logout');
}

export async function clearAppStorageWithPushCleanup(): Promise<void> {
  await revokeStoredPushToken();
  await clearAppStorage();
}
