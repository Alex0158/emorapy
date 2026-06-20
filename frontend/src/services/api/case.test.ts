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

const mocks = vi.hoisted(() => {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const deleteRequest = vi.fn();
  const quickCreateQuickCase = vi.fn();
  const quickGetCase = vi.fn();
  const quickGetCaseBySessionId = vi.fn();
  const quickCreateCollaborativeCase = vi.fn();
  const formalCreate = vi.fn();
  const formalList = vi.fn();
  const formalSubmit = vi.fn();
  const formalUpdate = vi.fn();
  const mediaUploadEvidence = vi.fn();
  const mediaDeleteEvidence = vi.fn();
  return {
    get,
    post,
    put,
    deleteRequest,
    quickCreateQuickCase,
    quickGetCase,
    quickGetCaseBySessionId,
    quickCreateCollaborativeCase,
    formalCreate,
    formalList,
    formalSubmit,
    formalUpdate,
    mediaUploadEvidence,
    mediaDeleteEvidence,
    request: {
      get: (...args: unknown[]) => get(...args),
      post: (...args: unknown[]) => post(...args),
      put: (...args: unknown[]) => put(...args),
      delete: (...args: unknown[]) => deleteRequest(...args),
    },
  };
});

vi.mock('../request', () => ({
  default: mocks.request,
}));

vi.mock('@emorapy/api-client', () => ({
  createM1ApiClient: vi.fn(() => ({
    quick: {
      createQuickCase: (...args: unknown[]) => mocks.quickCreateQuickCase(...args),
      getCase: (...args: unknown[]) => mocks.quickGetCase(...args),
      getCaseBySessionId: (...args: unknown[]) => mocks.quickGetCaseBySessionId(...args),
      createCollaborativeCase: (...args: unknown[]) => mocks.quickCreateCollaborativeCase(...args),
    },
  })),
  createM4ApiClient: vi.fn(() => ({
    cases: {
      create: (...args: unknown[]) => mocks.formalCreate(...args),
      list: (...args: unknown[]) => mocks.formalList(...args),
      submit: (...args: unknown[]) => mocks.formalSubmit(...args),
      update: (...args: unknown[]) => mocks.formalUpdate(...args),
    },
  })),
  createM5ApiClient: vi.fn(() => ({
    media: {
      uploadEvidence: (...args: unknown[]) => mocks.mediaUploadEvidence(...args),
      deleteEvidence: (...args: unknown[]) => mocks.mediaDeleteEvidence(...args),
    },
  })),
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
    it('應透過 shared M1 quick client 建立 quick case', async () => {
      mocks.quickCreateQuickCase.mockResolvedValue({
        case: mockCase,
        session_id: 's1',
        session_expires_at: '2025-12-31T00:00:00Z',
      });
      const input = {
        plaintiff_statement: '原告',
        defendant_statement: '被告',
      };
      const result = await createQuickCase(input);
      expect(mocks.quickCreateQuickCase).toHaveBeenCalledWith(input);
      expect(result.case).toEqual(mockCase);
      expect(result.session_id).toBe('s1');
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.quickCreateQuickCase.mockRejectedValue(new Error('Invalid case response from server'));
      await expect(
        createQuickCase({ plaintiff_statement: '原告', defendant_statement: '被告' })
      ).rejects.toThrow('Invalid case response from server');
    });
  });

  describe('createCase', () => {
    it('應透過 shared M4 formal case client 建立 case', async () => {
      mocks.formalCreate.mockResolvedValue(mockCase);
      const input = {
        plaintiff_statement: '原告',
        defendant_statement: '被告',
      };
      const result = await createCase(input);
      expect(mocks.formalCreate).toHaveBeenCalledWith(input);
      expect(result).toEqual(mockCase);
    });

    it('shared formal client 拋錯時應保留錯誤傳遞', async () => {
      mocks.formalCreate.mockRejectedValue(new Error('Invalid case response from server'));
      await expect(
        createCase({ plaintiff_statement: '原告', defendant_statement: '被告' })
      ).rejects.toThrow('Invalid case response from server');
    });
  });

  describe('getCase', () => {
    it('應透過 shared M1 quick client 取得 case', async () => {
      mocks.quickGetCase.mockResolvedValue(mockCase);
      const result = await getCase('c1');
      expect(mocks.quickGetCase).toHaveBeenCalledWith('c1', undefined);
      expect(result).toEqual(mockCase);
    });

    it('有 sessionId 時應交給 shared client 帶入 X-Session-Id header', async () => {
      mocks.quickGetCase.mockResolvedValue(mockCase);
      await getCase('c1', 's-session');
      expect(mocks.quickGetCase).toHaveBeenCalledWith('c1', 's-session');
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.quickGetCase.mockRejectedValue(new Error('Invalid case response from server'));
      await expect(getCase('c1')).rejects.toThrow('Invalid case response from server');
    });
  });

  describe('getCaseBySessionId', () => {
    it('成功時應返回 case', async () => {
      mocks.quickGetCaseBySessionId.mockResolvedValue(mockCase);
      const result = await getCaseBySessionId('s1');
      expect(mocks.quickGetCaseBySessionId).toHaveBeenCalledWith('s1');
      expect(result).toEqual(mockCase);
    });

    it('無關聯案件時應返回 null', async () => {
      mocks.quickGetCaseBySessionId.mockResolvedValue(null);
      const result = await getCaseBySessionId('missing-session');
      expect(result).toBeNull();
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.quickGetCaseBySessionId.mockRejectedValue(new Error('Server error'));
      await expect(getCaseBySessionId('s1')).rejects.toThrow('Server error');
    });
  });

  describe('getCaseList', () => {
    it('應透過 shared M4 formal case client 取得 case list', async () => {
      const pagination = { page: 1, page_size: 10, total: 1, total_pages: 1 };
      mocks.formalList.mockResolvedValue({ cases: [mockCase], pagination });
      const result = await getCaseList({ page: 1, page_size: 10 });
      expect(mocks.formalList).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(result.cases).toEqual([mockCase]);
      expect(result.pagination).toEqual(pagination);
    });

    it('無 params 時應傳 undefined', async () => {
      mocks.formalList.mockResolvedValue({
        cases: [],
        pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
      });
      await getCaseList();
      expect(mocks.formalList).toHaveBeenCalledWith(undefined);
    });

    it('shared formal client 拋錯時應保留錯誤傳遞', async () => {
      mocks.formalList.mockRejectedValue(new Error('Invalid case list response from server'));
      await expect(getCaseList()).rejects.toThrow('Invalid case list response from server');
    });
  });

  describe('submitCase', () => {
    it('應透過 shared M4 formal case client submit case', async () => {
      mocks.formalSubmit.mockResolvedValue(mockCase);
      const result = await submitCase('c1');
      expect(mocks.formalSubmit).toHaveBeenCalledWith('c1');
      expect(result).toEqual(mockCase);
    });

    it('shared formal client 拋錯時應保留錯誤傳遞', async () => {
      mocks.formalSubmit.mockRejectedValue(new Error('Invalid case response from server'));
      await expect(submitCase('c1')).rejects.toThrow('Invalid case response from server');
    });
  });

  describe('updateCase', () => {
    it('應透過 shared M4 formal case client update case', async () => {
      mocks.formalUpdate.mockResolvedValue({ ...mockCase, title: 'Updated' });
      const result = await updateCase('c1', { title: 'Updated' });
      expect(mocks.formalUpdate).toHaveBeenCalledWith('c1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('shared formal client 拋錯時應保留錯誤傳遞', async () => {
      mocks.formalUpdate.mockRejectedValue(new Error('Invalid case response from server'));
      await expect(updateCase('c1', { defendant_statement: '被告陳述' })).rejects.toThrow(
        'Invalid case response from server'
      );
    });
  });

  describe('uploadEvidence', () => {
    it('應組 FormData 並透過 shared M5 media client 上傳', async () => {
      const files = [new File(['x'], 'a.jpg', { type: 'image/jpeg' })];
      const evidences = [{ id: 'e1', file_url: 'https://example.com/a.jpg', file_type: 'image' }];
      mocks.mediaUploadEvidence.mockResolvedValue(evidences);
      const result = await uploadEvidence('c1', files);
      expect(mocks.mediaUploadEvidence).toHaveBeenCalledWith('c1', expect.any(FormData), undefined);
      const formData = mocks.mediaUploadEvidence.mock.calls[0][1] as FormData;
      expect(formData.getAll('files')).toEqual(files);
      expect(result).toEqual(evidences);
    });

    it('shared client 回傳空陣列時應保留結果（F03/F05 邊界：API 回傳不完整時防禦）', async () => {
      const files = [new File(['x'], 'a.jpg', { type: 'image/jpeg' })];
      mocks.mediaUploadEvidence.mockResolvedValue([]);
      const result = await uploadEvidence('c1', files);
      expect(result).toEqual([]);
    });

    it('shared client 判定 evidence payload 無效時應保留錯誤傳遞（F03/F05 邊界）', async () => {
      const files = [new File(['x'], 'a.jpg', { type: 'image/jpeg' })];
      mocks.mediaUploadEvidence.mockRejectedValue(new Error('Invalid evidence response from server'));
      await expect(uploadEvidence('c1', files)).rejects.toThrow('Invalid evidence response from server');
    });

    it('有 sessionId 時應交給 shared client 帶入 X-Session-Id header', async () => {
      const files = [new File(['x'], 'b.jpg', { type: 'image/jpeg' })];
      mocks.mediaUploadEvidence.mockResolvedValue([]);
      await uploadEvidence('c1', files, 's1');
      expect(mocks.mediaUploadEvidence).toHaveBeenCalledWith('c1', expect.any(FormData), 's1');
    });
  });

  describe('deleteEvidence', () => {
    it('應透過 shared M5 media client 刪除 evidence', async () => {
      mocks.mediaDeleteEvidence.mockResolvedValue(undefined);
      await deleteEvidence('c1', 'e1');
      expect(mocks.mediaDeleteEvidence).toHaveBeenCalledWith('c1', 'e1', undefined);
    });

    it('有 sessionId 時應交給 shared client 帶入 X-Session-Id header', async () => {
      mocks.mediaDeleteEvidence.mockResolvedValue(undefined);
      await deleteEvidence('c1', 'e1', 's1');
      expect(mocks.mediaDeleteEvidence).toHaveBeenCalledWith('c1', 'e1', 's1');
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.mediaDeleteEvidence.mockRejectedValue(new Error('Invalid evidence delete response from server'));
      await expect(deleteEvidence('c1', 'e2', undefined)).rejects.toThrow(
        'Invalid evidence delete response from server'
      );
    });

    it('無 sessionId 時應傳 undefined', async () => {
      mocks.mediaDeleteEvidence.mockResolvedValue(undefined);
      await deleteEvidence('c1', 'e2', undefined);
      expect(mocks.mediaDeleteEvidence).toHaveBeenCalledWith('c1', 'e2', undefined);
    });
  });

  describe('createCollaborativeCase', () => {
    const collabResponse = {
      case: mockCase,
      session_id: 'cs1',
      session_expires_at: '2026-12-31T00:00:00Z',
      phase: 'a_done' as const,
    };

    it('應透過 shared M1 quick client 建立 collaborative case', async () => {
      mocks.quickCreateCollaborativeCase.mockResolvedValue(collabResponse);
      const input = { plaintiff_statement: '原告陳述' };
      const result = await createCollaborativeCase(input);
      expect(mocks.quickCreateCollaborativeCase).toHaveBeenCalledWith(input, undefined);
      expect(result.case).toEqual(mockCase);
      expect(result.session_id).toBe('cs1');
      expect(result.phase).toBe('a_done');
    });

    it('有 sessionId 時應交給 shared client 帶入 X-Session-Id header', async () => {
      mocks.quickCreateCollaborativeCase.mockResolvedValue(collabResponse);
      const input = { case_id: 'c1', defendant_statement: '被告陳述' };
      await createCollaborativeCase(input, 'existing-session');
      expect(mocks.quickCreateCollaborativeCase).toHaveBeenCalledWith(input, 'existing-session');
    });

    it('shared client 拋錯時應保留錯誤傳遞', async () => {
      mocks.quickCreateCollaborativeCase.mockRejectedValue(new Error('Invalid collaborative case response from server'));
      await expect(createCollaborativeCase({ plaintiff_statement: '原告' })).rejects.toThrow(
        'Invalid collaborative case response from server'
      );
    });
  });
});
