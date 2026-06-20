import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/react-native';
import { Platform } from 'react-native';

import { getRuntimeConfig } from '@/src/config/runtime';

export type NativeCrashReportingState =
  | {
      enabled: true;
      provider: 'sentry';
      reason: 'initialized' | 'already_initialized';
    }
  | {
      enabled: false;
      provider: 'sentry';
      reason: 'init_failed' | 'missing_dsn' | 'web_platform';
    };

let initialized = false;
const sensitiveKeyPattern = /(authorization|password|secret|session|token)/i;

function sanitizeScalarContext(
  context: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[redacted]' : value,
    ])
  );
}

function sanitizeRecord(
  value: Record<string, unknown> | undefined
): Record<string, string | number | boolean | null> | undefined {
  if (!value) return undefined;
  const scalarEntries = Object.entries(value)
    .filter(([, entryValue]) => {
      return (
        typeof entryValue === 'string' ||
        typeof entryValue === 'number' ||
        typeof entryValue === 'boolean' ||
        entryValue === null
      );
    })
    .map(([key, entryValue]) => [key, entryValue as string | number | boolean | null]);
  return sanitizeScalarContext(Object.fromEntries(scalarEntries));
}

function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const exceptionValues = event.exception?.values?.map((exception) => ({
    ...exception,
    value: exception.value ? '[redacted]' : exception.value,
  }));

  return {
    ...event,
    breadcrumbs: undefined,
    extra: sanitizeRecord(event.extra as Record<string, unknown> | undefined),
    message: event.message ? '[redacted]' : event.message,
    request: undefined,
    user: undefined,
    exception: event.exception
      ? {
          ...event.exception,
          values: exceptionValues,
        }
      : event.exception,
  };
}

export function initializeNativeCrashReporting(): NativeCrashReportingState {
  const runtime = getRuntimeConfig();

  if (Platform.OS === 'web') {
    return { enabled: false, provider: 'sentry', reason: 'web_platform' };
  }

  if (!runtime.sentryDsn) {
    return { enabled: false, provider: 'sentry', reason: 'missing_dsn' };
  }

  if (initialized) {
    return { enabled: true, provider: 'sentry', reason: 'already_initialized' };
  }

  try {
    Sentry.init({
      dsn: runtime.sentryDsn,
      dist: runtime.buildNumber,
      enableAutoSessionTracking: true,
      enableNative: true,
      enableNativeCrashHandling: true,
      enableNativeNagger: false,
      environment: runtime.sentryEnvironment,
      release: `emorapy-mobile@${runtime.appVersion}+${runtime.buildNumber}`,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: sanitizeSentryEvent,
    });
    Sentry.setTag('emorapy.platform', 'mobile');
    Sentry.setTag('emorapy.app_version', runtime.appVersion);
    Sentry.setTag('emorapy.build_number', runtime.buildNumber);
  } catch {
    return { enabled: false, provider: 'sentry', reason: 'init_failed' };
  }
  initialized = true;

  return { enabled: true, provider: 'sentry', reason: 'initialized' };
}

export function __resetNativeCrashReportingForTests() {
  initialized = false;
}
