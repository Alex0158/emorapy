/**
 * judgmentStore 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useJudgmentStore } from './judgmentStore';

const mockGenerateJudgment = vi.fn();
const mockGetJudgment = vi.fn();
const mockGetJudgmentByCaseId = vi.fn();

vi.mock('@/services/api/judgment', () => ({
  generateJudgment: (...args: unknown[]) => mockGenerateJudgment(...args),
  getJudgment: (...args: unknown[]) => mockGetJudgment(...args),
  getJudgmentByCaseId: (...args: unknown[]) => mockGetJudgmentByCaseId(...args),
}));

const mockJudgment = {
  id: 'j1',
  case_id: 'c1',
  judgment_content: '# 判決內容\n\n此為判決全文。',
  plaintiff_ratio: 60,
  defendant_ratio: 40,
  ai_model: 'gpt-4',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('judgmentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useJudgmentStore.setState({
      currentJudgment: null,
      error: null,
      isLoading: false,
    });
  });

  it('setCurrentJudgment 應更新 currentJudgment', () => {
    useJudgmentStore.getState().setCurrentJudgment(mockJudgment);
    expect(useJudgmentStore.getState().currentJudgment).toEqual(mockJudgment);
  });

  it('clearError 應清空 error', () => {
    useJudgmentStore.setState({ error: 'some error' });
    useJudgmentStore.getState().clearError();
    expect(useJudgmentStore.getState().error).toBeNull();
  });

  it('generateJudgment 成功應設 currentJudgment', async () => {
    mockGenerateJudgment.mockResolvedValue(mockJudgment);
    const result = await useJudgmentStore.getState().generateJudgment('c1');
    expect(result).toEqual(mockJudgment);
    expect(useJudgmentStore.getState().currentJudgment).toEqual(mockJudgment);
    expect(useJudgmentStore.getState().isLoading).toBe(false);
  });

  it('generateJudgment 失敗應設 error 並拋出', async () => {
    mockGenerateJudgment.mockRejectedValue(new Error('生成失敗'));
    await expect(useJudgmentStore.getState().generateJudgment('c1')).rejects.toThrow('生成失敗');
    expect(useJudgmentStore.getState().error).toBe('生成失敗');
    expect(useJudgmentStore.getState().isLoading).toBe(false);
  });

  it('getJudgment 成功應設 currentJudgment', async () => {
    mockGetJudgment.mockResolvedValue(mockJudgment);
    const result = await useJudgmentStore.getState().getJudgment('j1');
    expect(result).toEqual(mockJudgment);
    expect(useJudgmentStore.getState().currentJudgment).toEqual(mockJudgment);
  });

  it('getJudgmentByCaseId 成功應設 currentJudgment', async () => {
    mockGetJudgmentByCaseId.mockResolvedValue(mockJudgment);
    const result = await useJudgmentStore.getState().getJudgmentByCaseId('c1');
    expect(result).toEqual(mockJudgment);
    expect(useJudgmentStore.getState().currentJudgment).toEqual(mockJudgment);
  });

  it('getJudgmentByCaseId 回傳 null（判決尚未生成）時應設 currentJudgment 為 null 並返回 null', async () => {
    mockGetJudgmentByCaseId.mockResolvedValue(null);
    useJudgmentStore.setState({ currentJudgment: mockJudgment });
    const result = await useJudgmentStore.getState().getJudgmentByCaseId('c1');
    expect(result).toBeNull();
    expect(useJudgmentStore.getState().currentJudgment).toBeNull();
    expect(useJudgmentStore.getState().error).toBeNull();
  });

  it('getJudgment 失敗應設 error 並拋出', async () => {
    mockGetJudgment.mockRejectedValue(new Error('取得判決失敗'));
    await expect(
      useJudgmentStore.getState().getJudgment('j1')
    ).rejects.toThrow('取得判決失敗');
    expect(useJudgmentStore.getState().error).toBe('取得判決失敗');
    expect(useJudgmentStore.getState().isLoading).toBe(false);
  });

  it('getJudgmentByCaseId 失敗應設 error 並返回 null', async () => {
    mockGetJudgmentByCaseId.mockRejectedValue(new Error('獲取判決失敗'));
    const result = await useJudgmentStore.getState().getJudgmentByCaseId('c1');
    expect(result).toBeNull();
    expect(useJudgmentStore.getState().error).toBe('獲取判決失敗');
  });

  it('getJudgmentByCaseId 成功但 API 返回 null 時應設 currentJudgment 為 null 並返回 null', async () => {
    mockGetJudgmentByCaseId.mockResolvedValue(null);
    const result = await useJudgmentStore.getState().getJudgmentByCaseId('c1');
    expect(result).toBeNull();
    expect(useJudgmentStore.getState().currentJudgment).toBeNull();
    expect(useJudgmentStore.getState().isLoading).toBe(false);
  });

  it('getJudgment 競態：後發請求先回傳時，先發請求回傳應忽略不覆蓋 state', async () => {
    const j1 = { ...mockJudgment, id: 'j1', case_id: 'c1' };
    const j2 = { ...mockJudgment, id: 'j2', case_id: 'c2' };
    mockGetJudgment
      .mockImplementationOnce(() => new Promise((r) => setTimeout(() => r(j1), 50)))
      .mockResolvedValueOnce(j2);
    const slowPromise = useJudgmentStore.getState().getJudgment('j1');
    const fastResult = await useJudgmentStore.getState().getJudgment('j2');
    expect(fastResult).toEqual(j2);
    expect(useJudgmentStore.getState().currentJudgment).toEqual(j2);
    await slowPromise;
    expect(useJudgmentStore.getState().currentJudgment).toEqual(j2);
  });

  it('getJudgment 競態：後發請求先 reject 時，先發請求 reject 應直接拋出、不設 error', async () => {
    mockGetJudgment
      .mockImplementationOnce(() => new Promise((_, r) => setTimeout(() => r(new Error('慢請求失敗')), 50)))
      .mockRejectedValueOnce(new Error('快請求失敗'));
    const slowPromise = useJudgmentStore.getState().getJudgment('j1');
    await expect(useJudgmentStore.getState().getJudgment('j2')).rejects.toThrow('快請求失敗');
    expect(useJudgmentStore.getState().error).toBe('快請求失敗');
    await expect(slowPromise).rejects.toThrow('慢請求失敗');
    expect(useJudgmentStore.getState().error).toBe('快請求失敗');
  });

  it('getJudgmentByCaseId 競態：後發請求先回傳時，先發請求回傳應忽略不覆蓋 state', async () => {
    const j1 = { ...mockJudgment, id: 'j1', case_id: 'c1' };
    const j2 = { ...mockJudgment, id: 'j2', case_id: 'c2' };
    mockGetJudgmentByCaseId
      .mockImplementationOnce(() => new Promise((r) => setTimeout(() => r(j1), 50)))
      .mockResolvedValueOnce(j2);
    const slowPromise = useJudgmentStore.getState().getJudgmentByCaseId('c1');
    const fastResult = await useJudgmentStore.getState().getJudgmentByCaseId('c2');
    expect(fastResult).toEqual(j2);
    expect(useJudgmentStore.getState().currentJudgment).toEqual(j2);
    await slowPromise;
    expect(useJudgmentStore.getState().currentJudgment).toEqual(j2);
  });

  it('getJudgmentByCaseId 競態：後發請求先 reject 時，先發請求 reject 應 return null、不覆蓋 error', async () => {
    mockGetJudgmentByCaseId
      .mockImplementationOnce(() => new Promise((_, r) => setTimeout(() => r(new Error('慢請求失敗')), 50)))
      .mockRejectedValueOnce(new Error('快請求失敗'));
    const slowPromise = useJudgmentStore.getState().getJudgmentByCaseId('c1');
    const fastResult = await useJudgmentStore.getState().getJudgmentByCaseId('c2');
    expect(fastResult).toBeNull();
    expect(useJudgmentStore.getState().error).toBe('快請求失敗');
    const slowResult = await slowPromise;
    expect(slowResult).toBeNull();
    expect(useJudgmentStore.getState().error).toBe('快請求失敗');
  });
});
