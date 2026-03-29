/**
 * 分析追蹤工具單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackPageView, trackEvent, trackUserAction } from './analytics';

const mockGtag = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerDebug = vi.fn();
vi.mock('./logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
  },
}));

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'gtag', {
      value: mockGtag,
      writable: true,
      configurable: true,
    });
  });

  describe('trackPageView', () => {
    it('window.gtag 存在時應調用 gtag config', () => {
      trackPageView('/path');
      expect(mockGtag).toHaveBeenCalledWith('config', 'GA_MEASUREMENT_ID', {
        page_path: '/path',
      });
    });

    it('無 gtag 時不應拋錯', () => {
      Object.defineProperty(window, 'gtag', { value: undefined, writable: true, configurable: true });
      expect(() => trackPageView('/path')).not.toThrow();
    });
  });

  describe('trackEvent', () => {
    it('應調用 gtag event 並傳 category、action、label、value', () => {
      trackEvent('Category', 'action_name', 'label', 1);
      expect(mockGtag).toHaveBeenCalledWith('event', 'action_name', {
        event_category: 'Category',
        event_label: 'label',
        value: 1,
      });
    });

    it('label 與 value 可選', () => {
      trackEvent('Cat', 'act');
      expect(mockGtag).toHaveBeenCalledWith('event', 'act', {
        event_category: 'Cat',
        event_label: undefined,
        value: undefined,
      });
    });
  });

  describe('trackUserAction', () => {
    it('應調用 trackEvent 並傳 User Action 與 action', () => {
      trackUserAction('click_button');
      expect(mockGtag).toHaveBeenCalledWith('event', 'click_button', expect.objectContaining({
        event_category: 'User Action',
      }));
    });
    it('DEV 且傳入 details 時應呼叫 logger.debug', () => {
      trackUserAction('submit_form', { field: 'email' });
      expect(mockLoggerDebug).toHaveBeenCalledWith('[Analytics] Details', { field: 'email' });
    });
  });
});
