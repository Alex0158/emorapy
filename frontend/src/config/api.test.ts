/**
 * API 配置單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./env', () => ({
  env: { apiBaseURL: 'http://localhost:3001/api/v1' },
}));

describe('api config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('應導出 API_CONFIG 含 baseURL、timeout、retry、polling', async () => {
    const { API_CONFIG } = await import('./api');
    expect(API_CONFIG.baseURL).toBe('http://localhost:3001/api/v1');
    expect(API_CONFIG.timeout).toBe(30000);
    expect(API_CONFIG.retry).toEqual({ maxRetries: 3, delay: 1000 });
    expect(API_CONFIG.polling.judgment).toEqual({ interval: 5000, maxAttempts: 60 });
    expect(API_CONFIG.polling.case).toEqual({ interval: 3000, maxAttempts: 100 });
  });
});
