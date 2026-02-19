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

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
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
    it('應 POST /judgments/generate/:caseId 並返回 Judgment', async () => {
      mockPost.mockResolvedValue({ data: { data: { judgment: mockJudgment } } });
      const result = await generateJudgment('c1');
      expect(mockPost).toHaveBeenCalledWith('/judgments/generate/c1', undefined, undefined);
      expect(result).toEqual(mockJudgment);
    });

    it('有 sessionId 時應帶入 X-Session-Id header', async () => {
      mockPost.mockResolvedValue({ data: { data: { judgment: mockJudgment } } });
      await generateJudgment('c1', 's-1');
      expect(mockPost).toHaveBeenCalledWith(
        '/judgments/generate/c1',
        undefined,
        { headers: { 'X-Session-Id': 's-1' } }
      );
    });
  });

  describe('getJudgment', () => {
    it('應 GET /judgments/:id 並返回 Judgment', async () => {
      mockGet.mockResolvedValue({ data: { data: { judgment: mockJudgment } } });
      const result = await getJudgment('j1');
      expect(mockGet).toHaveBeenCalledWith('/judgments/j1');
      expect(result).toEqual(mockJudgment);
    });
  });

  describe('getJudgmentByCaseId', () => {
    it('成功時應返回 Judgment', async () => {
      mockGet.mockResolvedValue({ data: { data: { judgment: mockJudgment } } });
      const result = await getJudgmentByCaseId('c1');
      expect(mockGet).toHaveBeenCalledWith('/cases/c1/judgment', undefined);
      expect(result).toEqual(mockJudgment);
    });

    it('有 sessionId 時應帶入 X-Session-Id header', async () => {
      mockGet.mockResolvedValue({ data: { data: { judgment: mockJudgment } } });
      await getJudgmentByCaseId('c1', 's-2');
      expect(mockGet).toHaveBeenCalledWith('/cases/c1/judgment', {
        headers: { 'X-Session-Id': 's-2' },
      });
    });

    it('JUDGMENT_PENDING / JUDGMENT_NOT_FOUND / HTTP_404 時應返回 null', async () => {
      for (const code of ['JUDGMENT_PENDING', 'JUDGMENT_NOT_FOUND', 'HTTP_404']) {
        mockGet.mockRejectedValueOnce({ code });
        const result = await getJudgmentByCaseId('c1');
        expect(result).toBeNull();
      }
    });

    it('其他錯誤應拋出', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));
      await expect(getJudgmentByCaseId('c1')).rejects.toThrow('Server error');
    });
  });

  describe('acceptJudgment', () => {
    it('應 POST /judgments/:id/accept 並返回 Judgment', async () => {
      mockPost.mockResolvedValue({ data: { data: { judgment: mockJudgment } } });
      const result = await acceptJudgment('j1', { accepted: true, rating: 5 });
      expect(mockPost).toHaveBeenCalledWith('/judgments/j1/accept', {
        accepted: true,
        rating: 5,
      });
      expect(result).toEqual(mockJudgment);
    });
  });
});
