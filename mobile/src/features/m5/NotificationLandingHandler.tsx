import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
  getLastNotificationLandingTarget,
  subscribeToNotificationLandingTargets,
} from '@/src/platform/notifications/native';
import type { NotificationLandingTarget } from '@/src/platform/notifications/types';
import { buildAuthHrefForPostLogin, requiresAuthForAppLandingHref } from '@/src/platform/linking/authGate';
import { pendingLandingStorage, tokenStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';

function getDedupeKey(target: NotificationLandingTarget): string {
  return `${target.requestId ?? 'unknown'}:${target.notificationId ?? 'unknown'}:${target.href}`;
}

export function NotificationLandingHandler() {
  const router = useRouter();
  const handledTargets = useRef(new Set<string>());

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    const openTarget = async (target: NotificationLandingTarget, source: 'cold_start' | 'response') => {
      const dedupeKey = getDedupeKey(target);
      if (handledTargets.current.has(dedupeKey)) return;
      handledTargets.current.add(dedupeKey);

      const hasToken = Boolean(await tokenStorage.getToken());
      if (!hasToken && requiresAuthForAppLandingHref(target.href)) {
        await pendingLandingStorage.setPendingHref(target.href);
        captureTelemetry({
          name: 'notification_landing_deferred',
          route: '/auth',
          context: {
            hasSourcePath: Boolean(target.sourcePath),
            notificationId: target.notificationId ?? null,
            source,
            targetHref: target.href,
          },
        });
        router.push(buildAuthHrefForPostLogin(target.href) as Href);
        return;
      }

      captureTelemetry({
        name: 'notification_landing_open',
        route: '/notifications',
        context: {
          hasSourcePath: Boolean(target.sourcePath),
          notificationId: target.notificationId ?? null,
          source,
          targetHref: target.href,
        },
      });
      router.push(target.href as Href);
    };

    void getLastNotificationLandingTarget().then((target) => {
      if (!disposed && target) {
        void openTarget(target, 'cold_start');
      }
    });

    void subscribeToNotificationLandingTargets((target) => {
      if (!disposed) {
        void openTarget(target, 'response');
      }
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unsubscribe = cleanup;
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [router]);

  return null;
}
