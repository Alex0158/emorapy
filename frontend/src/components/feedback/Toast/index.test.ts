/**
 * Toast 組件單元測試
 *
 * Toast 組件現在直接 re-export sonner 的 toast，
 * 測試驗證匯出正確。
 */
import { describe, it, expect, vi } from 'vitest';

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

import { toast } from './index';

describe('toast', () => {
  it('應 re-export sonner 的 toast', () => {
    expect(toast).toBe(mockToast);
  });

  it('toast.success 應可調用', () => {
    toast.success('成功');
    expect(mockToast.success).toHaveBeenCalledWith('成功');
  });

  it('toast.error 應可調用', () => {
    toast.error('錯誤');
    expect(mockToast.error).toHaveBeenCalledWith('錯誤');
  });

  it('toast.info 應可調用', () => {
    toast.info('提示');
    expect(mockToast.info).toHaveBeenCalledWith('提示');
  });

  it('toast.warning 應可調用', () => {
    toast.warning('警告');
    expect(mockToast.warning).toHaveBeenCalledWith('警告');
  });

  it('toast.loading 應可調用', () => {
    toast.loading('加載中');
    expect(mockToast.loading).toHaveBeenCalledWith('加載中');
  });
});
