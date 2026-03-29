/**
 * 配對 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPairing,
  joinPairing,
  getPairingStatus,
  cancelPairing,
  type Pairing,
} from './pairing';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

const mockPairing: Pairing = {
  id: 'p1',
  status: 'active',
  pairing_type: 'normal',
  created_at: new Date().toISOString(),
};

describe('pairing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPairing', () => {
    it('應 POST /pairing/create 並返回 Pairing', async () => {
      mockPost.mockResolvedValue({ data: { data: { pairing: mockPairing } } });
      const result = await createPairing();
      expect(mockPost).toHaveBeenCalledWith('/pairing/create');
      expect(result).toEqual(mockPairing);
    });

    it('回應缺少 pairing 時應拋錯', async () => {
      mockPost.mockResolvedValue({ data: { data: {} } });
      await expect(createPairing()).rejects.toThrow('Invalid pairing response from server');
    });

    it('後端回傳 pairing 為 null 時應拋錯（F08 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: { pairing: null } } });
      await expect(createPairing()).rejects.toThrow('Invalid pairing response from server');
    });
  });

  describe('joinPairing', () => {
    it('應 POST /pairing/join 並傳 invite_code', async () => {
      mockPost.mockResolvedValue({ data: { data: { pairing: mockPairing } } });
      const result = await joinPairing('ABC123');
      expect(mockPost).toHaveBeenCalledWith('/pairing/join', { invite_code: 'ABC123' });
      expect(result).toEqual(mockPairing);
    });

    it('回應缺少 pairing 時應拋錯', async () => {
      mockPost.mockResolvedValue({ data: { data: {} } });
      await expect(joinPairing('ABC123')).rejects.toThrow('Invalid pairing response from server');
    });

    it('後端回傳 pairing 為 null 時應拋錯（F08 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: { pairing: null } } });
      await expect(joinPairing('ABC123')).rejects.toThrow('Invalid pairing response from server');
    });
  });

  describe('getPairingStatus', () => {
    it('成功時應返回 Pairing', async () => {
      mockGet.mockResolvedValue({ data: { data: { pairing: mockPairing } } });
      const result = await getPairingStatus();
      expect(mockGet).toHaveBeenCalledWith('/pairing/status');
      expect(result).toEqual(mockPairing);
    });

    it('NOT_FOUND 或 HTTP_404 時應返回 null', async () => {
      mockGet.mockRejectedValue({ code: 'NOT_FOUND' });
      expect(await getPairingStatus()).toBeNull();
      mockGet.mockRejectedValue({ code: 'HTTP_404' });
      expect(await getPairingStatus()).toBeNull();
    });

    it('其他錯誤應拋出', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));
      await expect(getPairingStatus()).rejects.toThrow('Server error');
    });

    it('後端回傳 200 且 pairing 為 null 時應返回 null（F08 邊界：無配對狀態）', async () => {
      mockGet.mockResolvedValue({ data: { data: { pairing: null } } });
      const result = await getPairingStatus();
      expect(result).toBeNull();
    });

    it('後端回傳 200 且 pairing 為 undefined 時應返回 null（F08 邊界：API 回傳不完整時防禦，無配對狀態語義）', async () => {
      mockGet.mockResolvedValue({ data: { data: { pairing: undefined } } });
      const result = await getPairingStatus();
      expect(result).toBeNull();
    });
  });

  describe('cancelPairing', () => {
    it('應 POST /pairing/cancel 並返回 Pairing', async () => {
      mockPost.mockResolvedValue({ data: { data: { pairing: { ...mockPairing, status: 'cancelled' } } } });
      const result = await cancelPairing();
      expect(mockPost).toHaveBeenCalledWith('/pairing/cancel');
      expect(result.status).toBe('cancelled');
    });

    it('回應缺少 pairing 時應拋錯', async () => {
      mockPost.mockResolvedValue({ data: { data: {} } });
      await expect(cancelPairing()).rejects.toThrow('Invalid pairing response from server');
    });

    it('後端回傳 pairing 為 null 時應拋錯（F08 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: { pairing: null } } });
      await expect(cancelPairing()).rejects.toThrow('Invalid pairing response from server');
    });
  });
});
