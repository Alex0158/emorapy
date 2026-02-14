/**
 * useFileUpload Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from './useFileUpload';

const mockValidateFiles = vi.fn();
const mockGetFilePreviewUrl = vi.fn();
const mockMessageError = vi.fn();

vi.mock('@/utils/fileValidation', () => ({
  validateFiles: (...args: unknown[]) => mockValidateFiles(...args),
  getFilePreviewUrl: (...args: unknown[]) => mockGetFilePreviewUrl(...args),
}));

vi.mock('antd', () => ({
  message: { error: (...args: unknown[]) => mockMessageError(...args) },
}));

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateFiles.mockReturnValue({ valid: true });
    mockGetFilePreviewUrl.mockResolvedValue('data:image/png;base64,xxx');
  });

  it('初始 files 應為空陣列', () => {
    const { result } = renderHook(() => useFileUpload(3));
    expect(result.current.files).toEqual([]);
    expect(result.current.uploading).toBe(false);
  });

  it('addFiles 驗證通過應添加文件', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useFileUpload(3));
    await act(async () => {
      await result.current.addFiles([file]);
    });
    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].file).toBe(file);
    expect(mockValidateFiles).toHaveBeenCalledWith([file], 0);
  });

  it('addFiles 驗證失敗應不添加並調用 message.error', async () => {
    mockValidateFiles.mockReturnValue({ valid: false, error: '不支持的文件類型' });
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    const { result } = renderHook(() => useFileUpload(3));
    await act(async () => {
      await result.current.addFiles([file]);
    });
    expect(result.current.files).toHaveLength(0);
    expect(mockMessageError).toHaveBeenCalledWith('不支持的文件類型');
  });

  it('removeFile 應移除指定索引的文件', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useFileUpload(3));
    await act(async () => {
      await result.current.addFiles([file]);
    });
    expect(result.current.files).toHaveLength(1);
    act(() => {
      result.current.removeFile(0);
    });
    expect(result.current.files).toHaveLength(0);
  });

  it('clearFiles 應清空所有文件', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useFileUpload(3));
    await act(async () => {
      await result.current.addFiles([file]);
    });
    act(() => {
      result.current.clearFiles();
    });
    expect(result.current.files).toHaveLength(0);
  });

  it('setFileUploading 應更新指定文件的 uploading 狀態', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useFileUpload(3));
    await act(async () => {
      await result.current.addFiles([file]);
    });
    act(() => {
      result.current.setFileUploading(0, true, '上傳失敗');
    });
    expect(result.current.files[0].uploading).toBe(true);
    expect(result.current.files[0].error).toBe('上傳失敗');
  });
});
