/**
 * 剪貼板工具單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from './copyToClipboard';

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('copyToClipboard', () => {
  const originalClipboard = global.navigator.clipboard;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global.navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
    });
    document.execCommand = originalExecCommand;
  });

  it('navigator.clipboard 可用時應寫入並顯示成功', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    });
    const result = await copyToClipboard('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(mockToastSuccess).toHaveBeenCalledWith('已複製到剪貼板');
    expect(result).toBe(true);
  });

  it('navigator.clipboard 拋錯時應顯示失敗並返回 false', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    });
    const result = await copyToClipboard('hello');
    expect(mockToastError).toHaveBeenCalledWith('複製失敗');
    expect(result).toBe(false);
  });

  it('無 clipboard 時降級 execCommand 成功應返回 true', async () => {
    Object.defineProperty(global.navigator, 'clipboard', {
      value: undefined,
      writable: true,
    });
    document.execCommand = vi.fn().mockReturnValue(true);
    const result = await copyToClipboard('fallback text');
    expect(mockToastSuccess).toHaveBeenCalledWith('已複製到剪貼板');
    expect(result).toBe(true);
  });

  it('無 clipboard 時 execCommand 失敗應顯示失敗並返回 false', async () => {
    Object.defineProperty(global.navigator, 'clipboard', {
      value: undefined,
      writable: true,
    });
    document.execCommand = vi.fn().mockReturnValue(false);
    const result = await copyToClipboard('fallback text');
    expect(mockToastError).toHaveBeenCalledWith('複製失敗');
    expect(result).toBe(false);
  });
});
