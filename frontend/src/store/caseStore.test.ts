/**
 * caseStore 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCaseStore } from './caseStore';

const mockCreateQuickCase = vi.fn();
const mockSubmitCase = vi.fn();
const mockGetCase = vi.fn();

vi.mock('@/services/api/case', () => ({
  createQuickCase: (...args: unknown[]) => mockCreateQuickCase(...args),
  submitCase: (...args: unknown[]) => mockSubmitCase(...args),
  getCase: (...args: unknown[]) => mockGetCase(...args),
}));

const mockCase = {
  id: 'c1',
  pairing_id: 'p1',
  title: 'Test',
  type: '生活習慣衝突',
  status: 'draft' as const,
  mode: 'quick' as const,
  plaintiff_statement: '原告',
  defendant_statement: '被告',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('caseStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCaseStore.setState({
      currentCase: null,
      error: null,
      isLoading: false,
    });
  });

  it('setCurrentCase 應更新 currentCase', () => {
    useCaseStore.getState().setCurrentCase(mockCase);
    expect(useCaseStore.getState().currentCase).toEqual(mockCase);
  });

  it('clearError 應清空 error', () => {
    useCaseStore.setState({ error: 'some error' });
    useCaseStore.getState().clearError();
    expect(useCaseStore.getState().error).toBeNull();
  });

  it('createQuickCase 成功應設 currentCase', async () => {
    mockCreateQuickCase.mockResolvedValue({ case: mockCase, session_id: 's1' });
    const result = await useCaseStore.getState().createQuickCase({
      plaintiff_statement: '原告',
      defendant_statement: '被告',
    });
    expect(result.case).toEqual(mockCase);
    expect(useCaseStore.getState().currentCase).toEqual(mockCase);
    expect(useCaseStore.getState().error).toBeNull();
  });

  it('createQuickCase 失敗應設 error 並拋出', async () => {
    mockCreateQuickCase.mockRejectedValue(new Error('創建失敗'));
    await expect(
      useCaseStore.getState().createQuickCase({
        plaintiff_statement: '原告',
        defendant_statement: '被告',
      })
    ).rejects.toThrow('創建失敗');
    expect(useCaseStore.getState().error).toBe('創建失敗');
  });

  it('getCase 成功應設 currentCase', async () => {
    mockGetCase.mockResolvedValue(mockCase);
    const result = await useCaseStore.getState().getCase('c1');
    expect(result).toEqual(mockCase);
    expect(useCaseStore.getState().currentCase).toEqual(mockCase);
  });

  it('submitCase 成功且 currentCase 匹配時應更新狀態為 submitted', async () => {
    useCaseStore.setState({ currentCase: mockCase });
    mockSubmitCase.mockResolvedValue({ ...mockCase, id: 'c1', status: 'submitted' });
    await useCaseStore.getState().submitCase('c1');
    expect(useCaseStore.getState().currentCase?.status).toBe('submitted');
    expect(useCaseStore.getState().error).toBeNull();
    expect(useCaseStore.getState().isLoading).toBe(false);
  });

  it('submitCase 成功但 currentCase 不匹配時仍應以 API 結果覆蓋 currentCase', async () => {
    useCaseStore.setState({ currentCase: { ...mockCase, id: 'other' } });
    const submittedCase = { ...mockCase, id: 'c1', status: 'submitted' };
    mockSubmitCase.mockResolvedValue(submittedCase);
    await useCaseStore.getState().submitCase('c1');
    expect(useCaseStore.getState().currentCase).toEqual(submittedCase);
    expect(useCaseStore.getState().isLoading).toBe(false);
  });

  it('submitCase 失敗時應設 error 並拋出', async () => {
    mockSubmitCase.mockRejectedValueOnce(new Error('submit failed'));
    await expect(useCaseStore.getState().submitCase('c1')).rejects.toThrow('submit failed');
    expect(useCaseStore.getState().error).toBe('submit failed');
    expect(useCaseStore.getState().isLoading).toBe(false);
  });

  it('getCase 失敗時應設 error 並拋出', async () => {
    mockGetCase.mockRejectedValueOnce(new Error('get failed'));
    await expect(useCaseStore.getState().getCase('c1')).rejects.toThrow('get failed');
    expect(useCaseStore.getState().error).toBe('get failed');
    expect(useCaseStore.getState().isLoading).toBe(false);
  });

  it('submitCase 在 isLoading=true 時應直接返回不呼叫 API', async () => {
    useCaseStore.setState({ isLoading: true });
    await useCaseStore.getState().submitCase('c1');
    expect(mockSubmitCase).not.toHaveBeenCalled();
  });
});
