/**
 * 錯誤處理工具單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleApiError,
  handleValidationError,
  handleNetworkError,
  handleTimeoutError,
} from './errorHandler';

const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError', () => {
    it('Error 應顯示本地化 fallback 而非 error.message', () => {
      handleApiError(new Error('自定義錯誤'));
      expect(mockToastError).toHaveBeenCalledWith('發生未知錯誤，請稍後再試');
    });

    it('物件帶 message 應顯示本地化 fallback 而非 raw message', () => {
      handleApiError({ message: 'API錯誤' });
      expect(mockToastError).toHaveBeenCalledWith('發生未知錯誤，請稍後再試');
    });

    it('物件帶 code 應顯示對應映射', () => {
      handleApiError({ code: 'NETWORK_ERROR' });
      expect(mockToastError).toHaveBeenCalledWith('網絡連接失敗，請檢查網絡連接');
      mockToastError.mockClear();
      handleApiError({ code: 'UNAUTHORIZED' });
      expect(mockToastError).toHaveBeenCalledWith('登錄已過期，請重新登錄');
      mockToastError.mockClear();
      handleApiError({ code: 'NOT_FOUND' });
      expect(mockToastError).toHaveBeenCalledWith('資源不存在');
    });

    it('FORBIDDEN 應顯示權限不足訊息', () => {
      handleApiError({ code: 'FORBIDDEN' });
      expect(mockToastError).toHaveBeenCalledWith('無權限訪問此資源');
    });

    it('RATE_LIMIT 應顯示限流訊息', () => {
      handleApiError({ code: 'RATE_LIMIT' });
      expect(mockToastError).toHaveBeenCalledWith('請求過於頻繁，請稍後再試');
    });

    it('未知 code 應顯示默認訊息', () => {
      handleApiError({ code: 'UNKNOWN' });
      expect(mockToastError).toHaveBeenCalledWith('發生未知錯誤，請稍後再試');
    });

    it('非物件或無 message/code 應顯示默認', () => {
      handleApiError(null);
      expect(mockToastError).toHaveBeenCalledWith('發生未知錯誤，請稍後再試');
    });
  });

  describe('handleValidationError', () => {
    it('應顯示第一個錯誤的第一條', () => {
      handleValidationError({ name: ['姓名不能為空'], email: ['郵箱格式錯誤'] });
      expect(mockToastError).toHaveBeenCalledWith('姓名不能為空');
    });

    it('空物件不應調用 toast.error', () => {
      handleValidationError({});
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('第一個 key 陣列為空時不應調用 toast.error（邊界）', () => {
      handleValidationError({ name: [], email: ['郵箱格式錯誤'] });
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe('handleNetworkError', () => {
    it('應顯示網絡錯誤訊息', () => {
      handleNetworkError();
      expect(mockToastError).toHaveBeenCalledWith('網絡連接失敗，請檢查網絡連接');
    });
  });

  describe('handleTimeoutError', () => {
    it('應顯示超時錯誤訊息', () => {
      handleTimeoutError();
      expect(mockToastError).toHaveBeenCalledWith('請求超時，請稍後再試');
    });
  });
});
