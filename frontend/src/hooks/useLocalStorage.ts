/**
 * LocalStorage Hook
 */

import { useState } from 'react';
import { logger } from '@/utils/logger';

export const useLocalStorage = <T>(key: string, initialValue: T) => {
  // 從localStorage讀取初始值
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logger.error(`Error reading localStorage key "${key}"`, error);
      return initialValue;
    }
  });

  // 返回一個包裝過的useState setter函數，它會持久化新值到localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // 允許值是一個函數，這樣我們有與useState相同的API
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      logger.error(`Error setting localStorage key "${key}"`, error);
    }
  };

  return [storedValue, setValue] as const;
};

