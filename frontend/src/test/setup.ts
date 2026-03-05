import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom 缺少的 Web API mock
if (!Element.prototype.animate) {
  (Element.prototype as unknown as { animate: () => Animation }).animate = function () {
    return {
      cancel: () => {},
      finish: () => {},
      play: () => {},
      pause: () => {},
    } as unknown as Animation;
  };
}

if (typeof (HTMLElement.prototype as HTMLElement & { scrollIntoView?: (arg?: ScrollIntoViewOptions) => void }).scrollIntoView !== 'function') {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });
}

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

// 測試預設語言固定為 zh-TW，避免受執行環境 navigator.language 影響
window.localStorage.setItem('cj_locale', 'zh-TW');

if (typeof globalThis.ResizeObserver !== 'function') {
  class ResizeObserverMock implements ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

if (typeof globalThis.IntersectionObserver !== 'function') {
  class IntersectionObserverMock implements IntersectionObserver {
    root = null;
    rootMargin = '';
    thresholds = [0];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn().mockReturnValue([]);
  }
  globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
}

// jsdom 的 getComputedStyle 對部分 rc/antd 元件不完整，常見會回傳 auto/空字串導致 NaN 警告
const nativeGetComputedStyle = window.getComputedStyle?.bind(window);
window.getComputedStyle = ((elt: Element) => {
  const base = nativeGetComputedStyle ? nativeGetComputedStyle(elt) : ({} as CSSStyleDeclaration);

  const fallback = {
    display: 'block',
    visibility: 'visible',
    overflow: 'auto',
    paddingLeft: '0px',
    paddingRight: '0px',
    paddingTop: '0px',
    paddingBottom: '0px',
    borderLeftWidth: '0px',
    borderRightWidth: '0px',
    borderTopWidth: '0px',
    borderBottomWidth: '0px',
    marginLeft: '0px',
    marginRight: '0px',
    marginTop: '0px',
    marginBottom: '0px',
    lineHeight: '16px',
    fontSize: '14px',
    height: '0px',
    width: '0px',
    boxSizing: 'border-box',
  } as const;

  const read = (key: keyof typeof fallback): string => {
    const value = (base as unknown as Record<string, unknown>)[key];
    if (typeof value === 'string' && value && value !== 'auto') return value;
    return fallback[key];
  };

  const getPropertyValue = (name: string): string => {
    const raw = base.getPropertyValue?.call(base, name) ?? '';
    if (raw && raw !== 'auto') return raw;
    if (name === 'height' || name === 'width') return '0px';
    if (name === 'line-height') return fallback.lineHeight;
    if (name === 'font-size') return fallback.fontSize;
    if (name === 'box-sizing') return fallback.boxSizing;
    if (name === 'padding-top') return fallback.paddingTop;
    if (name === 'padding-bottom') return fallback.paddingBottom;
    if (name === 'padding-left') return fallback.paddingLeft;
    if (name === 'padding-right') return fallback.paddingRight;
    if (name === 'border-top-width') return fallback.borderTopWidth;
    if (name === 'border-bottom-width') return fallback.borderBottomWidth;
    if (name === 'border-left-width') return fallback.borderLeftWidth;
    if (name === 'border-right-width') return fallback.borderRightWidth;
    if (name === 'margin-top') return fallback.marginTop;
    if (name === 'margin-bottom') return fallback.marginBottom;
    if (name === 'margin-left') return fallback.marginLeft;
    if (name === 'margin-right') return fallback.marginRight;
    return '';
  };

  return {
    ...fallback,
    display: read('display'),
    visibility: read('visibility'),
    overflow: read('overflow'),
    paddingLeft: read('paddingLeft'),
    paddingRight: read('paddingRight'),
    paddingTop: read('paddingTop'),
    paddingBottom: read('paddingBottom'),
    borderLeftWidth: read('borderLeftWidth'),
    borderRightWidth: read('borderRightWidth'),
    borderTopWidth: read('borderTopWidth'),
    borderBottomWidth: read('borderBottomWidth'),
    marginLeft: read('marginLeft'),
    marginRight: read('marginRight'),
    marginTop: read('marginTop'),
    marginBottom: read('marginBottom'),
    lineHeight: read('lineHeight'),
    fontSize: read('fontSize'),
    height: read('height'),
    width: read('width'),
    boxSizing: read('boxSizing'),
    getPropertyValue,
  } as unknown as CSSStyleDeclaration;
}) as typeof window.getComputedStyle;

// 防止下載用 a.click 觸發 jsdom navigation not implemented
if (typeof HTMLAnchorElement !== 'undefined') {
  // eslint-disable-next-line no-extend-native
  HTMLAnchorElement.prototype.click = vi.fn();
}

// 若仍有元件在 jsdom 下輸出 layout 類 warning，應優先補齊 mock（避免全域吞錯）

// React/antd 在 jsdom 測試環境下常出現「not wrapped in act」警告（多數來自第三方元件的非同步動畫/Portal 更新），
// 會大量污染 CI 輸出、且不影響實際測試斷言。本專案選擇僅過濾該類固定格式警告，其它 console.error 仍照常輸出。
const _consoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === 'string' && first.includes('not wrapped in act')) return;
  _consoleError(...args);
};
