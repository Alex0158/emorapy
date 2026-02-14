/**
 * 用戶 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProfile, updateProfile } from './user';

const mockGet = vi.fn();
const mockPut = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

const mockUser = {
  id: 'u1',
  email: 'u@example.com',
  nickname: 'User',
  email_verified: true,
  created_at: new Date().toISOString(),
};

describe('user API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProfile', () => {
    it('應 GET /user/profile 並返回 User', async () => {
      mockGet.mockResolvedValue({ data: { data: { user: mockUser } } });
      const result = await getProfile();
      expect(mockGet).toHaveBeenCalledWith('/user/profile');
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateProfile', () => {
    it('應 PUT /user/profile 並返回 User', async () => {
      mockPut.mockResolvedValue({
        data: { data: { user: { ...mockUser, nickname: 'NewName' } } },
      });
      const result = await updateProfile({ nickname: 'NewName' });
      expect(mockPut).toHaveBeenCalledWith('/user/profile', { nickname: 'NewName' });
      expect(result.nickname).toBe('NewName');
    });
  });
});
