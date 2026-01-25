/**
 * 獲取前一個值的Hook
 */

import { useRef, useEffect } from 'react';

export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
};

