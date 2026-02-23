/**
 * 異步操作Hook
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseAsyncOptions {
  immediate?: boolean;
}

export const useAsync = <T, E = Error>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncOptions = {}
) => {
  const { immediate = false } = options;
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);

  const asyncFnRef = useRef(asyncFunction);
  asyncFnRef.current = asyncFunction;
  const cancelledRef = useRef(false);

  const execute = useCallback(async () => {
    cancelledRef.current = false;
    setStatus('pending');
    setValue(null);
    setError(null);

    try {
      const response = await asyncFnRef.current();
      if (cancelledRef.current) return response;
      setValue(response);
      setStatus('success');
      return response;
    } catch (err) {
      if (cancelledRef.current) throw err;
      setError(err as E);
      setStatus('error');
      throw err;
    }
  }, []);

  useEffect(() => {
    if (immediate) {
      cancelledRef.current = false;
      execute();
    }
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  return { execute, status, value, error };
};

