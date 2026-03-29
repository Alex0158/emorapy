/**
 * 內容 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getContentList } from './content';

const mockGet = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

describe('getContentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('無參數時應以空 query string 請求', async () => {
    mockGet.mockResolvedValue({ data: { data: { items: [{ id: 'c1', title: 'Test' }] } } });
    const result = await getContentList();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/content-items'));
    expect(result).toEqual([{ id: 'c1', title: 'Test' }]);
  });

  it('帶 type/language/limit 參數時應正確構建 query string', async () => {
    mockGet.mockResolvedValue({ data: { data: { items: [] } } });
    await getContentList({ type: 'article', language: 'zh-TW', limit: 5 });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('type=article');
    expect(url).toContain('language=zh-TW');
    expect(url).toContain('limit=5');
  });

  it('API 返回無 items 時應 fallback 為空陣列', async () => {
    mockGet.mockResolvedValue({ data: {} });
    const result = await getContentList();
    expect(result).toEqual([]);
  });

  it('API 返回 null data 時應 fallback 為空陣列', async () => {
    mockGet.mockResolvedValue({ data: null });
    const result = await getContentList();
    expect(result).toEqual([]);
  });

  it('後端回傳 items 為非陣列時應返回空陣列（F01 邊界：API 回傳不完整時防禦）', async () => {
    mockGet.mockResolvedValue({ data: { data: { items: { list: [] } } } });
    const result = await getContentList();
    expect(result).toEqual([]);
  });

  it('後端回傳 items 為 null 時應返回空陣列（F01 邊界：API 回傳不完整時防禦）', async () => {
    mockGet.mockResolvedValue({ data: { data: { items: null } } });
    const result = await getContentList();
    expect(result).toEqual([]);
  });
});
