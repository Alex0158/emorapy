/**
 * 文件驗證工具
 */

import {
  MAX_FILE_SIZE,
  MAX_IMAGE_COUNT,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
} from './constants';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 驗證文件類型
 */
export function validateFileType(file: File): FileValidationResult {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: '不支持的文件類型，只支持JPG、PNG、GIF、MP4格式',
    };
  }

  return { valid: true };
}

/**
 * 驗證文件大小
 */
export function validateFileSize(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件大小不能超過${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * 驗證文件數量
 */
export function validateFileCount(files: File[], existingCount: number = 0): FileValidationResult {
  const totalCount = files.length + existingCount;

  if (totalCount > MAX_IMAGE_COUNT) {
    return {
      valid: false,
      error: `最多只能上傳${MAX_IMAGE_COUNT}張圖片`,
    };
  }

  return { valid: true };
}

/**
 * 綜合驗證文件
 */
export function validateFiles(
  files: File[],
  existingCount: number = 0
): FileValidationResult {
  // 驗證數量
  const countResult = validateFileCount(files, existingCount);
  if (!countResult.valid) {
    return countResult;
  }

  // 驗證每個文件
  for (const file of files) {
    const typeResult = validateFileType(file);
    if (!typeResult.valid) {
      return typeResult;
    }

    const sizeResult = validateFileSize(file);
    if (!sizeResult.valid) {
      return sizeResult;
    }
  }

  return { valid: true };
}

/**
 * 獲取文件預覽URL
 */
export function getFilePreviewUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('無法讀取文件'));
      }
    };
    reader.onerror = () => reject(new Error('文件讀取失敗'));
    reader.readAsDataURL(file);
  });
}

