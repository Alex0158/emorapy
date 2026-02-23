import { useRef, useEffect } from 'react';

/**
 * 追蹤元件是否仍然掛載，用於在非同步操作完成後避免 setState on unmounted component
 */
export const useMountedRef = () => {
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);
  return mountedRef;
};
