/**
 * env/logger 循環初始化回歸測試。
 *
 * logger 依賴 env；env 在 module 初始化期間動態讀 logger 時，CommonJS 可能回傳
 * 尚未完成初始化、default 為 undefined 的 module，而不是直接 throw。
 */
describe('config/env logger fallback', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
    jest.dontMock('../../../src/config/logger');
  });

  it('logger module 尚未完成初始化時仍可安全處理非 production warning', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'short-test-secret',
      OPENAI_API_KEY: 'sk-test-placeholder',
    };

    jest.isolateModules(() => {
      jest.doMock('../../../src/config/logger', () => ({
        __esModule: true,
        default: undefined,
      }));

      expect(() => require('../../../src/config/env')).not.toThrow();
    });
  });
});
