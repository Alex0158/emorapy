/**
 * config/openai 單元測試（mock env、logger、openai 客戶端）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const mockOpenAIInstance = { chat: { completions: { create: jest.fn() } } };

const mockEnvValues: Record<string, unknown> = {
  OPENAI_API_KEY: 'sk-test-key',
  OPENAI_MODEL: 'gpt-4',
  OPENAI_MAX_TOKENS: 2048,
};

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvValues;
  },
}));
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockOpenAIInstance),
}));

describe('config/openai', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvValues.OPENAI_API_KEY = 'sk-test-key';
    mockEnvValues.OPENAI_MODEL = 'gpt-4';
    mockEnvValues.OPENAI_MAX_TOKENS = 2048;
  });

  it('應導出 OpenAI 客戶端實例', async () => {
    const openaiModule = await import('../../../src/config/openai');
    expect(openaiModule.openai).toBeDefined();
    expect(openaiModule.openai).toBe(mockOpenAIInstance);
    expect(openaiModule.default).toBe(mockOpenAIInstance);
  });

  it('應導出 AI_CONFIG 含 model、maxTokens、temperature 等', async () => {
    const { AI_CONFIG } = await import('../../../src/config/openai');
    expect(AI_CONFIG).toEqual(
      expect.objectContaining({
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
      })
    );
  });

  it('當 OPENAI_API_KEY 未配置時應呼叫 logger.warn', async () => {
    mockEnvValues.OPENAI_API_KEY = '';
    jest.resetModules();
    await import('../../../src/config/openai');
    expect(mockLogger.warn).toHaveBeenCalledWith('OpenAI API Key未配置，AI功能將無法使用');
  });

  it('當 OPENAI_API_KEY 已配置時不應呼叫 logger.warn', async () => {
    mockEnvValues.OPENAI_API_KEY = 'sk-ok';
    jest.resetModules();
    await import('../../../src/config/openai');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
