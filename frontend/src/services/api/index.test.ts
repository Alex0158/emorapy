/**
 * API 服務 barrel 導出測試（覆蓋 index 的 export 語句）
 */
import { describe, it, expect } from 'vitest';
import * as api from './index';

describe('api index', () => {
  it('應導出 createSession', () => {
    expect(api.createSession).toBeDefined();
    expect(typeof api.createSession).toBe('function');
  });

  it('應導出 refreshSession', () => {
    expect(api.refreshSession).toBeDefined();
    expect(typeof api.refreshSession).toBe('function');
  });
});
