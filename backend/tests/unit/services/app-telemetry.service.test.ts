import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockAppTelemetryEventCreateMany = jest.fn();
const mockAppTelemetryEventCount = jest.fn();
const mockAppTelemetryEventGroupBy = jest.fn();
const mockAppTelemetryEventFindMany = jest.fn();
const mockAppTelemetryEventDeleteMany = jest.fn();

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

jest.mock('../../../src/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret',
  },
}));

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    appTelemetryEvent: {
      createMany: (...args: unknown[]) => mockAppTelemetryEventCreateMany(...args),
      count: (...args: unknown[]) => mockAppTelemetryEventCount(...args),
      groupBy: (...args: unknown[]) => mockAppTelemetryEventGroupBy(...args),
      findMany: (...args: unknown[]) => mockAppTelemetryEventFindMany(...args),
      deleteMany: (...args: unknown[]) => mockAppTelemetryEventDeleteMany(...args),
    },
  },
}));

import {
  AppTelemetryService,
  sanitizeAppTelemetryContext,
} from '../../../src/services/app-telemetry.service';

describe('AppTelemetryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockAppTelemetryEventCreateMany as any).mockResolvedValue({ count: 0 });
    (mockAppTelemetryEventCount as any).mockResolvedValue(0);
    (mockAppTelemetryEventGroupBy as any).mockResolvedValue([]);
    (mockAppTelemetryEventFindMany as any).mockResolvedValue([]);
    (mockAppTelemetryEventDeleteMany as any).mockResolvedValue({ count: 0 });
  });

  it('sanitizeAppTelemetryContext 應二次清洗敏感 key 並限制 unsupported value', () => {
    expect(sanitizeAppTelemetryContext({
      route: '/case',
      authToken: 'jwt',
      sessionId: 'session-1',
      nested: { raw: true },
      count: 2,
    })).toEqual({
      route: '/case',
      authToken: '[redacted]',
      sessionId: '[redacted]',
      nested: '[unsupported]',
      count: 2,
    });
  });

  it('recordEvents 應寫入安全聚合 log/DB 並返回 severity count', async () => {
    (mockAppTelemetryEventCreateMany as any).mockResolvedValue({ count: 2 });
    const service = new AppTelemetryService();
    const result = await service.recordEvents([
      {
        name: 'notification_open',
        severity: 'info',
        route: '/notifications',
        app_version: '1.3.1',
        platform: 'ios',
        context: { token: 'secret', target: '/repair' },
      },
      {
        name: 'app_error_boundary',
        severity: 'error',
        context: { session_id: 'session-1' },
      },
    ], {
      userId: 'user-1',
      sessionId: 'session-1',
      requestId: 'req-1',
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(result).toEqual({
      acceptedCount: 2,
      persistedCount: 2,
      severities: { info: 1, warning: 0, error: 1 },
    });
    expect(mockAppTelemetryEventCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          name: 'notification_open',
          severity: 'info',
          user_id: 'user-1',
          session_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
          context: { token: '[redacted]', target: '/repair' },
        }),
        expect.objectContaining({
          name: 'app_error_boundary',
          severity: 'error',
          session_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
          context: { session_id: '[redacted]' },
        }),
      ],
    });
    expect(mockLogger.info).toHaveBeenCalledWith('App telemetry events accepted', expect.objectContaining({
      count: 2,
      eventNames: ['notification_open', 'app_error_boundary'],
      hasSessionId: true,
      requestId: 'req-1',
      events: [
        expect.objectContaining({
          context: { token: '[redacted]', target: '/repair' },
        }),
        expect.objectContaining({
          context: { session_id: '[redacted]' },
        }),
      ],
    }));
  });

  it('recordEvents 持久化失敗時不阻斷 App telemetry ingest', async () => {
    (mockAppTelemetryEventCreateMany as any).mockRejectedValue(new Error('db unavailable'));
    const service = new AppTelemetryService();

    const result = await service.recordEvents([
      { name: 'app_route_open', severity: 'info' },
    ], {
      requestId: 'req-1',
      sessionId: 'session-1',
    });

    expect(result).toEqual({
      acceptedCount: 1,
      persistedCount: 0,
      severities: { info: 1, warning: 0, error: 0 },
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'App telemetry persistence skipped',
      expect.objectContaining({ acceptedCount: 1, requestId: 'req-1' })
    );
  });

  it('recordOtlpTraces 應把 OTLP JSON span 轉為安全 app_otel_span 摘要', async () => {
    (mockAppTelemetryEventCreateMany as any).mockResolvedValue({ count: 1 });
    const service = new AppTelemetryService();

    const result = await service.recordOtlpTraces({
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'app.version', value: { stringValue: '1.3.1' } },
            { key: 'app.build_number', value: { stringValue: '7' } },
            { key: 'app.platform', value: { stringValue: 'ios' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'cj.mobile.app' },
          spans: [{
            traceId: '0123456789abcdef0123456789abcdef',
            spanId: '0123456789abcdef',
            name: 'app.boot',
            startTimeUnixNano: '1000000000',
            endTimeUnixNano: '1250000000',
            attributes: [
              { key: 'route', value: { stringValue: '/app' } },
              { key: 'authToken', value: { stringValue: 'secret' } },
            ],
            status: { code: 1 },
          }],
        }],
      }],
    }, {
      requestId: 'req-otlp-1',
      sessionId: 'session-1',
    });

    expect(result).toEqual({
      acceptedCount: 1,
      persistedCount: 1,
      severities: { info: 1, warning: 0, error: 0 },
    });
    expect(mockAppTelemetryEventCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          name: 'app_otel_span',
          severity: 'info',
          route: '/app',
          app_version: '1.3.1',
          platform: 'ios',
          build_number: '7',
          session_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
          context: expect.objectContaining({
            authToken: '[redacted]',
            otlpCollector: true,
            spanName: 'app.boot',
            spanStatus: 'ok',
            traceId: '0123456789abcdef0123456789abcdef',
            spanId: '0123456789abcdef',
            durationMs: 250,
            instrumentationScope: 'cj.mobile.app',
          }),
        }),
      ],
    });
  });

  it('getAdminReport 應返回最小化聚合報告且不暴露 context/session_hash', async () => {
    (mockAppTelemetryEventCount as any).mockResolvedValue(4);
    (mockAppTelemetryEventGroupBy as any)
      .mockResolvedValueOnce([
        { severity: 'info', _count: { _all: 2 } },
        { severity: 'error', _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { platform: 'ios', _count: { _all: 3 } },
        { platform: null, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { name: 'app_error_boundary', _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { session_hash: 'hash-1', _count: { _all: 3 } },
        { session_hash: 'hash-2', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { session_hash: 'hash-1', _count: { _all: 2 } },
      ]);
    (mockAppTelemetryEventFindMany as any).mockResolvedValue([
      {
        id: 'evt-1',
        name: 'app_error_boundary',
        severity: 'error',
        route: '/profile',
        request_id: 'req-1',
        app_version: '1.3.1',
        platform: 'ios',
        build_number: '42',
        session_hash: 'hash-1',
        created_at: new Date('2026-05-08T00:00:00.000Z'),
      },
    ]);

    const service = new AppTelemetryService();
    const report = await service.getAdminReport({ days: 14, limit: 10, severity: 'error', platform: 'ios' });

    expect(report).toEqual(expect.objectContaining({
      days: 14,
      retentionDays: 30,
      filters: { severity: 'error', platform: 'ios' },
      totals: expect.objectContaining({
        events: 4,
        errorEvents: 2,
        errorRate: 0.5,
        uniqueSessions: 2,
        crashSessions: 1,
        crashFreeSessionRate: 0.5,
      }),
      bySeverity: { info: 2, error: 2 },
      byPlatform: { ios: 3, unknown: 1 },
      topEvents: [{ name: 'app_error_boundary', count: 2 }],
      recentEvents: [
        expect.not.objectContaining({
          context: expect.anything(),
          session_hash: expect.anything(),
        }),
      ],
    }));
    expect(report.recentEvents[0]).toEqual(expect.objectContaining({
      requestId: 'req-1',
      hasSession: true,
      createdAt: '2026-05-08T00:00:00.000Z',
    }));
    expect(mockAppTelemetryEventGroupBy).toHaveBeenNthCalledWith(5, expect.objectContaining({
      where: expect.objectContaining({
        name: {
          in: expect.arrayContaining([
            'app_error_boundary',
            'app_js_fatal',
            'app_unhandled_promise',
            'app_native_crash',
          ]),
        },
        session_hash: { not: null },
      }),
    }));
  });

  it('cleanupExpiredEvents 應按 retention 刪除過期 telemetry', async () => {
    (mockAppTelemetryEventDeleteMany as any).mockResolvedValue({ count: 3 });
    const service = new AppTelemetryService();

    const result = await service.cleanupExpiredEvents(30);

    expect(result).toEqual(expect.objectContaining({
      deletedCount: 3,
      retentionDays: 30,
      cutoff: expect.any(String),
    }));
    expect(mockAppTelemetryEventDeleteMany).toHaveBeenCalledWith({
      where: { created_at: { lt: expect.any(Date) } },
    });
  });
});
