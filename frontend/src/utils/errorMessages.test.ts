/**
 * 錯誤消息映射單元測試
 */
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { setLocale, t, type Locale } from '@/utils/i18n';
import { ERROR_MESSAGE_KEYS, getErrorMessage } from './errorMessages';

async function setLocaleReady(locale: Locale): Promise<void> {
  setLocale(locale);
  if (locale === 'en-US') {
    await waitFor(() => expect(t('common.unknownError')).toBe('Unknown error'));
  }
}

describe('errorMessages', () => {
  beforeEach(() => {
    setLocale('zh-TW');
  });

  describe('ERROR_MESSAGE_KEYS', () => {
    it('應將認證相關錯誤映射到 i18n key', () => {
      expect(ERROR_MESSAGE_KEYS.UNAUTHORIZED).toBe('common.unauthorized');
      expect(ERROR_MESSAGE_KEYS.TOKEN_EXPIRED).toBe('common.unauthorized');
      expect(ERROR_MESSAGE_KEYS.INVALID_CREDENTIALS).toBe('common.invalidCredentials');
    });

    it('應包含驗證與 Session 錯誤', () => {
      expect(ERROR_MESSAGE_KEYS.VALIDATION_ERROR).toBe('common.validationError');
      expect(ERROR_MESSAGE_KEYS.SESSION_EXPIRED).toBe('errorCode.sessionExpired');
    });

    it('應包含資源與案件錯誤', () => {
      expect(ERROR_MESSAGE_KEYS.NOT_FOUND).toBe('common.notFound');
      expect(ERROR_MESSAGE_KEYS.JUDGMENT_PENDING).toBe('errorCode.analysisPending');
    });

    it('應包含系統與默認錯誤', () => {
      expect(ERROR_MESSAGE_KEYS.INTERNAL_ERROR).toBe('common.serverError');
      expect(ERROR_MESSAGE_KEYS.UNKNOWN_ERROR).toBe('common.unknownError');
    });
  });

  describe('getErrorMessage', () => {
    it('已知 code 應按 zh-TW locale 返回對應消息', () => {
      expect(getErrorMessage('UNAUTHORIZED')).toBe('登錄已過期，請重新登錄');
      expect(getErrorMessage('NOT_FOUND')).toBe('資源不存在');
    });

    it('FORBIDDEN/JUDGMENT_NOT_FOUND 等 code 應返回本地化消息（F10 邊界：權限與梳理結果錯誤映射）', () => {
      expect(getErrorMessage('FORBIDDEN')).toBe('無權限訪問此資源');
      expect(getErrorMessage('JUDGMENT_NOT_FOUND')).toBe('梳理結果尚未生成');
    });

    it('已知 code 應按 en-US locale 返回對應消息', async () => {
      await setLocaleReady('en-US');
      expect(getErrorMessage('UNAUTHORIZED')).toBe('Session expired, please log in again');
      expect(getErrorMessage('JUDGMENT_NOT_FOUND')).toBe('Analysis has not been generated yet');
      expect(getErrorMessage('AI_CALL_FAILED')).toBe('AI response failed, please reload the conversation');
    });

    it('未知 code 應返回 common.unknownError', () => {
      expect(getErrorMessage('UNKNOWN_CODE')).toBe('發生未知錯誤，請稍後再試');
    });

    it('傳入 defaultMessage 時未知 code 應返回 defaultMessage', () => {
      expect(getErrorMessage('UNKNOWN', '自定義錯誤')).toBe('自定義錯誤');
    });

    it('code 為空時應使用非空 fallback，否則返回 common.unknownError', () => {
      expect(getErrorMessage(null, '後端已正規化錯誤')).toBe('後端已正規化錯誤');
      expect(getErrorMessage(undefined, '   ')).toBe('發生未知錯誤，請稍後再試');
    });
  });
});
