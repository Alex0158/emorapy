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

const mockMessageError = vi.fn();
vi.mock('antd', () => ({
  message: {
    error: (...args: unknown[]) => mockMessageError(...args),
  },
}));

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError', () => {
    it('Error 應顯示 error.message', () => {
      handleApiError(new Error('自定義錯誤'));
      expect(mockMessageError).toHaveBeenCalledWith('自定義錯誤');
    });

    it('物件帶 message 應顯示該 message', () => {
      handleApiError({ message: 'API錯誤' });
      expect(mockMessageError).toHaveBeenCalledWith('API錯誤');
    });

    it('物件帶 code 應顯示對應映射', () => {
      handleApiError({ code: 'NETWORK_ERROR' });
      expect(mockMessageError).toHaveBeenCalledWith('網絡連接失敗，請檢查網絡連接');
      mockMessageError.mockClear();
      handleApiError({ code: 'UNAUTHORIZED' });
      expect(mockMessageError).toHaveBeenCalledWith('登錄已過期，請重新登錄');
      mockMessageError.mockClear();
      handleApiError({ code: 'NOT_FOUND' });
      expect(mockMessageError).toHaveBeenCalledWith('資源不存在');
    });

    it('FORBIDDEN 應顯示權限不足訊息', () => {
      handleApiError({ code: 'FORBIDDEN' });
      expect(mockMessageError).toHaveBeenCalledWith('無權限訪問此資源');
    });

    it('RATE_LIMIT 應顯示限流訊息', () => {
      handleApiError({ code: 'RATE_LIMIT' });
      expect(mockMessageError).toHaveBeenCalledWith('請求過於頻繁，請稍後再試');
    });

    it('未知 code 應顯示默認訊息', () => {
      handleApiError({ code: 'UNKNOWN' });
      expect(mockMessageError).toHaveBeenCalledWith('發生未知錯誤，請稍後再試');
    });

    it('非物件或無 message/code 應顯示默認', () => {
      handleApiError(null);
      expect(mockMessageError).toHaveBeenCalledWith('發生未知錯誤，請稍後再試');
    });
  });

  describe('handleValidationError', () => {
    it('應顯示第一個錯誤的第一條', () => {
      handleValidationError({ name: ['姓名不能為空'], email: ['郵箱格式錯誤'] });
      expect(mockMessageError).toHaveBeenCalledWith('姓名不能為空');
    });

    it('空物件不應調用 message.error', () => {
      handleValidationError({});
      expect(mockMessageError).not.toHaveBeenCalled();
    });

    it('第一個 key 陣列為空時不應調用 message.error（邊界）', () => {
      handleValidationError({ name: [], email: ['郵箱格式錯誤'] });
      expect(mockMessageError).not.toHaveBeenCalled();
    });
  });

  describe('handleNetworkError', () => {
    it('應顯示網絡錯誤訊息', () => {
      handleNetworkError();
      expect(mockMessageError).toHaveBeenCalledWith('網絡連接失敗，請檢查網絡連接');
    });
  });

  describe('handleTimeoutError', () => {
    it('應顯示超時錯誤訊息', () => {
      handleTimeoutError();
      expect(mockMessageError).toHaveBeenCalledWith('請求超時，請稍後再試');
    });
  });
});
