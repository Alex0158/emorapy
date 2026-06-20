/**
 * 判決 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateJudgment,
  getJudgment,
  getJudgmentByCaseId,
  acceptJudgment,
} from './judgment';

const mocks = vi.hoisted(() => {
  const generate = vi.fn();
  const get = vi.fn();
  const getByCaseId = vi.fn();
  const accept = vi.fn();
  return {
    generate,
    get,
    getByCaseId,
    accept,
    createM4ApiClient: vi.fn(() => ({
      judgment: {
        generate,
        get,
        getByCaseId,
        accept,
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

const mockJudgment = {
  id: 'j1',
  case_id: 'c1',
  judgment_content: '# 判決書\n內容',
  summary: '摘要',
  plaintiff_ratio: 60,
  defendant_ratio: 40,
  ai_model: 'gpt-4',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('judgment API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateJudgment', () => {
    it('應透過 shared M4 judgment client 生成 Judgment', async () => {
      mocks.generate.mockResolvedValue(mockJudgment);
      const result = await generateJudgment('c1');
      expect(mocks.generate).toHaveBeenCalledWith('c1', undefined);
      expect(result).toEqual(mockJudgment);
    });

    it('有 sessionId 時應交給 shared client 帶入 X-Session-Id header', async () => {
      mocks.generate.mockResolvedValue(mockJudgment);
      await generateJudgment('c1', 's-1');
      expect(mocks.generate).toHaveBeenCalledWith('c1', 's-1');
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.generate.mockRejectedValue(new Error('Invalid judgment response from server'));
      await expect(generateJudgment('c1')).rejects.toThrow('Invalid judgment response from server');
    });
  });

  describe('getJudgment', () => {
    it('應透過 shared M4 judgment client 取得 Judgment', async () => {
      mocks.get.mockResolvedValue(mockJudgment);
      const result = await getJudgment('j1');
      expect(mocks.get).toHaveBeenCalledWith('j1');
      expect(result).toEqual(mockJudgment);
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.get.mockRejectedValue(new Error('Invalid judgment response from server'));
      await expect(getJudgment('j1')).rejects.toThrow('Invalid judgment response from server');
    });
  });

  describe('getJudgmentByCaseId', () => {
    it('成功時應返回 Judgment', async () => {
      mocks.getByCaseId.mockResolvedValue(mockJudgment);
      const result = await getJudgmentByCaseId('c1');
      expect(mocks.getByCaseId).toHaveBeenCalledWith('c1', undefined);
      expect(result).toEqual(mockJudgment);
    });

    it('有 sessionId 時應交給 shared client 帶入 X-Session-Id header 與 suppress toast metadata', async () => {
      mocks.getByCaseId.mockResolvedValue(mockJudgment);
      await getJudgmentByCaseId('c1', 's-2');
      expect(mocks.getByCaseId).toHaveBeenCalledWith('c1', 's-2');
    });

    it('判決尚未生成時應返回 null', async () => {
      mocks.getByCaseId.mockResolvedValue(null);
      const result = await getJudgmentByCaseId('c1');
      expect(result).toBeNull();
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.getByCaseId.mockRejectedValue(new Error('Server error'));
      await expect(getJudgmentByCaseId('c1')).rejects.toThrow('Server error');
    });
  });

  describe('acceptJudgment', () => {
    it('應透過 shared M4 judgment client 接受 Judgment', async () => {
      mocks.accept.mockResolvedValue(mockJudgment);
      const result = await acceptJudgment('j1', { accepted: true, rating: 5 });
      expect(mocks.accept).toHaveBeenCalledWith('j1', {
        accepted: true,
        rating: 5,
      });
      expect(result).toEqual(mockJudgment);
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.accept.mockRejectedValue(new Error('Invalid judgment response from server'));
      await expect(acceptJudgment('j1', { accepted: true })).rejects.toThrow(
        'Invalid judgment response from server'
      );
    });
  });
});
