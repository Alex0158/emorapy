/**
 * 文件驗證工具單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import {
  validateFileType,
  validateFileSize,
  validateFileCount,
  validateFiles,
  getFilePreviewUrl,
} from './fileValidation';

// 與 constants 一致，避免依賴 env
vi.mock('./constants', () => ({
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  MAX_IMAGE_COUNT: 3,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  ALLOWED_VIDEO_TYPES: ['video/mp4'],
}));

describe('fileValidation', () => {
  describe('validateFileType', () => {
    it('image/jpeg 應通過', () => {
      const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      expect(validateFileType(file)).toEqual({ valid: true });
    });

    it('image/png、image/gif 應通過', () => {
      expect(validateFileType(new File(['x'], 'a.png', { type: 'image/png' }))).toEqual({
        valid: true,
      });
      expect(validateFileType(new File(['x'], 'a.gif', { type: 'image/gif' }))).toEqual({
        valid: true,
      });
    });

    it('video/mp4 應通過', () => {
      const file = new File(['x'], 'v.mp4', { type: 'video/mp4' });
      expect(validateFileType(file)).toEqual({ valid: true });
    });

    it('不支持類型應返回錯誤', () => {
      const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      const result = validateFileType(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('JPG');
    });
  });

  describe('validateFileSize', () => {
    it('小於 5MB 應通過', () => {
      const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 });
      expect(validateFileSize(file)).toEqual({ valid: true });
    });

    it('大於 5MB 應失敗', () => {
      const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 });
      const result = validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('5MB');
    });
  });

  describe('validateFileCount', () => {
    it('未超過 MAX_IMAGE_COUNT 應通過', () => {
      const files = [
        new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'b.jpg', { type: 'image/jpeg' }),
      ];
      expect(validateFileCount(files)).toEqual({ valid: true });
      expect(validateFileCount(files, 1)).toEqual({ valid: true });
    });

    it('超過 MAX_IMAGE_COUNT 應失敗', () => {
      const files = [
        new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'b.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'c.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'd.jpg', { type: 'image/jpeg' }),
      ];
      const result = validateFileCount(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('3');
    });
  });

  describe('validateFiles', () => {
    it('全部通過應返回 valid: true', () => {
      const files = [
        new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
      ];
      const file = files[0];
      Object.defineProperty(file, 'size', { value: 1024 });
      expect(validateFiles(files)).toEqual({ valid: true });
    });

    it('數量超限應先失敗', () => {
      const files = [
        new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'b.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'c.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'd.jpg', { type: 'image/jpeg' }),
      ];
      const result = validateFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('3');
    });

    it('類型不合法應失敗', () => {
      const files = [new File(['x'], 'a.pdf', { type: 'application/pdf' })];
      const result = validateFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('JPG');
    });
  });

  describe('getFilePreviewUrl', () => {
    it('應返回 Data URL', async () => {
      const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      const url = await getFilePreviewUrl(file);
      expect(url).toMatch(/^data:/);
    });
  });
});
