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
});
