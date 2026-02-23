/**
 * 訪談 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { interviewApi } from './interview';

const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock('../request', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

describe('interviewApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startSession', () => {
    it('應以 trigger 參數 POST /interview/start', async () => {
      mockPost.mockResolvedValue({ data: { data: { id: 's1' } } });
      const res = await interviewApi.startSession('organic');
      expect(mockPost).toHaveBeenCalledWith('/interview/start', { trigger: 'organic' });
      expect(res).toEqual({ data: { data: { id: 's1' } } });
    });

    it('預設 trigger 為 organic', async () => {
      mockPost.mockResolvedValue({ data: {} });
      await interviewApi.startSession();
      expect(mockPost).toHaveBeenCalledWith('/interview/start', { trigger: 'organic' });
    });
  });

  describe('checkResume', () => {
    it('應 GET /interview/resume', async () => {
      mockGet.mockResolvedValue({ data: { data: { has_pending: true, session_id: 's2' } } });
      const res = await interviewApi.checkResume();
      expect(mockGet).toHaveBeenCalledWith('/interview/resume');
      expect(res.data.data.has_pending).toBe(true);
    });
  });

  describe('getSession', () => {
    it('應 GET /interview/:id', async () => {
      mockGet.mockResolvedValue({ data: { data: { id: 's3', status: 'completed' } } });
      await interviewApi.getSession('s3');
      expect(mockGet).toHaveBeenCalledWith('/interview/s3');
    });
  });

  describe('endSession', () => {
    it('應 POST /interview/:id/end', async () => {
      mockPost.mockResolvedValue({ data: {} });
      await interviewApi.endSession('s4');
      expect(mockPost).toHaveBeenCalledWith('/interview/s4/end');
    });
  });

  describe('retryFailed', () => {
    it('應 POST /interview/:id/retry', async () => {
      mockPost.mockResolvedValue({ data: {} });
      await interviewApi.retryFailed('s5');
      expect(mockPost).toHaveBeenCalledWith('/interview/s5/retry');
    });
  });
});
