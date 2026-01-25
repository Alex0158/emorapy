/**
 * 無障礙工具函數
 */

/**
 * 設置ARIA標籤
 */
export const setAriaLabel = (element: HTMLElement, label: string): void => {
  element.setAttribute('aria-label', label);
};

/**
 * 設置ARIA描述
 */
export const setAriaDescription = (element: HTMLElement, description: string): void => {
  element.setAttribute('aria-describedby', description);
};

/**
 * 設置ARIA狀態
 */
export const setAriaState = (
  element: HTMLElement,
  state: 'busy' | 'checked' | 'disabled' | 'expanded' | 'hidden' | 'invalid' | 'selected',
  value: boolean | string
): void => {
  element.setAttribute(`aria-${state}`, String(value));
};

/**
 * 鍵盤導航支持
 */
export const handleKeyboardNavigation = (
  e: React.KeyboardEvent,
  onEnter?: () => void,
  onEscape?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void
): void => {
  switch (e.key) {
    case 'Enter':
      onEnter?.();
      break;
    case 'Escape':
      onEscape?.();
      break;
    case 'ArrowUp':
      onArrowUp?.();
      break;
    case 'ArrowDown':
      onArrowDown?.();
      break;
  }
};

/**
 * 焦點管理
 */
export const focusElement = (selector: string): void => {
  const element = document.querySelector(selector) as HTMLElement;
  if (element) {
    element.focus();
  }
};

/**
 * 陷阱焦點（用於Modal等）
 */
export const trapFocus = (container: HTMLElement): (() => void) => {
  const focusableElements = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

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
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleTab);
  };
};

