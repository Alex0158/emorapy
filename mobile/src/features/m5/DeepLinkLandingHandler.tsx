import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
  getInitialAppLandingTarget,
  subscribeToAppLandingTargets,
  type AppDeepLinkLandingTarget,
} from '@/src/platform/linking/native';
import { buildAuthHrefForPostLogin, requiresAuthForAppLandingHref } from '@/src/platform/linking/authGate';
import { pendingLandingStorage, tokenStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';

function getDedupeKey(target: AppDeepLinkLandingTarget): string {
  return `${target.sourceUrl}:${target.href}`;
}

export function DeepLinkLandingHandler() {
  const router = useRouter();
  const handledTargets = useRef(new Set<string>());

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    const openTarget = async (target: AppDeepLinkLandingTarget, source: 'cold_start' | 'url') => {
      const dedupeKey = getDedupeKey(target);
      if (handledTargets.current.has(dedupeKey)) return;
      handledTargets.current.add(dedupeKey);

      const hasToken = Boolean(await tokenStorage.getToken());
      if (!hasToken && requiresAuthForAppLandingHref(target.href)) {
        await pendingLandingStorage.setPendingHref(target.href);
        captureTelemetry({
          name: 'deep_link_landing_deferred',
          route: '/auth',
          context: {
            source,
            sourcePath: target.sourcePath,
            targetHref: target.href,
          },
        });
        router.push(buildAuthHrefForPostLogin(target.href) as Href);
        return;
      }

      captureTelemetry({
        name: 'deep_link_landing_open',
        route: target.href.split('?')[0] || '/',
        context: {
          source,
          sourcePath: target.sourcePath,
          targetHref: target.href,
        },
      });
      router.push(target.href as Href);
    };

    void getInitialAppLandingTarget().then((target) => {
      if (!disposed && target) {
        void openTarget(target, 'cold_start');
      }
    });

    void subscribeToAppLandingTargets((target) => {
      if (!disposed) {
        void openTarget(target, 'url');
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
