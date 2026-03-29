/**
 * 文件上傳組件（增強版）
 */

import { Upload, message, Progress, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { useState, useCallback } from 'react';
import ConfirmModal from '@/components/common/ConfirmModal';
import {
  MAX_FILE_SIZE,
  MAX_IMAGE_COUNT,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
} from '@/utils/constants';
import { formatFileSize } from '@/utils/format';
import { uploadEvidence, deleteEvidence, getCase } from '@/services/api/case';
import { t } from '@/utils/i18n';
import './FileUpload.less';

const { Text } = Typography;

const FILE_UPLOAD_ERROR_CODE_MAP: Record<string, string> = {
  NETWORK_ERROR: 'common.networkError',
  UNAUTHORIZED: 'common.unauthorized',
  FORBIDDEN: 'common.forbidden',
  NOT_FOUND: 'common.notFound',
  FILE_TOO_LARGE: 'common.fileTooLarge',
  RATE_LIMIT_EXCEEDED: 'common.fileRateLimit',
};

const getLocalizedUploadError = (error: unknown, fallbackKey: string) => {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : undefined;

  if (code && FILE_UPLOAD_ERROR_CODE_MAP[code]) {
    return t(FILE_UPLOAD_ERROR_CODE_MAP[code]);
  }

  return t(fallbackKey);
};

interface FileUploadProps {
  value?: UploadFile[];
  onChange?: (fileList: UploadFile[]) => void;
  maxCount?: number;
  accept?: string;
  disabled?: boolean;
  caseId?: string; // 案件ID，如果提供則實際上傳文件
  sessionId?: string; // Session ID（快速體驗模式）
  onUploadComplete?: (evidences: Array<{ id: string; file_url: string; file_type: string }>) => void; // 上傳完成回調
  confirmBeforeRemove?: boolean; // 刪除證據前是否二次確認，默認 true（caseId 時）
}

const FileUpload = ({
  value = [],
  onChange,
  maxCount = MAX_IMAGE_COUNT,
  accept = 'image/*,video/*',
  disabled = false,
  caseId,
  sessionId,
  onUploadComplete,
  confirmBeforeRemove = !!caseId,
}: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [pendingRemoveFile, setPendingRemoveFile] = useState<UploadFile | null>(null);

  // 簽名 URL 過期時重新獲取
  const refreshEvidenceUrls = useCallback(async (): Promise<UploadFile[] | null> => {
    if (!caseId) return null;
    try {
      const caseData = await getCase(caseId);
      const evidences = caseData.evidences;
      if (!Array.isArray(evidences) || evidences.length === 0) {
        return null;
      }
      const urlMap = new Map<string, string>();
      evidences.forEach((e: { id?: string; file_url?: string }) => {
        if (e?.id && e?.file_url) {
          urlMap.set(e.id, e.file_url);
        }
      });

      type ItemWithResponse = { response?: { id?: string }; uid: string };
      const updated = value.map((item) => {
        const evidenceId = (item as ItemWithResponse)?.response?.id || item.uid;
        const newUrl = urlMap.get(evidenceId);
        return newUrl ? { ...item, url: newUrl } : item;
      });
      onChange?.(updated);
      return updated;
    } catch {
      message.warning(t('fileUpload.linkExpiredRefresh'));
      return null;
    }
  }, [caseId, value, onChange]);

  // 實際上傳文件
  const handleActualUpload = useCallback(
    async (files: File[]) => {
      if (!caseId) {
        return;
      }

      try {
        setUploading(true);
        const evidences = await uploadEvidence(caseId, files, sessionId);
        
        const newFileList: UploadFile[] = files.reduce<UploadFile[]>((acc, file, index) => {
          const evidence = evidences[index];
          if (!evidence) return acc;
          acc.push({
            uid: evidence.id || file.name + Date.now(),
            name: file.name,
            status: 'done',
            url: evidence.file_url,
            response: evidence,
          } as UploadFile);
          return acc;
        }, []);

        const updatedFileList = [...value, ...newFileList];
        onChange?.(updatedFileList);
        onUploadComplete?.(evidences);
        const successCount = newFileList.length;
        message.success(t('fileUpload.uploadSuccessCount').replace('{count}', String(successCount)));
      } catch (error: unknown) {
        const msg = getLocalizedUploadError(error, 'fileUpload.uploadFail');
        message.error(msg);
        throw error;
      } finally {
        setUploading(false);
      }
    },
    [caseId, sessionId, value, onChange, onUploadComplete]
  );

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    // 檢查文件類型
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      message.error(t('fileUpload.formatNotAllowed'));
      return Upload.LIST_IGNORE;
    }

    if (file.size === 0) {
      message.error(t('fileUpload.emptyFile'));
      return Upload.LIST_IGNORE;
    }

    if (file.size > MAX_FILE_SIZE) {
      message.error(t('fileUpload.sizeLimit').replace('{size}', formatFileSize(MAX_FILE_SIZE)));
      return Upload.LIST_IGNORE;
    }

    // 檢查文件數量
    if (value.length >= maxCount) {
      message.error(t('fileUpload.countLimit').replace('{count}', String(maxCount)));
      return Upload.LIST_IGNORE;
    }

    // 如果有caseId，則實際上傳；否則只做本地預覽
    if (caseId) {
      // 實際上傳模式：阻止自動上傳，稍後統一處理
      return false;
    } else {
      // 本地預覽模式：阻止自動上傳
      return false;
    }
  };

  const handleChange: UploadProps['onChange'] = async (info) => {
    const { fileList, file } = info;

    // 如果是新文件且狀態為uploading，開始上傳
    if (file.status === 'uploading' && file.originFileObj && caseId) {
      try {
        setUploadProgress((prev) => ({
          ...prev,
          [file.uid]: 50, // 開始上傳
        }));

        // 實際上傳文件
        await handleActualUpload([file.originFileObj]);

        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[file.uid];
          return newProgress;
        });
      } catch {
        // 上傳失敗，從列表中移除
        const newFileList = fileList.filter((item) => item.uid !== file.uid);
        onChange?.(newFileList);
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[file.uid];
          return newProgress;
        });
        return;
      }
    }

    // 本地預覽模式：只更新文件列表
    if (!caseId) {
      // 為本地文件創建預覽URL
      const updatedFileList = fileList.map((item) => {
        if (item.originFileObj && !item.url && !item.preview) {
          const url = URL.createObjectURL(item.originFileObj);
          return {
            ...item,
            url,
            preview: url,
          };
        }
        return item;
      });
      onChange?.(updatedFileList);
      return;
    }

    // 實際上傳模式：更新文件列表
    onChange?.(fileList);
  };

  const performRemove = useCallback(
    async (file: UploadFile) => {
      if (caseId) {
        type FileWithResponse = { response?: { id?: string }; uid: string };
        const evidenceId = (file as FileWithResponse)?.response?.id || file.uid;
        if (evidenceId) {
          try {
            await deleteEvidence(caseId, evidenceId, sessionId);
          } catch (err: unknown) {
            const msg = getLocalizedUploadError(err, 'fileUpload.deleteEvidenceFail');
            message.error(msg);
            return false;
          }
        }
      }
      const newFileList = value.filter((item) => item.uid !== file.uid);
      onChange?.(newFileList);
      return true;
    },
    [caseId, sessionId, value, onChange]
  );

  const handleRemove = (file: UploadFile) => {
    if (confirmBeforeRemove && caseId) {
      setPendingRemoveFile(file);
      return false;
    }
    void performRemove(file);
    return false; // 由 performRemove 透過 onChange 更新列表
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoveFile) return;
    const file = pendingRemoveFile;
    setPendingRemoveFile(null);
    await performRemove(file);
  };

  const handlePreview = async (file: UploadFile) => {
    const targetUrl = file.url || file.preview;
    if (!targetUrl) return;

    const probe = async (url: string) => {
      try {
        const resp = await fetch(url, { method: 'HEAD' });
        return resp.ok;
      } catch {
        return false;
      }
    };

    const valid = await probe(targetUrl);
    if (valid) {
      window.open(targetUrl, '_blank');
      return;
    }

    // 簽名失效時嘗試重新換簽
    const refreshedList = await refreshEvidenceUrls();
    type ItemWithResponse = { response?: { id?: string }; uid: string };
    const refreshedUrl = refreshedList?.find(
      (item) =>
        ((item as ItemWithResponse)?.response?.id || item.uid) === ((file as ItemWithResponse)?.response?.id || file.uid)
    )?.url;
    if (refreshedUrl && refreshedUrl !== targetUrl) {
      window.open(refreshedUrl, '_blank');
      return;
    }

    message.error(t('fileUpload.linkInvalid'));
  };

  return (
    <div className="file-upload-wrapper">
      <Upload
        fileList={value}
        beforeUpload={beforeUpload}
        onChange={handleChange}
        onRemove={handleRemove}
        onPreview={handlePreview}
        accept={accept}
        disabled={disabled}
        listType="picture-card"
        maxCount={maxCount}
        className="evidence-upload"
      >
        {value.length < maxCount && (
          <div className="upload-button">
            <UploadOutlined />
            <div style={{ marginTop: 8 }}>{t('fileUpload.uploadBtn')}</div>
          </div>
        )}
      </Upload>

      {uploading && Object.keys(uploadProgress).length > 0 && (
        <div className="upload-progress">
          {Object.entries(uploadProgress).map(([uid, percent]) => (
            <div key={uid} className="progress-item">
              <Progress percent={percent} size="small" />
            </div>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div className="file-list-info">
          <Text type="secondary">
            {t('fileUpload.uploadedCount').replace('{current}', String(value.length)).replace('{max}', String(maxCount))}
          </Text>
        </div>
      )}

      <ConfirmModal
        open={!!pendingRemoveFile}
        onCancel={() => setPendingRemoveFile(null)}
        onConfirm={handleConfirmRemove}
        title={t('fileUpload.confirmRemoveTitle')}
        type="danger"
        confirmText={t('common.confirm')}
      >
        {t('fileUpload.confirmRemoveDesc')}
      </ConfirmModal>
    </div>
  );
};

export default FileUpload;
