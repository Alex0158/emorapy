import { describe, expect, it } from '@jest/globals';
import { translateBackendMessage, translateErrorByCode } from '../../../src/i18n';

describe('backend i18n', () => {
  it('translates backend-owned response messages to en-US', () => {
    expect(translateBackendMessage('en-US', 'interview.maxTurns 不可小於 interview.softTarget')).toBe(
      'interview.maxTurns cannot be less than interview.softTarget'
    );
    expect(translateBackendMessage('en-US', '缺少 B 方完整陳述')).toBe("Partner's complete statement is missing");
    expect(translateBackendMessage('en-US', '服務內部錯誤')).toBe('Internal service error');
    expect(translateBackendMessage('en-US', 'AI 重調失敗')).toBe('AI adjustment failed');
  });

  it('translates errorHandler special-case response messages to en-US', () => {
    expect(translateBackendMessage('en-US', '該郵箱已被註冊')).toBe(
      'This email has already been registered'
    );
    expect(translateBackendMessage('en-US', '文件大小超出限制')).toBe('File size exceeds the limit');
    expect(translateBackendMessage('en-US', '文件數量超出限制')).toBe('File count exceeds the limit');
    expect(translateBackendMessage('en-US', '無效的文件字段')).toBe('Invalid file field');
    expect(translateBackendMessage('en-US', '文件上傳失敗')).toBe('File upload failed');
  });

  it('translates development unique constraint diagnostics without leaving CJK fallback suffixes', () => {
    expect(translateBackendMessage('en-US', '唯一約束違規: 未知字段')).toBe(
      'Unique constraint violation: unknown field'
    );
    expect(translateBackendMessage('en-US', '唯一約束違規: email')).toBe(
      'Unique constraint violation: email'
    );
  });

  it('keeps zh-TW backend messages unchanged', () => {
    expect(translateBackendMessage('zh-TW', '缺少 B 方完整陳述')).toBe('缺少 B 方完整陳述');
  });

  it('translates dynamic media provider response messages without localizing provider names', () => {
    expect(translateBackendMessage('en-US', 'NanoBananaPro 連線測試成功')).toBe(
      'NanoBananaPro connection test successful'
    );
    expect(translateBackendMessage('en-US', 'NanoBananaPro 連線測試成功（fallback 驗證）')).toBe(
      'NanoBananaPro connection test successful (fallback validation)'
    );
    expect(translateBackendMessage('en-US', 'NanoBananaPro 測試失敗：請檢查 API Key 與網路連線')).toBe(
      'NanoBananaPro test failed: Check the API Key and network connection'
    );
    expect(translateBackendMessage('en-US', 'Seedance 連線測試失敗，請檢查 baseUrl/API Key')).toBe(
      'Seedance connection test failed. Check baseUrl/API Key'
    );
  });

  it('uses public Analysis terminology for backend judgment response messages', () => {
    expect(translateErrorByCode('en-US', 'JUDGMENT_FAILED')).toBe(
      'Analysis generation failed, please retry later'
    );
    expect(translateBackendMessage('en-US', '判決生成中，請稍後再試')).toBe(
      'Analysis is being generated, please try again later'
    );
    expect(translateBackendMessage('en-US', '判決已生成')).toBe('Analysis generated');
  });
});
