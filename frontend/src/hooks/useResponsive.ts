/**
 * 響應式設計Hooks
 */

import { useMediaQuery } from './useMediaQuery';
import { BREAKPOINTS } from '@/utils/constants';

/**
 * 使用響應式斷點
 */
export function useResponsive() {
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.mobile}px)`);
  const isTablet = useMediaQuery(
    `(min-width: ${BREAKPOINTS.mobile + 1}px) and (max-width: ${BREAKPOINTS.tablet}px)`
  );
  const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINTS.desktop}px)`);

  return {
    isMobile,
    isTablet,
    isDesktop,
    isMobileOrTablet: isMobile || isTablet,
  };
}

