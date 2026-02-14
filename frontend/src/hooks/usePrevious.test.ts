/**
 * usePrevious Hook 單元測試
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePrevious } from './usePrevious';

describe('usePrevious', () => {
  it('首次渲染應返回 undefined', () => {
    const { result } = renderHook(() => usePrevious(100));
    expect(result.current).toBeUndefined();
  });

  it('第二次渲染應返回上一次的 value', () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: 1 },
    });
    expect(result.current).toBeUndefined();
    rerender({ value: 2 });
    expect(result.current).toBe(1);
    rerender({ value: 3 });
    expect(result.current).toBe(2);
  });

  it('支援任意類型', () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: 'a' as string },
    });
    rerender({ value: 'b' });
    expect(result.current).toBe('a');
    rerender({ value: { id: 1 } });
    expect(result.current).toBe('b');
  });

  it('value 未變時仍返回上一次的值', () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: 10 },
    });
    rerender({ value: 20 });
    expect(result.current).toBe(10);
    rerender({ value: 20 });
    expect(result.current).toBe(20);
  });
});
