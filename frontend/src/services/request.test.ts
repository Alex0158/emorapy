/**
 * request 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cancelRequest, cancelAllRequests, requestWithRetryWrapper } from './request';

const mockRequest = vi.fn();
const mockInterceptorsRequestUse = vi.fn();
const mockInterceptorsResponseUse = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      request: mockRequest,
      interceptors: {
        request: { use: mockInterceptorsRequestUse },
        response: { use: mockInterceptorsResponseUse },
      },
    })),
    isCancel: vi.fn((e: unknown) => (e as { __cancel?: boolean })?.__cancel === true),
  },
}));

vi.mock('@/config/env', () => ({
  env: { apiBaseURL: 'http://api.test' },
}));

vi.mock('@/utils/storage', () => ({
  sessionStorage: { get: vi.fn(() => null) },
}));

vi.mock('@/utils/retry', () => ({
  requestWithRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

const mockMessageError = vi.fn();
const mockMessageWarning = vi.fn();
vi.mock('antd', () => ({
  message: {
    error: (...args: unknown[]) => mockMessageError(...args),
    warning: (...args: unknown[]) => mockMessageWarning(...args),
  },
}));

describe('request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('cancelRequest', () => {
    it('應能調用且不拋錯（無對應 controller 時）', () => {
      expect(() => cancelRequest('non-existent')).not.toThrow();
    });
  });

  describe('cancelAllRequests', () => {
    it('應能調用且不拋錯', () => {
      expect(() => cancelAllRequests()).not.toThrow();
    });
  });

  describe('requestWithRetryWrapper', () => {
    it('應調用 requestWithRetry 並傳入 request 調用', async () => {
      const { requestWithRetry } = await import('@/utils/retry');
      mockRequest.mockResolvedValueOnce({ data: { success: true, data: { x: 1 } } });
      (requestWithRetry as ReturnType<typeof vi.fn>).mockImplementation((fn: () => Promise<unknown>) => fn());
      const result = await requestWithRetryWrapper({ method: 'GET', url: '/test' });
      expect(requestWithRetry).toHaveBeenCalled();
      expect(result.data).toEqual({ success: true, data: { x: 1 } });
    });
  });
});
