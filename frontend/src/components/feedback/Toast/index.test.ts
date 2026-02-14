/**
 * Toast 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from './index';

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();
const mockWarning = vi.fn();
const mockLoading = vi.fn();
const mockOpen = vi.fn();
const mockDestroy = vi.fn();

vi.mock('antd', () => ({
  message: {
    success: (...args: unknown[]) => mockSuccess(...args),
    error: (...args: unknown[]) => mockError(...args),
    info: (...args: unknown[]) => mockInfo(...args),
    warning: (...args: unknown[]) => mockWarning(...args),
    loading: (...args: unknown[]) => mockLoading(...args),
    open: (...args: unknown[]) => mockOpen(...args),
    destroy: (...args: unknown[]) => mockDestroy(...args),
  },
}));

describe('toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toast.success 應調用 message.success', () => {
    toast.success('成功');
    expect(mockSuccess).toHaveBeenCalledWith('成功', undefined);
  });

  it('toast.error 應調用 message.error', () => {
    toast.error('錯誤');
    expect(mockError).toHaveBeenCalledWith('錯誤', undefined);
  });

  it('toast.info 應調用 message.info', () => {
    toast.info('提示');
    expect(mockInfo).toHaveBeenCalledWith('提示', undefined);
  });

  it('toast.warning 應調用 message.warning', () => {
    toast.warning('警告');
    expect(mockWarning).toHaveBeenCalledWith('警告', undefined);
  });

  it('toast.loading 應調用 message.loading', () => {
    toast.loading('加載中');
    expect(mockLoading).toHaveBeenCalledWith('加載中', undefined);
  });

  it('toast.destroy 應調用 message.destroy', () => {
    toast.destroy('key');
    expect(mockDestroy).toHaveBeenCalledWith('key');
  });
});
