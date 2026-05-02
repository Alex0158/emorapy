import OpenAI from 'openai';
import { env } from './env';
import logger from './logger';
import { AI_TIMEOUT } from '../utils/constants';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: AI_TIMEOUT.OPENAI_REQUEST,
});

export const AI_CONFIG = {
  model: env.OPENAI_MODEL,
  maxTokens: env.OPENAI_MAX_TOKENS,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

export const INTERVIEW_AI_CONFIG = {
  model: env.OPENAI_INTERVIEW_MODEL,
  maxTokens: 800,
  temperature: 0.8,
  topP: 0.95,
  frequencyPenalty: 0.1,
  presencePenalty: 0.2,
};

export const ANALYSIS_AI_CONFIG = {
  model: env.OPENAI_ANALYSIS_MODEL,
  maxTokens: 4000,
  temperature: 0.3,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

if (!env.OPENAI_API_KEY) {
  logger.warn('OpenAI API Key未配置，AI功能將無法使用');
}

export default openai;
