/**
 * 案件 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createQuickCase,
  createCase,
  getCase,
  getCaseBySessionId,
  getCaseList,
  submitCase,
  updateCase,
  uploadEvidence,
  deleteEvidence,
  createCollaborativeCase,
} from './case';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

const mockCase = {
  id: 'c1',
  pairing_id: 'p1',
  title: 'Test',
  type: '生活習慣衝突',
  status: 'draft' as const,
  mode: 'quick' as const,
  plaintiff_statement: '原告陳述',
  defendant_statement: '被告陳述',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('case API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createQuickCase', () => {
    it('應 POST /cases/quick 並返回 case 與可選 session', async () => {
      mockPost.mockResolvedValue({
        data: { data: { case: mockCase, session_id: 's1', session_expires_at: '2025-12-31T00:00:00Z' } },
      });
      const result = await createQuickCase({
        plaintiff_statement: '原告',
        defendant_statement: '被告',
      });
      expect(mockPost).toHaveBeenCalledWith('/cases/quick', expect.any(Object));
      expect(result.case).toEqual(mockCase);
      expect(result.session_id).toBe('s1');
    });
  });

  describe('createCase', () => {
    it('應 POST /cases 並返回 case', async () => {
      mockPost.mockResolvedValue({ data: { data: { case: mockCase } } });
      const result = await createCase({
        plaintiff_statement: '原告',
        defendant_statement: '被告',
      });
      expect(mockPost).toHaveBeenCalledWith('/cases', expect.any(Object));
      expect(result).toEqual(mockCase);
    });
  });

  describe('getCase', () => {
    it('應 GET /cases/:id 並返回 case', async () => {
      mockGet.mockResolvedValue({ data: { data: { case: mockCase } } });
      const result = await getCase('c1');
      expect(mockGet).toHaveBeenCalledWith('/cases/c1', undefined);
      expect(result).toEqual(mockCase);
    });

    it('有 sessionId 時應帶入 X-Session-Id header', async () => {
      mockGet.mockResolvedValue({ data: { data: { case: mockCase } } });
      await getCase('c1', 's-session');
      expect(mockGet).toHaveBeenCalledWith('/cases/c1', {
        headers: { 'X-Session-Id': 's-session' },
      });
    });
  });

  describe('getCaseBySessionId', () => {
    it('成功時應返回 case', async () => {
      mockGet.mockResolvedValue({ data: { data: { case: mockCase } } });
      const result = await getCaseBySessionId('s1');
      expect(mockGet).toHaveBeenCalledWith('/cases/by-session', {
        headers: { 'X-Session-Id': 's1' },
      });
      expect(result).toEqual(mockCase);
    });

    it('NOT_FOUND 或 HTTP_404 時應返回 null', async () => {
      mockGet.mockRejectedValue({ code: 'NOT_FOUND' });
      const result = await getCaseBySessionId('s1');
      expect(result).toBeNull();
    });

    it('HTTP_404 時也應返回 null', async () => {
      mockGet.mockRejectedValue({ code: 'HTTP_404' });
      const result = await getCaseBySessionId('s1');
      expect(result).toBeNull();
    });

    it('其他錯誤應拋出', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));
      await expect(getCaseBySessionId('s1')).rejects.toThrow('Server error');
    });
  });

  describe('getCaseList', () => {
    it('應 GET /cases 並返回 cases 與 pagination', async () => {
      const pagination = { page: 1, page_size: 10, total: 1, total_pages: 1 };
      mockGet.mockResolvedValue({ data: { data: { cases: [mockCase], pagination } } });
      const result = await getCaseList({ page: 1, page_size: 10 });
      expect(mockGet).toHaveBeenCalledWith('/cases', { params: { page: 1, page_size: 10 } });
      expect(result.cases).toEqual([mockCase]);
      expect(result.pagination).toEqual(pagination);
    });

    it('無 params 時應傳空 params', async () => {
      mockGet.mockResolvedValue({ data: { data: { cases: [], pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 } } } });
      await getCaseList();
      expect(mockGet).toHaveBeenCalledWith('/cases', { params: undefined });
    });
  });

  describe('submitCase', () => {
    it('應 POST /cases/:id/submit', async () => {
      mockPost.mockResolvedValue({ data: { data: { case: mockCase } } });
      const result = await submitCase('c1');
      expect(mockPost).toHaveBeenCalledWith('/cases/c1/submit');
      expect(result).toEqual(mockCase);
    });
  });

  describe('updateCase', () => {
    it('應 PUT /cases/:id 並返回 case', async () => {
      mockPut.mockResolvedValue({ data: { data: { case: { ...mockCase, title: 'Updated' } } } });
      const result = await updateCase('c1', { title: 'Updated' });
      expect(mockPut).toHaveBeenCalledWith('/cases/c1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  describe('uploadEvidence', () => {
    it('應 POST /cases/:id/evidence 並傳 FormData', async () => {
      const files = [new File(['x'], 'a.jpg', { type: 'image/jpeg' })];
      const evidences = [{ id: 'e1', file_url: 'https://example.com/a.jpg', file_type: 'image' }];
      mockPost.mockResolvedValue({ data: { data: { evidences } } });
      const result = await uploadEvidence('c1', files);
      expect(mockPost).toHaveBeenCalledWith('/cases/c1/evidence', expect.any(FormData), expect.any(Object));
      expect(result).toEqual(evidences);
    });

    it('有 sessionId 時應傳 header', async () => {
      const files = [new File(['x'], 'b.jpg', { type: 'image/jpeg' })];
      mockPost.mockResolvedValue({ data: { data: { evidences: [] } } });
      await uploadEvidence('c1', files, 's1');
      expect(mockPost).toHaveBeenCalledWith(
        '/cases/c1/evidence',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Session-Id': 's1' }),
        })
      );
    });
  });

  describe('deleteEvidence', () => {
    it('應 DELETE /cases/:caseId/evidence/:evidenceId', async () => {
      mockDelete.mockResolvedValue({ data: {} });
      await deleteEvidence('c1', 'e1');
      expect(mockDelete).toHaveBeenCalledWith('/cases/c1/evidence/e1', {});
    });

    it('有 sessionId 時應傳 header', async () => {
      mockDelete.mockResolvedValue({ data: {} });
      await deleteEvidence('c1', 'e1', 's1');
      expect(mockDelete).toHaveBeenCalledWith('/cases/c1/evidence/e1', {
        headers: { 'X-Session-Id': 's1' },
      });
    });

    it('無 sessionId 時應傳空 config', async () => {
      mockDelete.mockResolvedValue({ data: {} });
      await deleteEvidence('c1', 'e2', undefined);
      expect(mockDelete).toHaveBeenCalledWith('/cases/c1/evidence/e2', {});
    });
  });

  describe('createCollaborativeCase', () => {
    const collabResponse = {
      case: mockCase,
      session_id: 'cs1',
      session_expires_at: '2026-12-31T00:00:00Z',
      phase: 'a_done' as const,
    };

    it('應 POST /cases/collaborative 並返回結果', async () => {
      mockPost.mockResolvedValue({ data: { data: collabResponse } });
      const result = await createCollaborativeCase({ plaintiff_statement: '原告陳述' });
      expect(mockPost).toHaveBeenCalledWith('/cases/collaborative', { plaintiff_statement: '原告陳述' }, undefined);
      expect(result.case).toEqual(mockCase);
      expect(result.session_id).toBe('cs1');
      expect(result.phase).toBe('a_done');
    });

    it('有 sessionId 時應帶入 X-Session-Id header', async () => {
      mockPost.mockResolvedValue({ data: { data: collabResponse } });
      await createCollaborativeCase({ case_id: 'c1', defendant_statement: '被告陳述' }, 'existing-session');
      expect(mockPost).toHaveBeenCalledWith(
        '/cases/collaborative',
        { case_id: 'c1', defendant_statement: '被告陳述' },
        { headers: { 'X-Session-Id': 'existing-session' } },
      );
    });

    it('回傳無 case 時應拋出錯誤', async () => {
      mockPost.mockResolvedValue({ data: { data: { session_id: 'x' } } });
      await expect(createCollaborativeCase({ plaintiff_statement: 'test' })).rejects.toThrow('Invalid collaborative case response');
    });
  });
});
