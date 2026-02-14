/**
 * useToggle Hook 單元測試
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToggle } from './useToggle';

describe('useToggle', () => {
  it('初始值為 false 時應返回 [false, toggle, setToggle]', () => {
    const { result } = renderHook(() => useToggle(false));
    expect(result.current[0]).toBe(false);
    expect(typeof result.current[1]).toBe('function');
    expect(typeof result.current[2]).toBe('function');
  });

  it('初始值為 true 時應返回 [true, ...]', () => {
    const { result } = renderHook(() => useToggle(true));
    expect(result.current[0]).toBe(true);
  });

  it('toggle() 應切換布爾值', () => {
    const { result } = renderHook(() => useToggle(false));
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(false);
  });

  it('setToggle(true/false) 應設置值', () => {
    const { result } = renderHook(() => useToggle(false));
    act(() => {
      result.current[2](true);
    });
    expect(result.current[0]).toBe(true);
    act(() => {
      result.current[2](false);
    });
    expect(result.current[0]).toBe(false);
  });
});
