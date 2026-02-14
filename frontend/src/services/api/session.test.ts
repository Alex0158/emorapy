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
  });

  describe('refreshSession', () => {
    it('應 POST /sessions/refresh 並返回 Session', async () => {
      const data = {
        session_id: 's2',
        expires_at: '2026-01-01T00:00:00Z',
      };
      mockPost.mockResolvedValue({ data: { data } });
      const result = await refreshSession();
      expect(mockPost).toHaveBeenCalledWith('/sessions/refresh');
      expect(result).toEqual({
        session_id: 's2',
        expires_at: '2026-01-01T00:00:00Z',
      });
    });
  });
});
