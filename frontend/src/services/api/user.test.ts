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

    it('回應缺少 user 時應拋錯', async () => {
      mockGet.mockResolvedValue({ data: { data: {} } });
      await expect(getProfile()).rejects.toThrow('Invalid profile response from server');
    });

    it('後端回傳 user 為 null 時應拋錯（F09 邊界：profile/me 回傳不完整時防禦）', async () => {
      mockGet.mockResolvedValue({ data: { data: { user: null } } });
      await expect(getProfile()).rejects.toThrow('Invalid profile response from server');
    });

    it('後端回傳 user 為 undefined 時應拋錯（F09 邊界：API 回傳不完整時防禦）', async () => {
      mockGet.mockResolvedValue({ data: { data: { user: undefined } } });
      await expect(getProfile()).rejects.toThrow('Invalid profile response from server');
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

    it('回應缺少 user 時應拋錯', async () => {
      mockPut.mockResolvedValue({ data: { data: {} } });
      await expect(updateProfile({ nickname: 'x' })).rejects.toThrow(
        'Invalid profile response from server',
      );
    });

    it('後端回傳 user 為 null 時應拋錯（F09 邊界：API 回傳不完整時防禦）', async () => {
      mockPut.mockResolvedValue({ data: { data: { user: null } } });
      await expect(updateProfile({ nickname: 'x' })).rejects.toThrow(
        'Invalid profile response from server',
      );
    });
  });
});
