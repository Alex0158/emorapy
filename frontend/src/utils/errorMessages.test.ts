/**
 * 錯誤消息映射單元測試
 */
import { describe, it, expect } from 'vitest';
import { ERROR_MESSAGES, getErrorMessage } from './errorMessages';

describe('errorMessages', () => {
  describe('ERROR_MESSAGES', () => {
    it('應包含認證相關錯誤', () => {
      expect(ERROR_MESSAGES.UNAUTHORIZED).toBe('請先登錄');
      expect(ERROR_MESSAGES.TOKEN_EXPIRED).toBe('登錄已過期，請重新登錄');
      expect(ERROR_MESSAGES.INVALID_CREDENTIALS).toBe('郵箱或密碼錯誤');
    });

    it('應包含驗證與 Session 錯誤', () => {
      expect(ERROR_MESSAGES.VALIDATION_ERROR).toBe('請檢查輸入內容');
      expect(ERROR_MESSAGES.SESSION_EXPIRED).toBe('Session已過期，請重新開始');
    });

    it('應包含資源與案件錯誤', () => {
      expect(ERROR_MESSAGES.NOT_FOUND).toBe('資源不存在');
      expect(ERROR_MESSAGES.JUDGMENT_PENDING).toBe('判決生成中，請稍後再試');
    });

    it('應包含系統與默認錯誤', () => {
      expect(ERROR_MESSAGES.INTERNAL_ERROR).toBe('服務器內部錯誤');
      expect(ERROR_MESSAGES.UNKNOWN_ERROR).toBe('發生未知錯誤');
    });
  });

  describe('getErrorMessage', () => {
    it('已知 code 應返回對應消息', () => {
      expect(getErrorMessage('UNAUTHORIZED')).toBe('請先登錄');
      expect(getErrorMessage('NOT_FOUND')).toBe('資源不存在');
    });

    it('FORBIDDEN/JUDGMENT_NOT_FOUND 等 code 應返回對應消息（F10 邊界：權限與判決錯誤映射）', () => {
      expect(getErrorMessage('FORBIDDEN')).toBe('無權限訪問此資源');
      expect(getErrorMessage('JUDGMENT_NOT_FOUND')).toBe('判決尚未生成');
    });

    it('未知 code 應返回 UNKNOWN_ERROR', () => {
      expect(getErrorMessage('UNKNOWN_CODE')).toBe('發生未知錯誤');
    });

    it('傳入 defaultMessage 時未知 code 應返回 defaultMessage', () => {
      expect(getErrorMessage('UNKNOWN', '自定義錯誤')).toBe('自定義錯誤');
    });
  });
});
