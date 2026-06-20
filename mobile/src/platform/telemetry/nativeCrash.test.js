const mockSentryInit = jest.fn();
const mockSetTag = jest.fn();

jest.mock('@sentry/react-native', () => ({
  init: (...args) => mockSentryInit(...args),
  setTag: (...args) => mockSetTag(...args),
}));

let mockRuntimeConfig;
jest.mock('@/src/config/runtime', () => ({
  getRuntimeConfig: () => mockRuntimeConfig,
}));

const {
  __resetNativeCrashReportingForTests,
  initializeNativeCrashReporting,
} = require('./nativeCrash');

describe('Native crash reporting adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetNativeCrashReportingForTests();
    mockRuntimeConfig = {
      apiBaseUrl: 'http://127.0.0.1:3001/api/v1',
      appVersion: '1.2.3-test',
      buildNumber: '42-test',
      locale: 'zh-TW',
      requestTimeoutMs: 30000,
      sentryDsn: undefined,
      sentryEnvironment: 'test',
    };
  });

  afterEach(() => {
    __resetNativeCrashReportingForTests();
  });

  it('stays disabled without a Sentry DSN', () => {
    expect(initializeNativeCrashReporting()).toEqual({
      enabled: false,
      provider: 'sentry',
      reason: 'missing_dsn',
    });
    expect(mockSentryInit).not.toHaveBeenCalled();
  });

  it('initializes Sentry native crash handling with safe defaults', () => {
    mockRuntimeConfig.sentryDsn = 'https://public@example.ingest.sentry.io/1';

    expect(initializeNativeCrashReporting()).toEqual({
      enabled: true,
      provider: 'sentry',
      reason: 'initialized',
    });
    expect(initializeNativeCrashReporting()).toEqual({
      enabled: true,
      provider: 'sentry',
      reason: 'already_initialized',
    });

    expect(mockSentryInit).toHaveBeenCalledTimes(1);
    expect(mockSentryInit).toHaveBeenCalledWith(expect.objectContaining({
      dsn: 'https://public@example.ingest.sentry.io/1',
      dist: '42-test',
      enableAutoSessionTracking: true,
      enableNative: true,
      enableNativeCrashHandling: true,
      enableNativeNagger: false,
      environment: 'test',
      release: 'emorapy-mobile@1.2.3-test+42-test',
      sendDefaultPii: false,
      tracesSampleRate: 0,
    }));
    expect(mockSetTag).toHaveBeenCalledWith('emorapy.platform', 'mobile');
    expect(mockSetTag).toHaveBeenCalledWith('emorapy.app_version', '1.2.3-test');
    expect(mockSetTag).toHaveBeenCalledWith('emorapy.build_number', '42-test');
  });

  it('redacts Sentry event payload fields before sending', () => {
    mockRuntimeConfig.sentryDsn = 'https://public@example.ingest.sentry.io/1';
    initializeNativeCrashReporting();

    const options = mockSentryInit.mock.calls[0][0];
    const sanitized = options.beforeSend({
      breadcrumbs: [{ message: 'secret route' }],
      exception: {
        values: [{ type: 'Error', value: 'secret token leaked' }],
      },
      extra: {
        count: 2,
        nested: { unsafe: true },
        sessionId: 'session-1',
        token: 'secret',
      },
      message: 'private message',
      request: { headers: { authorization: 'bearer jwt' } },
      user: { id: 'user-1' },
    });

    expect(sanitized).toEqual(expect.objectContaining({
      breadcrumbs: undefined,
      extra: {
        count: 2,
        sessionId: '[redacted]',
        token: '[redacted]',
      },
      message: '[redacted]',
      request: undefined,
      user: undefined,
    }));
    expect(sanitized.exception.values[0]).toEqual({
      type: 'Error',
      value: '[redacted]',
    });
    expect(JSON.stringify(sanitized)).not.toContain('secret token leaked');
    expect(JSON.stringify(sanitized)).not.toContain('bearer jwt');
  });

  it('fails closed if Sentry native initialization throws', () => {
    mockRuntimeConfig.sentryDsn = 'https://public@example.ingest.sentry.io/1';
    mockSentryInit.mockImplementationOnce(() => {
      throw new Error('native module not configured');
    });

    expect(initializeNativeCrashReporting()).toEqual({
      enabled: false,
      provider: 'sentry',
      reason: 'init_failed',
    });
    expect(mockSetTag).not.toHaveBeenCalled();
    expect(initializeNativeCrashReporting()).toEqual({
      enabled: true,
      provider: 'sentry',
      reason: 'initialized',
    });
  });
});
