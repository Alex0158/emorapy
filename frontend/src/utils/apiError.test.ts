/**
 * API 錯誤處理工具單元測試
 */
import { beforeEach, describe, it, expect } from 'vitest';
import {
  isApiError,
  getErrorMessage,
  getErrorCode,
  isNetworkError,
  isAuthError,
} from './apiError';
import { setLocale, t } from '@/utils/i18n';

async function setLocaleReady(locale: 'zh-TW' | 'en-US'): Promise<void> {
  setLocale(locale);
  if (locale === 'en-US') {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (t('apiError.invalidResponse') === 'The service response could not be read. Please try again later.') return;
    }
  } else {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('apiError', () => {
  beforeEach(() => {
    setLocale('zh-TW');
  });

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
    it('含 message 字串的普通物件（無 code）應返回 message', () => {
      expect(getErrorMessage({ message: 'direct message' })).toBe('direct message');
    });
    it('shared/service invalid response fallback 應使用目前語言', async () => {
      expect(getErrorMessage({ code: 'INVALID_PROFILE_RESPONSE', message: 'Invalid profile response from server' })).toBe(
        '服務回應格式異常，請稍後再試'
      );
      expect(getErrorMessage(new Error('Invalid avatar upload response from server'))).toBe(
        '服務回應格式異常，請稍後再試'
      );
      expect(getErrorMessage({ error: { message: 'Invalid relationship profile response from server' } })).toBe(
        '服務回應格式異常，請稍後再試'
      );

      await setLocaleReady('en-US');

      expect(getErrorMessage({ code: 'INVALID_CASE_RESPONSE', message: 'Invalid case response from server' })).toBe(
        'The service response could not be read. Please try again later.'
      );
    });
    it('非 invalid-response pattern 的英文 message 應保持原樣', () => {
      expect(getErrorMessage({ code: 'ERR', message: 'direct message' })).toBe('direct message');
    });
    it('Object.create(null) 加上 message 應返回 message', () => {
      const o = Object.create(null) as { message: string };
      o.message = 'from prototype-less';
      expect(getErrorMessage(o)).toBe('from prototype-less');
    });
    it('Error 實例應返回 message', () => {
      expect(getErrorMessage(new Error('錯誤'))).toBe('錯誤');
    });
    it('Error 實例且 message 非字串時應使用 fallback 而非拋錯', () => {
      const e = new Error();
      Object.defineProperty(e, 'message', { get: () => 123 as unknown, configurable: true });
      expect(getErrorMessage(e)).toBe('發生未知錯誤，請稍後再試');
      expect(getErrorMessage(e, 'message.createCaseFail')).toBe('創建案件失敗');
    });
    it('其他應返回 common.unknownError 對應文案', () => {
      expect(getErrorMessage(null)).toBe('發生未知錯誤，請稍後再試');
      expect(getErrorMessage(1)).toBe('發生未知錯誤，請稍後再試');
    });
    it('有 fallbackKey 時應使用對應 i18n 文案', () => {
      expect(getErrorMessage(null, 'message.createCaseFail')).toBe('創建案件失敗');
    });
    it('message 為空字串時應使用 fallback 而非顯示空白', () => {
      expect(getErrorMessage({ code: 'FORBIDDEN', message: '' }, 'message.submitCaseFail')).toBe('提交案件失敗');
      expect(getErrorMessage({ message: '' })).toBe('發生未知錯誤，請稍後再試');
    });
    it('message 為 null 時應使用 fallback 且不拋錯（F10 邊界：API 可能回傳 null）', () => {
      expect(getErrorMessage({ code: 'SERVER_ERROR', message: null }, 'message.createCaseFail')).toBe('創建案件失敗');
      expect(getErrorMessage({ message: null })).toBe('發生未知錯誤，請稍後再試');
    });
    it('message 為 undefined 時應使用 fallback（F10 邊界：API 可能回傳不完整）', () => {
      expect(getErrorMessage({ code: 'FORBIDDEN', message: undefined }, 'message.submitCaseFail')).toBe('提交案件失敗');
      expect(getErrorMessage({ message: undefined })).toBe('發生未知錯誤，請稍後再試');
    });
    it('FORBIDDEN 且無 message 屬性時應使用 fallback（權限邊界 fallback 慣例）', () => {
      expect(getErrorMessage({ code: 'FORBIDDEN' }, 'message.createCaseFail')).toBe('創建案件失敗');
      expect(getErrorMessage({ code: 'FORBIDDEN' })).toBe('發生未知錯誤，請稍後再試');
    });
    it('message 僅空白時應使用 fallback', () => {
      expect(getErrorMessage({ code: 'ERR', message: '   ' }, 'message.createCaseFail')).toBe('創建案件失敗');
    });
    it('Error 實例且 message 為空時應使用 fallback', () => {
      expect(getErrorMessage(new Error(''), 'message.createCaseFail')).toBe('創建案件失敗');
    });
    it('含嵌套 error.message 時應返回該 message（API 常見結構）', () => {
      expect(getErrorMessage({ error: { message: '後端錯誤詳情' } })).toBe('後端錯誤詳情');
    });
    it('嵌套 error.message 為空字串時應使用 fallback（F10 邊界）', () => {
      expect(getErrorMessage({ error: { message: '' } }, 'message.submitCaseFail')).toBe('提交案件失敗');
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
    it('非 ApiError（null、Error 實例）應為 false', () => {
      expect(isAuthError(null)).toBe(false);
      expect(isAuthError(new Error('network'))).toBe(false);
    });
    it('ApiError 但 code 非認證類應為 false', () => {
      expect(isAuthError({ code: 'OTHER', message: 'x' })).toBe(false);
    });
  });
});
