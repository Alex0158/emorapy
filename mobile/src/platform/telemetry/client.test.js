jest.mock('@/src/config/runtime', () => ({
  getRuntimeConfig: () => ({
    appVersion: '1.2.3-test',
    buildNumber: '42-test',
  }),
}));

const mockTelemetryPost = jest.fn();
jest.mock('@/src/platform/api/client', () => ({
  appApiClient: {
    instance: {
      post: (...args) => mockTelemetryPost(...args),
    },
  },
}));

const {
  __resetTelemetryClientForTests,
  captureTelemetry,
  initializeOpenTelemetryProvider,
  sanitizeTelemetryContext,
  startTelemetrySpan,
} = require('./client');

describe('Telemetry platform adapter', () => {
  beforeEach(() => {
    __resetTelemetryClientForTests();
    jest.clearAllMocks();
    mockTelemetryPost.mockResolvedValue({ status: 202 });
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    __resetTelemetryClientForTests();
    jest.restoreAllMocks();
  });

  it('redacts token/session-like context keys before logging', () => {
    expect(sanitizeTelemetryContext({
      route: '/case',
      sessionId: 'session-1',
      authToken: 'jwt',
      count: 2,
    })).toEqual({
      route: '/case',
      sessionId: '[redacted]',
      authToken: '[redacted]',
      count: 2,
    });
  });

  it('captures safe info and error telemetry with runtime version', () => {
    captureTelemetry({
      name: 'notification_open',
      route: '/notifications',
      context: { token: 'secret', target: '/repair' },
    });
    captureTelemetry({
      name: 'notification_error',
      severity: 'error',
      context: { session_id: 'session-1' },
    });

    expect(console.info).toHaveBeenCalledWith('[cj-app-telemetry]', expect.objectContaining({
      appVersion: '1.2.3-test',
      buildNumber: '42-test',
      context: { token: '[redacted]', target: '/repair' },
      severity: 'info',
    }));
    expect(console.error).toHaveBeenCalledWith('[cj-app-telemetry]', expect.objectContaining({
      context: { session_id: '[redacted]' },
      severity: 'error',
    }));
    expect(mockTelemetryPost).toHaveBeenCalledWith('/telemetry/events', {
      events: [
        expect.objectContaining({
          app_version: '1.2.3-test',
          build_number: '42-test',
          context: { token: '[redacted]', target: '/repair' },
          name: 'notification_open',
          platform: expect.any(String),
          route: '/notifications',
          severity: 'info',
        }),
      ],
    });
  });

  it('does not throw when telemetry endpoint submission fails', async () => {
    mockTelemetryPost.mockRejectedValueOnce(new Error('offline'));

    expect(() => captureTelemetry({
      name: 'app_error_boundary',
      severity: 'error',
      requestId: 'req-1',
      context: { authToken: 'secret' },
    })).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    expect(console.warn).toHaveBeenCalledWith('[cj-app-telemetry:send-failed]', {
      name: 'app_error_boundary',
      severity: 'error',
      hasRequestId: true,
    });
  });

  it('records OpenTelemetry provider spans once with sanitized context', () => {
    const provider = initializeOpenTelemetryProvider();

    const span = startTelemetrySpan({
      name: 'app.boot',
      route: '/app',
      context: { token: 'secret' },
    });
    span.end('ok', { status: 'loaded' });
    span.end('error', { status: 'late' });

    expect(mockTelemetryPost).toHaveBeenCalledTimes(1);
    expect(mockTelemetryPost).toHaveBeenCalledWith('/telemetry/otlp/v1/traces', {
      resourceSpans: [
        expect.objectContaining({
          resource: {
            attributes: expect.arrayContaining([
              { key: 'service.name', value: { stringValue: 'cj-mobile' } },
              { key: 'app.version', value: { stringValue: '1.2.3-test' } },
              { key: 'app.build_number', value: { stringValue: '42-test' } },
            ]),
          },
          scopeSpans: [
            {
              scope: { name: 'cj.mobile.app' },
              spans: [
                expect.objectContaining({
                  name: 'app.boot',
                  traceId: expect.any(String),
                  spanId: expect.any(String),
                  attributes: expect.arrayContaining([
                    { key: 'token', value: { stringValue: '[redacted]' } },
                    { key: 'status', value: { stringValue: 'loaded' } },
                    { key: 'route', value: { stringValue: '/app' } },
                  ]),
                  status: { code: 1 },
                }),
              ],
            },
          ],
        }),
      ],
    });
    expect(provider).toBeDefined();
  });

  it('records failed spans without exposing raw error messages', () => {
    const span = startTelemetrySpan({ name: 'app.deep_link.resume', route: '/auth' });
    span.fail(new Error('secret token leaked'), { next: '/case' });

    expect(mockTelemetryPost).toHaveBeenCalledWith('/telemetry/otlp/v1/traces', {
      resourceSpans: [
        expect.objectContaining({
          scopeSpans: [
            expect.objectContaining({
              spans: [
                expect.objectContaining({
                  name: 'app.deep_link.resume',
                  attributes: expect.arrayContaining([
                    { key: 'errorName', value: { stringValue: 'Error' } },
                    { key: 'next', value: { stringValue: '/case' } },
                    { key: 'route', value: { stringValue: '/auth' } },
                  ]),
                  status: { code: 2 },
                }),
              ],
            }),
          ],
        }),
      ],
    });
    expect(JSON.stringify(mockTelemetryPost.mock.calls)).not.toContain('secret token leaked');
  });
});
