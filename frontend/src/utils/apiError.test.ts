/**
 * API 錯誤處理工具單元測試
 */
import { describe, it, expect } from 'vitest';
import {
  isApiError,
  getErrorMessage,
  getErrorCode,
  isNetworkError,
  isAuthError,
} from './apiError';

describe('apiError', () => {
  describe('isApiError', () => {
    it('有 code 與 message 的對象應為 true', () => {
      expect(isApiError({ code: 'ERR', message: 'msg' })).toBe(true);
    });
    it('缺少 code 或 message 應為 false', () => {
      expect(isApiError({ message: 'msg' })).toBe(false);
      expect(isApiError({ code: 'ERR' })).toBe(false);
      expect(isApiError(null)).toBe(false);
      expect(isApiError('string')).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('ApiError 應返回 message', () => {
      expect(getErrorMessage({ code: 'ERR', message: '用戶可見' })).toBe('用戶可見');
    });
    it('Error 實例應返回 message', () => {
      expect(getErrorMessage(new Error('錯誤'))).toBe('錯誤');
    });
    it('其他應返回 common.unknownError 對應文案', () => {
      expect(getErrorMessage(null)).toBe('發生未知錯誤，請稍後再試');
      expect(getErrorMessage(1)).toBe('發生未知錯誤，請稍後再試');
    });
    it('有 fallbackKey 時應使用對應 i18n 文案', () => {
      expect(getErrorMessage(null, 'message.createCaseFail')).toBe('創建案件失敗');
    });
  });

  describe('getErrorCode', () => {
    it('ApiError 應返回 code', () => {
      expect(getErrorCode({ code: 'VALIDATION_ERROR', message: 'x' })).toBe('VALIDATION_ERROR');
    });
    it('非 ApiError 應返回 UNKNOWN_ERROR', () => {
      expect(getErrorCode(new Error('x'))).toBe('UNKNOWN_ERROR');
    });
  });

  describe('isNetworkError', () => {
    it('code 為 NETWORK_ERROR 應為 true', () => {
      expect(isNetworkError({ code: 'NETWORK_ERROR', message: 'x' })).toBe(true);
    });
    it('其他應為 false', () => {
      expect(isNetworkError({ code: 'OTHER', message: 'x' })).toBe(false);
      expect(isNetworkError(new Error())).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('code 為 UNAUTHORIZED/TOKEN_EXPIRED/INVALID_CREDENTIALS 應為 true', () => {
      expect(isAuthError({ code: 'UNAUTHORIZED', message: 'x' })).toBe(true);
      expect(isAuthError({ code: 'TOKEN_EXPIRED', message: 'x' })).toBe(true);
      expect(isAuthError({ code: 'INVALID_CREDENTIALS', message: 'x' })).toBe(true);
    });
    it('其他應為 false', () => {
      expect(isAuthError({ code: 'OTHER', message: 'x' })).toBe(false);
    });
  });
});
