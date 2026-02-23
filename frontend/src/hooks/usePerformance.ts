/**
 * 性能優化Hook
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * 防抖Hook
 */
export const useDebounce = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debouncedCallback = useCallback(
    // eslint-disable-next-line react-hooks/use-memo -- 需 cast 為 T 以保持簽名一致
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);

  return debouncedCallback;
};

/**
 * 節流Hook
 */
export const useThrottle = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T => {
  const lastRunRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const throttledCallback = useCallback(
    // eslint-disable-next-line react-hooks/use-memo -- 需 cast 為 T 以保持簽名一致
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRunRef.current >= delay) {
        callbackRef.current(...args);
        lastRunRef.current = now;
      }
    }) as T,
    [delay]
  );

  return throttledCallback;
};

/**
 * 懶加載Hook（用於圖片等資源）
 */
export const useLazyLoad = (options: IntersectionObserverInit = {}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const elementRef = useRef<HTMLElement>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoaded(true);
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.1,
        ...optionsRef.current,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref: elementRef, isLoaded };
};

/**
 * 虛擬列表Hook（用於長列表優化）
 */
export const useVirtualList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRunRef = useRef<number>(0);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastRunRef.current >= 16) {
      setScrollTop(e.currentTarget.scrollTop);
      lastRunRef.current = now;
    }
  }, []);

  return {
    containerRef,
    visibleItems,
    offsetY,
    totalHeight,
    handleScroll,
  };
};

