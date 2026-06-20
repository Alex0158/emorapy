import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockRecordEvents = jest.fn();
const mockRecordOtlpTraces = jest.fn();

jest.mock('../../../src/services/app-telemetry.service', () => ({
  __esModule: true,
  appTelemetryService: {
    recordEvents: (...args: unknown[]) => mockRecordEvents(...args),
    recordOtlpTraces: (...args: unknown[]) => mockRecordOtlpTraces(...args),
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import appTelemetryRoutes from '../../../src/routes/app-telemetry.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', appTelemetryRoutes);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ success: false, error: err.message });
  });
  return app;
}

describe('app-telemetry.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockRecordEvents as any).mockResolvedValue({
      acceptedCount: 1,
      persistedCount: 1,
      severities: { info: 1, warning: 0, error: 0 },
    });
    (mockRecordOtlpTraces as any).mockResolvedValue({
      acceptedCount: 1,
      persistedCount: 1,
      severities: { info: 1, warning: 0, error: 0 },
    });
  });

  it('POST /telemetry/events 應接受匿名 App telemetry 並返回 accepted count', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/telemetry/events')
      .set('X-Request-Id', 'req-1')
      .set('X-Session-Id', 'session-1')
      .send({
        events: [{
          name: 'notification_open',
          severity: 'info',
          route: '/notifications',
          app_version: '1.3.1',
          platform: 'ios',
          context: { target: '/repair', token: '[redacted]' },
        }],
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      success: true,
      data: {
        accepted_count: 1,
        persisted_count: 1,
        severities: { info: 1, warning: 0, error: 0 },
      },
    });
    expect(mockRecordEvents).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'notification_open' }),
    ], expect.objectContaining({
      sessionId: 'session-1',
      requestId: expect.any(String),
    }));
  });

  it('POST /telemetry/events 應拒絕非法事件名與過大 batch', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/telemetry/events')
      .send({
        events: Array.from({ length: 21 }, () => ({ name: 'bad event name' })),
      });

    expect(response.status).toBe(400);
    expect(mockRecordEvents).not.toHaveBeenCalled();
  });

  it('POST /telemetry/otlp/v1/traces 應接受 OTLP JSON trace 並返回 partial_success', async () => {
    const app = createApp();
    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'app.version', value: { stringValue: '1.3.1' } },
            { key: 'app.platform', value: { stringValue: 'ios' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'emorapy.mobile.app' },
          spans: [{
            traceId: '0123456789abcdef0123456789abcdef',
            spanId: '0123456789abcdef',
            name: 'app.boot',
            attributes: [{ key: 'route', value: { stringValue: '/app' } }],
            status: { code: 1 },
          }],
        }],
      }],
    };

    const response = await request(app)
      .post('/telemetry/otlp/v1/traces')
      .set('X-Request-Id', 'req-otlp-1')
      .set('X-Session-Id', 'session-1')
      .send(payload);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      success: true,
      data: {
        accepted_count: 1,
        persisted_count: 1,
        severities: { info: 1, warning: 0, error: 0 },
        partial_success: { rejected_spans: 0 },
      },
    });
    expect(mockRecordOtlpTraces).toHaveBeenCalledWith(payload, expect.objectContaining({
      sessionId: 'session-1',
      requestId: expect.any(String),
    }));
  });

  it('POST /telemetry/otlp/v1/traces 應拒絕過大 span batch', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/telemetry/otlp/v1/traces')
      .send({
        resourceSpans: [{
          scopeSpans: [{
            spans: Array.from({ length: 51 }, (_, index) => ({
              traceId: '0123456789abcdef0123456789abcdef',
              spanId: `0123456789abcde${index % 10}`,
              name: 'app.boot',
            })),
          }],
        }],
      });

    expect(response.status).toBe(400);
    expect(mockRecordOtlpTraces).not.toHaveBeenCalled();
  });
});
