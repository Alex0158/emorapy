/**
 * 無障礙工具函數單元測試
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAriaLabel,
  setAriaDescription,
  setAriaState,
  handleKeyboardNavigation,
  focusElement,
  trapFocus,
} from './accessibility';

describe('accessibility', () => {
  describe('setAriaLabel', () => {
    it('應設置 aria-label 屬性', () => {
      const el = document.createElement('button');
      setAriaLabel(el, '關閉');
      expect(el.getAttribute('aria-label')).toBe('關閉');
    });
  });

  describe('setAriaDescription', () => {
    it('應設置 aria-describedby 屬性', () => {
      const el = document.createElement('input');
      setAriaDescription(el, 'hint-id');
      expect(el.getAttribute('aria-describedby')).toBe('hint-id');
    });
  });

  describe('setAriaState', () => {
    it('應設置 aria-busy 為 true', () => {
      const el = document.createElement('div');
      setAriaState(el, 'busy', true);
      expect(el.getAttribute('aria-busy')).toBe('true');
    });
    it('應設置 aria-expanded 為 false', () => {
      const el = document.createElement('div');
      setAriaState(el, 'expanded', false);
      expect(el.getAttribute('aria-expanded')).toBe('false');
    });
    it('應支持字串值', () => {
      const el = document.createElement('div');
      setAriaState(el, 'invalid', 'true');
      expect(el.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('handleKeyboardNavigation', () => {
    it('Enter 應觸發 onEnter', () => {
      const onEnter = vi.fn();
      const e = { key: 'Enter', preventDefault: vi.fn() } as React.KeyboardEvent<HTMLElement>;
      handleKeyboardNavigation(e, onEnter);
      expect(onEnter).toHaveBeenCalledTimes(1);
    });
    it('Escape 應觸發 onEscape', () => {
      const onEscape = vi.fn();
      const e = { key: 'Escape' } as React.KeyboardEvent<HTMLElement>;
      handleKeyboardNavigation(e, undefined, onEscape);
      expect(onEscape).toHaveBeenCalledTimes(1);
    });
    it('ArrowUp 應觸發 onArrowUp', () => {
      const onArrowUp = vi.fn();
      const e = { key: 'ArrowUp' } as React.KeyboardEvent<HTMLElement>;
      handleKeyboardNavigation(e, undefined, undefined, onArrowUp);
      expect(onArrowUp).toHaveBeenCalledTimes(1);
    });
    it('ArrowDown 應觸發 onArrowDown', () => {
      const onArrowDown = vi.fn();
      const e = { key: 'ArrowDown' } as React.KeyboardEvent<HTMLElement>;
      handleKeyboardNavigation(e, undefined, undefined, undefined, onArrowDown);
      expect(onArrowDown).toHaveBeenCalledTimes(1);
    });
    it('其他按鍵不應觸發回調', () => {
      const onEnter = vi.fn();
      const e = { key: 'Tab' } as React.KeyboardEvent<HTMLElement>;
      handleKeyboardNavigation(e, onEnter);
      expect(onEnter).not.toHaveBeenCalled();
    });
  });

  describe('focusElement', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });
    it('選擇器存在時應 focus 該元素', () => {
      const btn = document.createElement('button');
      btn.id = 'test-btn';
      document.body.appendChild(btn);
      const spy = vi.spyOn(btn, 'focus');
      focusElement('#test-btn');
      expect(spy).toHaveBeenCalled();
    });
    it('選擇器不存在時不應拋錯', () => {
      expect(() => focusElement('#nonexistent')).not.toThrow();
    });
  });

  describe('trapFocus', () => {
    it('應註冊 keydown 並返回清理函數', () => {
      const container = document.createElement('div');
      const btn = document.createElement('button');
      container.appendChild(btn);
      document.body.appendChild(container);
      const cleanup = trapFocus(container);
      expect(typeof cleanup).toBe('function');
      cleanup();
      document.body.removeChild(container);
    });
    it('無可聚焦元素時調用不應拋錯', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = trapFocus(container);
      expect(typeof cleanup).toBe('function');
      cleanup();
      document.body.removeChild(container);
    });
  });
});
