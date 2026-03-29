/**
 * Session API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, refreshSession } from './session';

const mockPost = vi.fn();
vi.mock('../request', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('session API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('應 POST /sessions/quick 並返回 Session', async () => {
      const data = {
        session_id: 's1',
        expires_at: '2025-12-31T23:59:59Z',
      };
      mockPost.mockResolvedValue({ data: { data } });
      const result = await createSession();
      expect(mockPost).toHaveBeenCalledWith('/sessions/quick');
      expect(result).toEqual({
        session_id: 's1',
        expires_at: '2025-12-31T23:59:59Z',
      });
    });

    it('回應缺少 session_id 或 expires_at 時應拋錯', async () => {
      mockPost.mockResolvedValue({ data: { data: { session_id: 's1' } } });
      await expect(createSession()).rejects.toThrow('Invalid session response from server');

      mockPost.mockResolvedValue({ data: { data: { expires_at: '2025-12-31' } } });
      await expect(createSession()).rejects.toThrow('Invalid session response from server');

      mockPost.mockResolvedValue({ data: { data: {} } });
      await expect(createSession()).rejects.toThrow('Invalid session response from server');
    });

    it('後端回傳 data 為 null 時應拋錯（F01 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: null } });
      await expect(createSession()).rejects.toThrow('Invalid session response from server');
    });

    it('後端回傳 session_id 為空字串時應拋錯（F01 邊界：空 session 視為無效）', async () => {
      mockPost.mockResolvedValue({
        data: { data: { session_id: '', expires_at: '2025-12-31T23:59:59Z' } },
      });
      await expect(createSession()).rejects.toThrow('Invalid session response from server');
    });
  });

  describe('refreshSession', () => {
    it('應 POST /sessions/refresh 並返回 Session', async () => {
      const data = {
        session_id: 's2',
        expires_at: '2026-01-01T00:00:00Z',
      };
      mockPost.mockResolvedValue({ data: { data } });
      const result = await refreshSession();
      expect(mockPost).toHaveBeenCalledWith('/sessions/refresh', undefined, undefined);
      expect(result).toEqual({
        session_id: 's2',
        expires_at: '2026-01-01T00:00:00Z',
      });
    });

    it('傳入 currentSessionId 時應顯式帶上 X-Session-Id', async () => {
      const data = {
        session_id: 's3',
        expires_at: '2026-02-01T00:00:00Z',
      };
      mockPost.mockResolvedValue({ data: { data } });

      await refreshSession('guest_old_123');

      expect(mockPost).toHaveBeenCalledWith('/sessions/refresh', undefined, {
        headers: { 'X-Session-Id': 'guest_old_123' },
      });
    });

    it('回應缺少 session_id 或 expires_at 時應拋錯', async () => {
      mockPost.mockResolvedValue({ data: { data: { session_id: 's1' } } });
      await expect(refreshSession()).rejects.toThrow('Invalid session response from server');

      mockPost.mockResolvedValue({ data: { data: { expires_at: '2025-12-31' } } });
      await expect(refreshSession()).rejects.toThrow('Invalid session response from server');

      mockPost.mockResolvedValue({ data: { data: {} } });
      await expect(refreshSession()).rejects.toThrow('Invalid session response from server');
    });

    it('後端回傳 data 為 null 時應拋錯（F01 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: null } });
      await expect(refreshSession()).rejects.toThrow('Invalid session response from server');
    });

    it('後端回傳 session_id 為空字串時應拋錯（F01 邊界：空 session 視為無效）', async () => {
      mockPost.mockResolvedValue({
        data: { data: { session_id: '', expires_at: '2026-01-01T00:00:00Z' } },
      });
      await expect(refreshSession()).rejects.toThrow('Invalid session response from server');
    });
  });
});
