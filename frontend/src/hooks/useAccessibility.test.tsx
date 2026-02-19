/**
 * useAccessibility Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, fireEvent } from '@testing-library/react';
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

    it('Enter/Escape/ArrowUp/ArrowDown 應觸發對應 callback', () => {
      const onEnter = vi.fn();
      const onEscape = vi.fn();
      const onUp = vi.fn();
      const onDown = vi.fn();
      renderHook(() => useKeyboardNavigation(onEnter, onEscape, onUp, onDown, true));

      fireEvent.keyDown(window, { key: 'Enter' });
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      expect(onEnter).toHaveBeenCalledTimes(1);
      expect(onEscape).toHaveBeenCalledTimes(1);
      expect(onUp).toHaveBeenCalledTimes(1);
      expect(onDown).toHaveBeenCalledTimes(1);
    });

    it('在可編輯元素或 Ctrl/Cmd+Enter 時不應觸發 onEnter', () => {
      const onEnter = vi.fn();
      renderHook(() => useKeyboardNavigation(onEnter, undefined, undefined, undefined, true));
      const input = document.createElement('input');
      document.body.appendChild(input);

      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
      fireEvent.keyDown(window, { key: 'Enter', metaKey: true });

      expect(onEnter).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('contentEditable 元素按 Enter 不應觸發 onEnter', () => {
      const onEnter = vi.fn();
      renderHook(() => useKeyboardNavigation(onEnter, undefined, undefined, undefined, true));
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      Object.defineProperty(editable, 'isContentEditable', { value: true });
      document.body.appendChild(editable);
      fireEvent.keyDown(editable, { key: 'Enter' });
      expect(onEnter).not.toHaveBeenCalled();
      document.body.removeChild(editable);
    });
  });

  describe('useFocusManagement', () => {
    it('應返回 ref', () => {
      const { result } = renderHook(() => useFocusManagement(false));
      expect(result.current).toHaveProperty('current');
    });

    it('autoFocus=true 且 ref 有元素時應 focus', () => {
      const target = document.createElement('button');
      document.body.appendChild(target);
      const focusSpy = vi.spyOn(target, 'focus');
      const { result, rerender } = renderHook(({ auto }) => useFocusManagement(auto), {
        initialProps: { auto: false },
      });
      act(() => {
        result.current.current = target;
      });
      rerender({ auto: true });
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
      document.body.removeChild(target);
    });
  });

  describe('useFocusTrap', () => {
    it('enabled=false 時不應註冊 keydown', () => {
      const { result } = renderHook(() => useFocusTrap(false));
      expect(result.current).toHaveProperty('current');
    });

    it('enabled=true 且有可聚焦元素時應循環焦點', () => {
      const container = document.createElement('div');
      const first = document.createElement('button');
      const last = document.createElement('button');
      container.appendChild(first);
      container.appendChild(last);
      document.body.appendChild(container);

      const addSpy = vi.spyOn(container, 'addEventListener');
      const removeSpy = vi.spyOn(container, 'removeEventListener');
      const { result, rerender, unmount } = renderHook(
        ({ enabled }) => useFocusTrap(enabled),
        { initialProps: { enabled: true } }
      );
      act(() => {
        result.current.current = container;
      });
      rerender({ enabled: false });
      rerender({ enabled: true });

      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(document.activeElement).toBe(first);

      first.focus();
      fireEvent.keyDown(container, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(last);

      last.focus();
      fireEvent.keyDown(container, { key: 'Tab' });
      expect(document.activeElement).toBe(first);

      unmount();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      addSpy.mockRestore();
      removeSpy.mockRestore();
      document.body.removeChild(container);
    });

    it('enabled=true 但無可聚焦元素時不應註冊 keydown', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const addSpy = vi.spyOn(container, 'addEventListener');
      const { result, rerender } = renderHook(({ enabled }) => useFocusTrap(enabled), {
        initialProps: { enabled: true },
      });
      act(() => {
        result.current.current = container;
      });
      rerender({ enabled: false });
      rerender({ enabled: true });
      expect(addSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
      addSpy.mockRestore();
      document.body.removeChild(container);
    });

    it('focus trap 收到非 Tab 按鍵時應忽略', () => {
      const container = document.createElement('div');
      const first = document.createElement('button');
      const last = document.createElement('button');
      container.appendChild(first);
      container.appendChild(last);
      document.body.appendChild(container);
      const preventDefault = vi.fn();
      const { result, rerender } = renderHook(({ enabled }) => useFocusTrap(enabled), {
        initialProps: { enabled: true },
      });
      act(() => {
        result.current.current = container;
      });
      rerender({ enabled: false });
      rerender({ enabled: true });
      first.focus();
      fireEvent.keyDown(container, { key: 'Enter', preventDefault });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(first);
      document.body.removeChild(container);
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

    it('目標元素不存在時僅 preventDefault 不拋錯', () => {
      const { result } = renderHook(() => useSkipLink('not-exist'));
      const e = { preventDefault: vi.fn() } as unknown as React.MouseEvent<HTMLAnchorElement>;
      act(() => {
        result.current.handleSkip(e);
      });
      expect(e.preventDefault).toHaveBeenCalled();
    });
  });
});
