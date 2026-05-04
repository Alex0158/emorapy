/**
 * 響應處理工具單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleApiResponse,
  handleApiError,
  isSuccessResponse,
  isErrorResponse,
} from './responseHandler';

const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe('responseHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiResponse', () => {
    it('success 且 data 存在時應返回 data', () => {
      const data = { id: '1' };
      expect(handleApiResponse({ success: true, data })).toBe(data);
    });

    it('success 為 false 時應拋錯', () => {
      expect(() => handleApiResponse({ success: false, data: null })).toThrow(
        'Invalid API response format'
      );
    });

    it('data 為 null/undefined 時應拋錯', () => {
      expect(() => handleApiResponse({ success: true, data: null as unknown })).toThrow(
        'Invalid API response format'
      );
    });
  });

  describe('handleApiError', () => {
    it('預設 showMessage 為 true 應調用 toast.error', () => {
      handleApiError(new Error('err'));
      expect(mockToastError).toHaveBeenCalledWith('err');
    });

    it('showMessage 為 true 時應調用 toast.error', () => {
      handleApiError(new Error('err'), true);
      expect(mockToastError).toHaveBeenCalledWith('err');
    });

    it('showMessage 為 false 時不應調用 toast.error', () => {
      handleApiError(new Error('err'), false);
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('物件帶 message 時應顯示該 message', () => {
      handleApiError({ message: 'custom' }, true);
      expect(mockToastError).toHaveBeenCalledWith('custom');
    });

    it('物件帶 error.message 時應顯示', () => {
      handleApiError({ error: { message: 'nested' } }, true);
      expect(mockToastError).toHaveBeenCalledWith('nested');
    });

    it('無法取得 message 時應顯示默認', () => {
      handleApiError({}, true);
      expect(mockToastError).toHaveBeenCalledWith('發生未知錯誤，請稍後再試');
    });
  });

  describe('isSuccessResponse', () => {
    it('物件含 success: true 應返回 true', () => {
      expect(isSuccessResponse({ success: true, data: {} })).toBe(true);
    });

    it('success 為 false 應返回 false', () => {
      expect(isSuccessResponse({ success: false })).toBe(false);
    });

    it('無 success 或非物件應返回 false', () => {
      expect(isSuccessResponse(null)).toBe(false);
      expect(isSuccessResponse({})).toBe(false);
      expect(isSuccessResponse('string')).toBe(false);
    });
  });

  describe('isErrorResponse', () => {
    it('物件含 success: false 應返回 true', () => {
      expect(isErrorResponse({ success: false })).toBe(true);
    });

    it('success 為 true 應返回 false', () => {
      expect(isErrorResponse({ success: true, data: {} })).toBe(false);
    });

    it('非物件或無 success 應返回 false', () => {
      expect(isErrorResponse(null)).toBe(false);
      expect(isErrorResponse({})).toBe(false);
    });
  });
});
