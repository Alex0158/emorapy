/**
 * 分析追蹤工具（簡化版）
 */

import { logger } from './logger';

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

/**
 * 追蹤頁面瀏覽
 */
export const trackPageView = (path: string): void => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'GA_MEASUREMENT_ID', {
      page_path: path,
    });
  }
  if (import.meta.env.DEV) {
    logger.info(`[Analytics] Page View: ${path}`);
  }
};

/**
 * 追蹤事件
 */
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
): void => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
  if (import.meta.env.DEV) {
    logger.info(`[Analytics] Event: ${category}/${action}`, { label, value });
  }
};

/**
 * 追蹤用戶操作
 */
export const trackUserAction = (action: string, details?: Record<string, unknown>): void => {
  trackEvent('User Action', action, undefined, undefined);
  if (import.meta.env.DEV && details) {
    logger.debug('[Analytics] Details', details);
  }
};

