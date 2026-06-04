import type { AIStreamErrorPayload } from '../types/ai-stream';
import {
  translateBackendMessage,
  translateErrorByCode,
  type BackendLocale,
} from '../i18n';

export interface BuildAIStreamFailurePayloadParams {
  code: string;
  locale?: BackendLocale;
  message?: string;
  fallbackMessage?: string;
  retryable?: boolean;
}

const DEFAULT_FALLBACK_MESSAGE = '服務內部錯誤';
const CJK_PATTERN = /[\u3400-\u9fff]/;

export function buildAIStreamFailurePayload({
  code,
  locale = 'zh-TW',
  message,
  fallbackMessage = DEFAULT_FALLBACK_MESSAGE,
  retryable,
}: BuildAIStreamFailurePayloadParams): AIStreamErrorPayload {
  return {
    code,
    message: resolveAIStreamFailureMessage({
      code,
      locale,
      message,
      fallbackMessage,
    }),
    ...(typeof retryable === 'boolean' ? { retryable } : {}),
  };
}

function resolveAIStreamFailureMessage({
  code,
  locale,
  message,
  fallbackMessage,
}: {
  code: string;
  locale: BackendLocale;
  message?: string;
  fallbackMessage: string;
}): string {
  if (message?.trim()) {
    const trimmedMessage = message.trim();
    const translated = translateBackendMessage(locale, trimmedMessage);
    if (translated !== trimmedMessage) return translated;
    if (locale === 'zh-TW' && CJK_PATTERN.test(trimmedMessage)) return trimmedMessage;
  }

  const translatedByCode = translateErrorByCode(locale, code);
  if (translatedByCode !== code) return translatedByCode;

  const translatedFallback = translateBackendMessage(locale, fallbackMessage);
  if (translatedFallback !== fallbackMessage || locale === 'zh-TW') {
    return translatedFallback;
  }

  return translateBackendMessage(locale, DEFAULT_FALLBACK_MESSAGE);
}
