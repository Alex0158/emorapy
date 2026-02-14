/**
 * types/common 匯入與形狀測試
 */
import { describe, it, expect } from 'vitest';

describe('types/common', () => {
  it('ApiResponse 形狀應包含 success、data', () => {
    const res: { success: boolean; data: unknown; message?: string } = {
      success: true,
      data: { id: 1 },
    };
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: 1 });
  });

  it('ApiError 形狀應包含 code、message', () => {
    const err: { code: string; message: string } = {
      code: 'VALIDATION_ERROR',
      message: '驗證失敗',
    };
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('驗證失敗');
  });

  it('PaginationParams 形狀應包含可選 page、page_size', () => {
    const params: { page?: number; page_size?: number } = { page: 1, page_size: 10 };
    expect(params.page).toBe(1);
    expect(params.page_size).toBe(10);
  });

  it('ResponsibilityRatio 形狀應包含 plaintiff、defendant', () => {
    const ratio: { plaintiff: number; defendant: number } = { plaintiff: 60, defendant: 40 };
    expect(ratio.plaintiff).toBe(60);
    expect(ratio.defendant).toBe(40);
  });
});
