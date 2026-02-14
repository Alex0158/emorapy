/**
 * useDebounce Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始渲染應返回傳入的 value', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('value 變更後在 delay 內應仍為舊值', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 300 } }
    );
    expect(result.current).toBe('first');
    rerender({ value: 'second', delay: 300 });
    expect(result.current).toBe('first');
  });

  it('delay 過後應更新為新 value', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 300 } }
    );
    rerender({ value: 'second', delay: 300 });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('second');
  });

  it('delay 變更時應使用新的 delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 100 } }
    );
    rerender({ value: 'b', delay: 200 });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('a');
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('b');
  });

  it('支援 number 類型', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    );
    expect(result.current).toBe(0);
    rerender({ value: 42, delay: 100 });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(42);
  });

  it('多次快速變更時只保留最後一次', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'v1', delay: 300 } }
    );
    rerender({ value: 'v2', delay: 300 });
    await act(async () => { vi.advanceTimersByTime(100); });
    rerender({ value: 'v3', delay: 300 });
    await act(async () => { vi.advanceTimersByTime(100); });
    rerender({ value: 'v4', delay: 300 });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('v4');
  });
});
