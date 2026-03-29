/**
 * 錯誤工具測試
 */

import { AppError, Errors } from '../../../src/utils/errors';

describe('Errors Utils', () => {
  describe('AppError', () => {
    it('應正確創建 AppError 實例', () => {
      const err = new AppError(400, 'TEST', 'Test message', { key: 'value' });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('TEST');
      expect(err.message).toBe('Test message');
      expect(err.details).toEqual({ key: 'value' });
      expect(err.name).toBe('AppError');
    });

    it('details 應可選', () => {
      const err = new AppError(500, 'ERR', 'msg');
      expect(err.details).toBeUndefined();
    });
  });

  describe('Errors 工廠函數', () => {
    const errorFactories: Array<{ name: string; fn: () => AppError; expectedCode: string; expectedStatus: number }> = [
      { name: 'UNAUTHORIZED', fn: () => Errors.UNAUTHORIZED(), expectedCode: 'UNAUTHORIZED', expectedStatus: 401 },
      { name: 'FORBIDDEN', fn: () => Errors.FORBIDDEN(), expectedCode: 'FORBIDDEN', expectedStatus: 403 },
      { name: 'TOKEN_EXPIRED', fn: () => Errors.TOKEN_EXPIRED(), expectedCode: 'TOKEN_EXPIRED', expectedStatus: 401 },
      { name: 'INVALID_CREDENTIALS', fn: () => Errors.INVALID_CREDENTIALS(), expectedCode: 'INVALID_CREDENTIALS', expectedStatus: 401 },
      { name: 'VALIDATION_ERROR', fn: () => Errors.VALIDATION_ERROR(), expectedCode: 'VALIDATION_ERROR', expectedStatus: 400 },
      { name: 'INVALID_EMAIL', fn: () => Errors.INVALID_EMAIL(), expectedCode: 'INVALID_EMAIL', expectedStatus: 400 },
      { name: 'WEAK_PASSWORD', fn: () => Errors.WEAK_PASSWORD(), expectedCode: 'WEAK_PASSWORD', expectedStatus: 400 },
      { name: 'INVALID_CODE', fn: () => Errors.INVALID_CODE(), expectedCode: 'INVALID_CODE', expectedStatus: 400 },
      { name: 'CODE_EXPIRED', fn: () => Errors.CODE_EXPIRED(), expectedCode: 'CODE_EXPIRED', expectedStatus: 400 },
      { name: 'SESSION_ID_REQUIRED', fn: () => Errors.SESSION_ID_REQUIRED(), expectedCode: 'SESSION_ID_REQUIRED', expectedStatus: 400 },
      { name: 'INVALID_SESSION_ID', fn: () => Errors.INVALID_SESSION_ID(), expectedCode: 'INVALID_SESSION_ID', expectedStatus: 400 },
      { name: 'SESSION_EXPIRED', fn: () => Errors.SESSION_EXPIRED(), expectedCode: 'SESSION_EXPIRED', expectedStatus: 401 },
      { name: 'NOT_FOUND', fn: () => Errors.NOT_FOUND(), expectedCode: 'NOT_FOUND', expectedStatus: 404 },
      { name: 'EMAIL_EXISTS', fn: () => Errors.EMAIL_EXISTS(), expectedCode: 'EMAIL_EXISTS', expectedStatus: 409 },
      { name: 'ALREADY_PAIRED', fn: () => Errors.ALREADY_PAIRED(), expectedCode: 'ALREADY_PAIRED', expectedStatus: 409 },
      { name: 'CONFLICT', fn: () => Errors.CONFLICT(), expectedCode: 'CONFLICT', expectedStatus: 409 },
      { name: 'CASE_NOT_READY', fn: () => Errors.CASE_NOT_READY(), expectedCode: 'CASE_NOT_READY', expectedStatus: 422 },
      { name: 'JUDGMENT_EXISTS', fn: () => Errors.JUDGMENT_EXISTS(), expectedCode: 'JUDGMENT_EXISTS', expectedStatus: 409 },
      { name: 'FILE_TOO_LARGE', fn: () => Errors.FILE_TOO_LARGE(), expectedCode: 'FILE_TOO_LARGE', expectedStatus: 413 },
      { name: 'INVALID_FILE_TYPE', fn: () => Errors.INVALID_FILE_TYPE(), expectedCode: 'INVALID_FILE_TYPE', expectedStatus: 400 },
      { name: 'TOO_MANY_FILES', fn: () => Errors.TOO_MANY_FILES(), expectedCode: 'TOO_MANY_FILES', expectedStatus: 400 },
      { name: 'CASE_NOT_EDITABLE', fn: () => Errors.CASE_NOT_EDITABLE(), expectedCode: 'CASE_NOT_EDITABLE', expectedStatus: 422 },
      { name: 'JUDGMENT_FAILED', fn: () => Errors.JUDGMENT_FAILED(), expectedCode: 'JUDGMENT_FAILED', expectedStatus: 409 },
      { name: 'INTERNAL_ERROR', fn: () => Errors.INTERNAL_ERROR(), expectedCode: 'INTERNAL_ERROR', expectedStatus: 500 },
      { name: 'AI_SERVICE_ERROR', fn: () => Errors.AI_SERVICE_ERROR(), expectedCode: 'AI_SERVICE_ERROR', expectedStatus: 503 },
      { name: 'DATABASE_ERROR', fn: () => Errors.DATABASE_ERROR(), expectedCode: 'DATABASE_ERROR', expectedStatus: 500 },
      { name: 'EXTERNAL_SERVICE_ERROR', fn: () => Errors.EXTERNAL_SERVICE_ERROR(), expectedCode: 'EXTERNAL_SERVICE_ERROR', expectedStatus: 503 },
      { name: 'RATE_LIMIT_EXCEEDED', fn: () => Errors.RATE_LIMIT_EXCEEDED(), expectedCode: 'RATE_LIMIT_EXCEEDED', expectedStatus: 429 },
      { name: 'CONSENT_REQUIRED', fn: () => Errors.CONSENT_REQUIRED(), expectedCode: 'CONSENT_REQUIRED', expectedStatus: 403 },
      { name: 'CONCURRENT_REQUEST', fn: () => Errors.CONCURRENT_REQUEST(), expectedCode: 'CONCURRENT_REQUEST', expectedStatus: 409 },
      { name: 'AI_CALL_FAILED', fn: () => Errors.AI_CALL_FAILED(), expectedCode: 'AI_CALL_FAILED', expectedStatus: 503 },
      { name: 'MAX_TURNS_REACHED', fn: () => Errors.MAX_TURNS_REACHED(), expectedCode: 'MAX_TURNS_REACHED', expectedStatus: 422 },
      { name: 'TURN_TOO_FAST', fn: () => Errors.TURN_TOO_FAST(), expectedCode: 'TURN_TOO_FAST', expectedStatus: 429 },
      { name: 'START_RATE_LIMIT', fn: () => Errors.START_RATE_LIMIT(), expectedCode: 'START_RATE_LIMIT', expectedStatus: 429 },
      { name: 'PROCESSING_NOT_DONE', fn: () => Errors.PROCESSING_NOT_DONE(), expectedCode: 'PROCESSING_NOT_DONE', expectedStatus: 409 },
      { name: 'PROCESSING_FAILED', fn: () => Errors.PROCESSING_FAILED(), expectedCode: 'PROCESSING_FAILED', expectedStatus: 500 },
      { name: 'SESSION_COMPLETED', fn: () => Errors.SESSION_COMPLETED(), expectedCode: 'SESSION_COMPLETED', expectedStatus: 409 },
    ];

    errorFactories.forEach(({ name, fn, expectedCode, expectedStatus }) => {
      it(`${name} 應返回正確的 AppError`, () => {
        const err = fn();
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe(expectedCode);
        expect(err.statusCode).toBe(expectedStatus);
      });
    });
  });

  describe('自定義消息', () => {
    it('應支持自定義錯誤消息', () => {
      const err = Errors.VALIDATION_ERROR('自定義驗證錯誤');
      expect(err.message).toBe('自定義驗證錯誤');
    });

    it('VALIDATION_ERROR 應支持 details', () => {
      const err = Errors.VALIDATION_ERROR('驗證失敗', { field: 'email' });
      expect(err.details).toEqual({ field: 'email' });
    });
  });
});
