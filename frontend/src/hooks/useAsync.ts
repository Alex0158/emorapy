/**
 * 異步操作Hook
 */

import { useState, useCallback, useEffect } from 'react';

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

  const execute = useCallback(async () => {
    setStatus('pending');
    setValue(null);
    setError(null);

    try {
      const response = await asyncFunction();
      setValue(response);
      setStatus('success');
      return response;
    } catch (err) {
      setError(err as E);
      setStatus('error');
      throw err;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return { execute, status, value, error };
};

