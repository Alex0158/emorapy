import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockExportPrometheus = jest.fn<() => Promise<string>>();
const mockEnvRef = {
  current: {
    NODE_ENV: 'development',
    METRICS_ENABLED: true,
    METRICS_TOKEN: undefined as string | undefined,
    METRICS_ALLOWED_IPS: [] as string[],
  },
};

jest.mock('../../../src/services/chat-metrics.service', () => ({
  chatMetricsService: {
    exportPrometheus: () => mockExportPrometheus(),
  },
}));

jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef.current;
  },
}));

import metricsRouter from '../../../src/routes/metrics.routes';

function createApp() {
  const app = express();
  app.use('/', metricsRouter);
  return app;
}

describe('routes/metrics.routes', () => {
  beforeEach(() => {
    mockExportPrometheus.mockReset();
    mockExportPrometheus.mockResolvedValue('demo_metric 1');
    mockEnvRef.current = {
      NODE_ENV: 'development',
      METRICS_ENABLED: true,
      METRICS_TOKEN: undefined,
      METRICS_ALLOWED_IPS: [],
    };
  });

  it('METRICS_ENABLED=false 時應返回 404', async () => {
    mockEnvRef.current = {
      ...mockEnvRef.current,
      METRICS_ENABLED: false,
    };

    const app = createApp();
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(404);
    expect(res.text).toContain('metrics disabled');
    expect(mockExportPrometheus).not.toHaveBeenCalled();
  });

  it('production 且無 token/ip 白名單時應返回 403', async () => {
    mockEnvRef.current = {
      ...mockEnvRef.current,
      NODE_ENV: 'production',
      METRICS_TOKEN: 'secret-token',
      METRICS_ALLOWED_IPS: [],
    };

    const app = createApp();
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(403);
    expect(res.text).toContain('metrics forbidden');
    expect(mockExportPrometheus).not.toHaveBeenCalled();
  });

  it('production 且 token 正確時應返回 200', async () => {
    mockEnvRef.current = {
      ...mockEnvRef.current,
      NODE_ENV: 'production',
      METRICS_TOKEN: 'secret-token',
      METRICS_ALLOWED_IPS: [],
    };

    const app = createApp();
    const res = await request(app).get('/metrics').set('X-Metrics-Token', 'secret-token');

    expect(res.status).toBe(200);
    expect(res.text).toContain('demo_metric 1');
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.headers['content-type']).toContain('version=0.0.4');
    expect(mockExportPrometheus).toHaveBeenCalledTimes(1);
  });

  it('production 且來源 IP 在白名單時應返回 200', async () => {
    mockEnvRef.current = {
      ...mockEnvRef.current,
      NODE_ENV: 'production',
      METRICS_TOKEN: undefined,
      METRICS_ALLOWED_IPS: ['::ffff:127.0.0.1', '127.0.0.1'],
    };

    const app = createApp();
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(mockExportPrometheus).toHaveBeenCalledTimes(1);
  });

  it('metrics 導出失敗時應返回 500', async () => {
    mockExportPrometheus.mockRejectedValueOnce(new Error('metrics down'));
    const app = createApp();
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(500);
    expect(res.text).toContain('metrics unavailable');
  });
});

