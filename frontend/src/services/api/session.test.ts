/**
 * Session API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, refreshSession } from './session';

const mocks = vi.hoisted(() => {
  const createQuickSession = vi.fn();
  const refreshQuickSession = vi.fn();
  return {
    createQuickSession,
    refreshQuickSession,
    createM1ApiClient: vi.fn(() => ({
      session: {
        createQuickSession,
        refreshQuickSession,
      },
    })),
    request: { request: true },
  };
});

vi.mock('../request', () => ({
  default: mocks.request,
}));

vi.mock('@emorapy/api-client', () => ({
  createM1ApiClient: (...args: unknown[]) => mocks.createM1ApiClient(...args),
}));

describe('session API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('應透過 shared M1 session client 建立 Session', async () => {
      const data = {
        session_id: 's1',
        expires_at: '2025-12-31T23:59:59Z',
      };
      mocks.createQuickSession.mockResolvedValue(data);

      const result = await createSession();
      expect(mocks.createQuickSession).toHaveBeenCalledWith();
      expect(result).toEqual({
        session_id: 's1',
        expires_at: '2025-12-31T23:59:59Z',
      });
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.createQuickSession.mockRejectedValue(new Error('Invalid session response from server'));
      await expect(createSession()).rejects.toThrow('Invalid session response from server');
    });
  });

  describe('refreshSession', () => {
    it('應透過 shared M1 session client 刷新 Session', async () => {
      const data = {
        session_id: 's2',
        expires_at: '2026-01-01T00:00:00Z',
      };
      mocks.refreshQuickSession.mockResolvedValue(data);

      const result = await refreshSession();
      expect(mocks.refreshQuickSession).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({
        session_id: 's2',
        expires_at: '2026-01-01T00:00:00Z',
      });
    });

    it('傳入 currentSessionId 時應交給 shared client 帶上 X-Session-Id', async () => {
      const data = {
        session_id: 's3',
        expires_at: '2026-02-01T00:00:00Z',
      };
      mocks.refreshQuickSession.mockResolvedValue(data);

      await refreshSession('guest_old_123');

      expect(mocks.refreshQuickSession).toHaveBeenCalledWith('guest_old_123');
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.refreshQuickSession.mockRejectedValue(new Error('Invalid session response from server'));
      await expect(refreshSession()).rejects.toThrow('Invalid session response from server');
    });
  });
});
