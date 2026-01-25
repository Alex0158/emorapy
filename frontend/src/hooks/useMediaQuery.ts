/**
 * 媒體查詢Hook
 */

import { useState, useEffect } from 'react';
import { BREAKPOINTS } from '@/utils/constants';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // 兼容性處理
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // 舊版瀏覽器
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
};

// 便捷Hook
export const useIsMobile = () => {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.mobile - 1}px)`);
};

export const useIsTablet = () => {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.tablet - 1}px)`
  );
};

export const useIsDesktop = () => {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.desktop}px)`);
};

