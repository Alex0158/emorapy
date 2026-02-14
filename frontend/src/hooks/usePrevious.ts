/**
 * 獲取前一個值的Hook
 */

import { useRef, useEffect } from 'react';

export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  // eslint-disable-next-line react-hooks/refs -- usePrevious 刻意回傳上一幀值，需讀取 ref.current
  return ref.current;
};

