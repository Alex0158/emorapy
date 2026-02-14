/**
 * useIntersectionObserver Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { render } from '@testing-library/react';
import { useIntersectionObserver } from './useIntersectionObserver';

describe('useIntersectionObserver', () => {
  let mockObserve: ReturnType<typeof vi.fn>;
  let mockUnobserve: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

  beforeEach(() => {
    mockObserve = vi.fn();
    mockUnobserve = vi.fn();
    disconnect = vi.fn();
    // mock 不需使用 callback 參數
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = vi.fn().mockImplementation((cb: ObserverCallback) => {
      void cb;
      return {
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect,
      };
    });
  });

  it('應返回 ref 與 isIntersecting', () => {
    const { result } = renderHook(() => useIntersectionObserver({}));
    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toHaveProperty('current');
    expect(typeof result.current[1]).toBe('boolean');
    expect(result.current[1]).toBe(false);
  });

  it('ref 未掛載時不應調用 observe', () => {
    renderHook(() => useIntersectionObserver({}));
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('ref 掛載後應調用 observe', () => {
    const Comp = () => {
      const [ref] = useIntersectionObserver({});
      return <div ref={ref} data-testid="target">target</div>;
    };
    render(<Comp />);
    expect(mockObserve).toHaveBeenCalled();
  });

  it('應傳入 threshold、root、rootMargin 給 IntersectionObserver', () => {
    const root = document.createElement('div');
    const Comp = () => {
      const [ref] = useIntersectionObserver({ threshold: 0.5, root, rootMargin: '10px' });
      return <div ref={ref}>target</div>;
    };
    render(<Comp />);
    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5, root, rootMargin: '10px' })
    );
  });
});
