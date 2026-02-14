/**
 * 路由配置單元測試
 */
import { describe, it, expect } from 'vitest';
import { router } from './index';

describe('router', () => {
  it('應導出 router 實例', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('object');
  });
});
