import {
  getCurrentLifecycleStatus,
  subscribeLifecycle,
  type AppLifecycleStatus,
} from '@/src/platform/lifecycle/native';
import { captureTelemetry, startTelemetrySpan } from '@/src/platform/telemetry/client';
import { initializeNativeCrashReporting } from '@/src/platform/telemetry/nativeCrash';

type ErrorUtilsLike = {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

type RejectionEventLike = {
  reason?: unknown;
};

type GlobalWithHandlers = typeof globalThis & {
  ErrorUtils?: ErrorUtilsLike;
  addEventListener?: (type: string, listener: (event: RejectionEventLike) => void) => void;
  removeEventListener?: (type: string, listener: (event: RejectionEventLike) => void) => void;
};

let crashHandlersInstalled = false;
let rejectionListener: ((event: RejectionEventLike) => void) | null = null;

function readErrorName(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.slice(0, 80);
  }
  return typeof error === 'string' ? 'StringError' : 'UnknownError';
}

function hasMessage(error: unknown): boolean {
  return Boolean(error instanceof Error && error.message);
}

function emitCrashEvent(name: string, error: unknown, context: Record<string, string | number | boolean | null> = {}) {
  captureTelemetry({
    name,
    severity: 'error',
    route: '/app',
    context: {
      ...context,
      errorName: readErrorName(error),
      hasMessage: hasMessage(error),
    },
  });
}

export function installTelemetryCrashHandlers(): { installed: boolean; dispose(): void } {
  if (crashHandlersInstalled) {
    return { installed: true, dispose: () => undefined };
  }

  const globalObject = globalThis as GlobalWithHandlers;
  const errorUtils = globalObject.ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler?.();
  const canInstallGlobalHandler = typeof errorUtils?.setGlobalHandler === 'function';

  if (canInstallGlobalHandler) {
    errorUtils.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
      emitCrashEvent(isFatal ? 'app_js_fatal' : 'app_js_error', error, {
        isFatal: Boolean(isFatal),
      });
      previousHandler?.(error, isFatal);
    });
  }

  if (typeof globalObject.addEventListener === 'function') {
    rejectionListener = (event: RejectionEventLike) => {
      emitCrashEvent('app_unhandled_promise', event.reason, {
        isFatal: false,
      });
    };
    globalObject.addEventListener('unhandledrejection', rejectionListener);
  }

  crashHandlersInstalled = true;

  return {
    installed: canInstallGlobalHandler || Boolean(rejectionListener),
    dispose() {
      if (rejectionListener && typeof globalObject.removeEventListener === 'function') {
        globalObject.removeEventListener('unhandledrejection', rejectionListener);
      }
      rejectionListener = null;
    },
  };
}

function severityForLifecycle(status: AppLifecycleStatus) {
  return status === 'active' ? 'info' : 'warning';
}

export function startAppObservability(): () => void {
  const lifecycleStatus = getCurrentLifecycleStatus();
  const nativeCrashReporting = initializeNativeCrashReporting();
  const bootSpan = startTelemetrySpan({
    name: 'app.boot',
    route: '/app',
    context: {
      lifecycleStatus,
      nativeCrashReportingEnabled: nativeCrashReporting.enabled,
      nativeCrashProvider: nativeCrashReporting.provider,
    },
  });
  const crashHandlers = installTelemetryCrashHandlers();

  captureTelemetry({
    name: 'app_session_start',
    severity: 'info',
    route: '/app',
    context: {
      lifecycleStatus,
      crashHandlersInstalled: crashHandlers.installed,
      nativeCrashReportingEnabled: nativeCrashReporting.enabled,
      nativeCrashProvider: nativeCrashReporting.provider,
      nativeCrashReason: nativeCrashReporting.reason,
    },
  });
  bootSpan.end('ok', {
    lifecycleStatus,
    crashHandlersInstalled: crashHandlers.installed,
    nativeCrashReportingEnabled: nativeCrashReporting.enabled,
    nativeCrashProvider: nativeCrashReporting.provider,
  });

  const unsubscribeLifecycle = subscribeLifecycle((status) => {
    captureTelemetry({
      name: 'app_lifecycle_transition',
      severity: severityForLifecycle(status),
      route: '/app',
      context: { lifecycleStatus: status },
    });
  });

  return () => {
    unsubscribeLifecycle();
  };
}

export function __resetTelemetryObservabilityForTests() {
  crashHandlersInstalled = false;
  rejectionListener = null;
}
