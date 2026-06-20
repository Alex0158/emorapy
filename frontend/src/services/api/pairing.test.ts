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

const mocks = vi.hoisted(() => {
  const create = vi.fn();
  const join = vi.fn();
  const getStatus = vi.fn();
  const cancel = vi.fn();
  return {
    create,
    join,
    getStatus,
    cancel,
    createM4ApiClient: vi.fn(() => ({
      pairing: {
        create,
        join,
        getStatus,
        cancel,
      },
    })),
    request: { request: true },
  };
});

vi.mock('../request', () => ({
  default: mocks.request,
}));

vi.mock('@emorapy/api-client', () => ({
  createM4ApiClient: (...args: unknown[]) => mocks.createM4ApiClient(...args),
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
    it('應透過 shared M4 pairing client 建立配對', async () => {
      mocks.create.mockResolvedValue(mockPairing);
      const result = await createPairing();
      expect(mocks.create).toHaveBeenCalledWith();
      expect(result).toEqual(mockPairing);
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.create.mockRejectedValue(new Error('Invalid pairing response from server'));
      await expect(createPairing()).rejects.toThrow('Invalid pairing response from server');
    });
  });

  describe('joinPairing', () => {
    it('應透過 shared M4 pairing client 加入配對', async () => {
      mocks.join.mockResolvedValue(mockPairing);
      const result = await joinPairing('ABC123');
      expect(mocks.join).toHaveBeenCalledWith('ABC123');
      expect(result).toEqual(mockPairing);
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.join.mockRejectedValue(new Error('Invalid pairing response from server'));
      await expect(joinPairing('ABC123')).rejects.toThrow('Invalid pairing response from server');
    });
  });

  describe('getPairingStatus', () => {
    it('成功時應返回 Pairing', async () => {
      mocks.getStatus.mockResolvedValue(mockPairing);
      const result = await getPairingStatus();
      expect(mocks.getStatus).toHaveBeenCalledWith();
      expect(result).toEqual(mockPairing);
    });

    it('無配對狀態時應返回 null', async () => {
      mocks.getStatus.mockResolvedValue(null);
      expect(await getPairingStatus()).toBeNull();
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.getStatus.mockRejectedValue(new Error('Server error'));
      await expect(getPairingStatus()).rejects.toThrow('Server error');
    });
  });

  describe('cancelPairing', () => {
    it('應透過 shared M4 pairing client 解除配對', async () => {
      mocks.cancel.mockResolvedValue({ ...mockPairing, status: 'cancelled' });
      const result = await cancelPairing();
      expect(mocks.cancel).toHaveBeenCalledWith();
      expect(result.status).toBe('cancelled');
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.cancel.mockRejectedValue(new Error('Invalid pairing response from server'));
      await expect(cancelPairing()).rejects.toThrow('Invalid pairing response from server');
    });
  });
});
