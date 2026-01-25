/**
 * 文件上傳Hook
 */

import { useState, useCallback } from 'react';
import { message } from 'antd';
import { validateFiles, getFilePreviewUrl } from '@/utils/fileValidation';

export interface FileUploadItem {
  file: File;
  preview?: string;
  uploading: boolean;
  error?: string;
}

/**
 * 使用文件上傳
 */
export function useFileUpload(maxCount: number = 3) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  /**
   * 添加文件
   */
  const addFiles = useCallback(
    async (newFiles: File[]) => {
      // 驗證文件
      const validation = validateFiles(newFiles, files.length);
      if (!validation.valid) {
        message.error(validation.error);
        return;
      }

      // 檢查總數限制
      if (files.length + newFiles.length > maxCount) {
        message.error(`最多只能上傳${maxCount}個文件`);
        return;
      }

      // 生成預覽
      const newItems: FileUploadItem[] = await Promise.all(
        newFiles.map(async (file) => {
          const preview = file.type.startsWith('image/') ? await getFilePreviewUrl(file) : undefined;
          return {
            file,
            preview,
            uploading: false,
          };
        })
      );

      setFiles((prev) => [...prev, ...newItems]);
    },
    [files, maxCount]
  );

  /**
   * 移除文件
   */
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * 清空文件
   */
  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  /**
   * 設置文件上傳狀態
   */
  const setFileUploading = useCallback((index: number, uploading: boolean, error?: string) => {
    setFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, uploading, error } : item))
    );
  }, []);

  return {
    files,
    uploading,
    addFiles,
    removeFile,
    clearFiles,
    setFileUploading,
    setUploading,
  };
}

