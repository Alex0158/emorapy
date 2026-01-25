import OpenAI from 'openai';
import { env } from './env';
import logger from './logger';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 60000, // 60秒超時
});

export const AI_CONFIG = {
  model: env.OPENAI_MODEL,
  maxTokens: env.OPENAI_MAX_TOKENS,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

// 驗證OpenAI配置
if (!env.OPENAI_API_KEY) {
  logger.warn('OpenAI API Key未配置，AI功能將無法使用');
}

export default openai;

