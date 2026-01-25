/**
 * 分析追蹤工具（簡化版）
 */

/**
 * 追蹤頁面瀏覽
 */
export const trackPageView = (path: string): void => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
      page_path: path,
    });
  }
  // 僅在開發環境輸出
  if (import.meta.env.DEV) {
  console.log(`[Analytics] Page View: ${path}`);
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
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
  // 僅在開發環境輸出
  if (import.meta.env.DEV) {
  console.log(`[Analytics] Event: ${category}/${action}`, { label, value });
  }
};

/**
 * 追蹤用戶操作
 */
export const trackUserAction = (action: string, details?: Record<string, any>): void => {
  trackEvent('User Action', action, undefined, undefined);
  // 僅在開發環境輸出
  if (import.meta.env.DEV && details) {
    console.log('[Analytics] Details:', details);
  }
};

