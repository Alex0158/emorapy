const mockCaptureTelemetry = jest.fn();
const mockSpanEnd = jest.fn();
const mockStartTelemetrySpan = jest.fn(() => ({ end: mockSpanEnd }));
const mockGetCurrentLifecycleStatus = jest.fn();
const mockSubscribeLifecycle = jest.fn();
const mockInitializeNativeCrashReporting = jest.fn();

jest.mock('@/src/platform/telemetry/client', () => ({
  captureTelemetry: (...args) => mockCaptureTelemetry(...args),
  startTelemetrySpan: (...args) => mockStartTelemetrySpan(...args),
}));

jest.mock('@/src/platform/lifecycle/native', () => ({
  getCurrentLifecycleStatus: (...args) => mockGetCurrentLifecycleStatus(...args),
  subscribeLifecycle: (...args) => mockSubscribeLifecycle(...args),
}));

jest.mock('@/src/platform/telemetry/nativeCrash', () => ({
  initializeNativeCrashReporting: (...args) => mockInitializeNativeCrashReporting(...args),
}));

const {
  installTelemetryCrashHandlers,
  startAppObservability,
  __resetTelemetryObservabilityForTests,
} = require('./observability');

describe('App telemetry observability bootstrap', () => {
  const originalErrorUtils = global.ErrorUtils;
  const originalAddEventListener = global.addEventListener;
  const originalRemoveEventListener = global.removeEventListener;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetTelemetryObservabilityForTests();
    mockGetCurrentLifecycleStatus.mockReturnValue('active');
    mockSubscribeLifecycle.mockReturnValue(jest.fn());
    mockInitializeNativeCrashReporting.mockReturnValue({
      enabled: false,
      provider: 'sentry',
      reason: 'missing_dsn',
    });
  });

  afterEach(() => {
    global.ErrorUtils = originalErrorUtils;
    global.addEventListener = originalAddEventListener;
    global.removeEventListener = originalRemoveEventListener;
  });

  it('captures app session start, boot span, and lifecycle transitions', () => {
    const unsubscribe = jest.fn();
    mockSubscribeLifecycle.mockReturnValue(unsubscribe);

    const dispose = startAppObservability();
    const lifecycleListener = mockSubscribeLifecycle.mock.calls[0][0];
    lifecycleListener('background');

    expect(mockStartTelemetrySpan).toHaveBeenCalledWith({
      name: 'app.boot',
      route: '/app',
      context: {
        lifecycleStatus: 'active',
        nativeCrashProvider: 'sentry',
        nativeCrashReportingEnabled: false,
      },
    });
    expect(mockSpanEnd).toHaveBeenCalledWith('ok', {
      lifecycleStatus: 'active',
      crashHandlersInstalled: expect.any(Boolean),
      nativeCrashProvider: 'sentry',
      nativeCrashReportingEnabled: false,
    });
    expect(mockCaptureTelemetry).toHaveBeenCalledWith({
      name: 'app_session_start',
      severity: 'info',
      route: '/app',
      context: {
        lifecycleStatus: 'active',
        crashHandlersInstalled: expect.any(Boolean),
        nativeCrashProvider: 'sentry',
        nativeCrashReason: 'missing_dsn',
        nativeCrashReportingEnabled: false,
      },
    });
    expect(mockCaptureTelemetry).toHaveBeenCalledWith({
      name: 'app_lifecycle_transition',
      severity: 'warning',
      route: '/app',
      context: { lifecycleStatus: 'background' },
    });

    dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('installs a global JS fatal handler without sending raw error messages', () => {
    const previousHandler = jest.fn();
    const setGlobalHandler = jest.fn();
    global.ErrorUtils = {
      getGlobalHandler: () => previousHandler,
      setGlobalHandler,
    };

    const result = installTelemetryCrashHandlers();
    const handler = setGlobalHandler.mock.calls[0][0];
    handler(new Error('secret token leaked'), true);

    expect(result.installed).toBe(true);
    expect(mockCaptureTelemetry).toHaveBeenCalledWith({
      name: 'app_js_fatal',
      severity: 'error',
      route: '/app',
      context: {
        isFatal: true,
        errorName: 'Error',
        hasMessage: true,
      },
    });
    expect(previousHandler).toHaveBeenCalledWith(expect.any(Error), true);
    expect(JSON.stringify(mockCaptureTelemetry.mock.calls)).not.toContain('secret token leaked');
  });

  it('captures unhandled promise rejections when the runtime exposes a listener API', () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.addEventListener = addEventListener;
    global.removeEventListener = removeEventListener;

    const result = installTelemetryCrashHandlers();
    const listener = addEventListener.mock.calls[0][1];
    listener({ reason: new TypeError('private failure') });
    result.dispose();

    expect(addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    expect(mockCaptureTelemetry).toHaveBeenCalledWith({
      name: 'app_unhandled_promise',
      severity: 'error',
      route: '/app',
      context: {
        isFatal: false,
        errorName: 'TypeError',
        hasMessage: true,
      },
    });
    expect(removeEventListener).toHaveBeenCalledWith('unhandledrejection', listener);
    expect(JSON.stringify(mockCaptureTelemetry.mock.calls)).not.toContain('private failure');
  });
});
