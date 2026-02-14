/**
 * useAccessibility Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  useKeyboardNavigation,
  useFocusManagement,
  useFocusTrap,
  useSkipLink,
} from './useAccessibility';

describe('useAccessibility', () => {
  describe('useKeyboardNavigation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('enabled=false 時不應註冊 keydown', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const onEnter = vi.fn();
      renderHook(() => useKeyboardNavigation(onEnter, undefined, undefined, undefined, false));
      expect(addSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('enabled=true 時應註冊 keydown 並在 unmount 時移除', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const onEnter = vi.fn();
      const { unmount } = renderHook(() =>
        useKeyboardNavigation(onEnter, undefined, undefined, undefined, true)
      );
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('useFocusManagement', () => {
    it('應返回 ref', () => {
      const { result } = renderHook(() => useFocusManagement(false));
      expect(result.current).toHaveProperty('current');
    });
  });

  describe('useFocusTrap', () => {
    it('enabled=false 時不應註冊 keydown', () => {
      const { result } = renderHook(() => useFocusTrap(false));
      expect(result.current).toHaveProperty('current');
    });
  });

  describe('useSkipLink', () => {
    it('應返回 handleSkip 與 label', () => {
      const { result } = renderHook(() => useSkipLink('main'));
      expect(result.current.label).toBe('跳過到主要內容');
      expect(typeof result.current.handleSkip).toBe('function');
    });

    it('自定義 label 應生效', () => {
      const { result } = renderHook(() => useSkipLink('main', 'Skip to content'));
      expect(result.current.label).toBe('Skip to content');
    });

    it('handleSkip 應 focus 目標元素並 scrollIntoView', () => {
      const target = document.createElement('div');
      target.id = 'main';
      target.tabIndex = 0;
      const scrollSpy = vi.spyOn(target, 'scrollIntoView');
      document.body.appendChild(target);
      const { result } = renderHook(() => useSkipLink('main'));
      const e = { preventDefault: vi.fn() } as unknown as React.MouseEvent<HTMLAnchorElement>;
      act(() => {
        result.current.handleSkip(e);
      });
      expect(e.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(target);
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      document.body.removeChild(target);
      scrollSpy.mockRestore();
    });
  });
});
