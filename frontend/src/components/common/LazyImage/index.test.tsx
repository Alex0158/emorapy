/**
 * LazyImage 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import LazyImage from './index';

let observeCallback: (entries: Array<{ isIntersecting: boolean }>) => void;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = vi.fn().mockImplementation(
    (callback: (entries: Array<{ isIntersecting: boolean }>) => void) => {
      observeCallback = callback;
      return {
        observe: mockObserve,
        disconnect: mockDisconnect,
      };
    }
  );
});

describe('LazyImage', () => {
  it('應渲染容器與 loading 狀態（未進入視口時）', () => {
    const { container } = render(<LazyImage src="https://example.com/img.jpg" alt="圖片" />);
    // Container uses cn() with 'relative overflow-hidden'
    expect(container.querySelector('.relative.overflow-hidden')).toBeInTheDocument();
    // Loading indicator should be present (Loader2 with animate-spin)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('有 placeholder 時應顯示 placeholder 圖片', () => {
    const { container } = render(
      <LazyImage
        src="https://example.com/img.jpg"
        alt="圖"
        placeholder="https://example.com/placeholder.jpg"
      />
    );
    const placeholderImg = container.querySelector('img');
    expect(placeholderImg).toBeInTheDocument();
    expect(placeholderImg?.getAttribute('src')).toBe('https://example.com/placeholder.jpg');
  });

  it('進入視口後應渲染 img 標籤', () => {
    const { container } = render(<LazyImage src="https://example.com/img.jpg" alt="圖" />);
    expect(observeCallback).toBeDefined();
    act(() => {
      observeCallback([{ isIntersecting: true }]);
    });
    const img = container.querySelector('img.transition-opacity');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('src')).toBe('https://example.com/img.jpg');
    expect(img?.getAttribute('alt')).toBe('圖');
  });

  it('應支援 className', () => {
    const { container } = render(
      <LazyImage src="https://example.com/img.jpg" alt="圖" className="custom" />
    );
    expect(container.querySelector('.relative.overflow-hidden.custom')).toBeInTheDocument();
  });
});
