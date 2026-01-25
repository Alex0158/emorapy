/**
 * 可訪問性Hook
 */

import { useEffect, useRef } from 'react';

/**
 * 鍵盤導航Hook
 */
export const useKeyboardNavigation = (
  onEnter?: () => void,
  onEscape?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void,
  enabled = true
) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;

    switch (e.key) {
      case 'Enter':
        onEnter?.();
        break;
      case 'Escape':
        onEscape?.();
        break;
      case 'ArrowUp':
        onArrowUp?.();
        e.preventDefault();
        break;
      case 'ArrowDown':
        onArrowDown?.();
        e.preventDefault();
        break;
    }
  };

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [enabled, onEnter, onEscape, onArrowUp, onArrowDown]);
};

/**
 * 焦點管理Hook
 */
export const useFocusManagement = (autoFocus = false) => {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (autoFocus && elementRef.current) {
      elementRef.current.focus();
    }
  }, [autoFocus]);

  return elementRef;
};

/**
 * 焦點陷阱Hook（用於Modal等）
 */
export const useFocusTrap = (enabled = true) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);
    firstElement.focus();

    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }, [enabled]);

  return containerRef;
};

/**
 * 跳過鏈接Hook（用於可訪問性）
 */
export const useSkipLink = (targetId: string, label = '跳過到主要內容') => {
  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return { handleSkip, label };
};

