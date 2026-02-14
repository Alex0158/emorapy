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

if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as unknown as typeof ResizeObserver;
}
