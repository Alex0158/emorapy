/**
 * 文件上傳Hook
 */

import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import { validateFiles, getFilePreviewUrl } from '@/utils/fileValidation';
import { t } from '@/utils/i18n';

export interface FileUploadItem {
  file: File;
  preview?: string;
  uploading: boolean;
  error?: string;
}

export function useFileUpload(maxCount: number = 3) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const addingRef = useRef(false);

  const addFiles = useCallback(
    async (newFiles: File[]) => {
      if (addingRef.current) return;
      addingRef.current = true;
      try {
        const currentCount = files.length;
        const validation = validateFiles(newFiles, currentCount);
        if (!validation.valid) {
          message.error(validation.error);
          return;
        }

        if (currentCount + newFiles.length > maxCount) {
          message.error(t('fileUpload.countLimit').replace('{count}', String(maxCount)));
          return;
        }

        const newItems: FileUploadItem[] = await Promise.all(
          newFiles.map(async (file) => {
            const preview = file.type.startsWith('image/') ? await getFilePreviewUrl(file) : undefined;
            return { file, preview, uploading: false };
          })
        );

        setFiles((prev) => {
          if (prev.length + newItems.length > maxCount) return prev;
          return [...prev, ...newItems];
        });
      } finally {
        addingRef.current = false;
      }
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

