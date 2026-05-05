/**
 * 文件上傳組件
 *
 * 遷移: Ant Upload/Progress/Typography/message/Icons → 原生 file input + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（驗證、上傳、刪除、預覽、簽名URL刷新）
 * 保留: UploadFile 類型接口兼容（遷移期間保持向下兼容）
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, X, Eye, Loader2 } from 'lucide-react';
import type { UploadFile } from '@/types/upload';
import { Progress } from '@/components/ui/progress';
import ConfirmModal from '@/components/common/ConfirmModal';
import { cn } from '@/lib/utils';
import {
  MAX_FILE_SIZE,
  MAX_IMAGE_COUNT,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
} from '@/utils/constants';
import { formatFileSize } from '@/utils/format';
import { uploadEvidence, deleteEvidence, getCase } from '@/services/api/case';
import { t } from '@/utils/i18n';

const FILE_UPLOAD_ERROR_CODE_MAP: Record<string, string> = {
  NETWORK_ERROR: 'common.networkError',
  UNAUTHORIZED: 'common.unauthorized',
  FORBIDDEN: 'common.forbidden',
  NOT_FOUND: 'common.notFound',
  FILE_TOO_LARGE: 'common.fileTooLarge',
  RATE_LIMIT_EXCEEDED: 'common.fileRateLimit',
};

const getLocalizedUploadError = (error: unknown, fallbackKey: string) => {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : undefined;
  if (code && FILE_UPLOAD_ERROR_CODE_MAP[code]) return t(FILE_UPLOAD_ERROR_CODE_MAP[code]);
  return t(fallbackKey);
};

interface FileUploadProps {
  value?: UploadFile[];
  onChange?: (fileList: UploadFile[]) => void;
  maxCount?: number;
  accept?: string;
  disabled?: boolean;
  caseId?: string;
  sessionId?: string;
  onUploadComplete?: (evidences: Array<{ id: string; file_url: string; file_type: string }>) => void;
  confirmBeforeRemove?: boolean;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshEvidenceUrls = useCallback(async (): Promise<UploadFile[] | null> => {
    if (!caseId) return null;
    try {
      const caseData = await getCase(caseId);
      const evidences = caseData.evidences;
      if (!Array.isArray(evidences) || evidences.length === 0) return null;
      const urlMap = new Map<string, string>();
      evidences.forEach((e: { id?: string; file_url?: string }) => { if (e?.id && e?.file_url) urlMap.set(e.id, e.file_url); });
      type ItemWithResponse = { response?: { id?: string }; uid: string };
      const updated = value.map((item) => {
        const evidenceId = (item as ItemWithResponse)?.response?.id || item.uid;
        const newUrl = urlMap.get(evidenceId);
        return newUrl ? { ...item, url: newUrl } : item;
      });
      onChange?.(updated);
      return updated;
    } catch {
      toast.warning(t('fileUpload.linkExpiredRefresh'));
      return null;
    }
  }, [caseId, value, onChange]);

  const handleActualUpload = useCallback(async (files: File[]) => {
    if (!caseId) return;
    try {
      setUploading(true);
      const evidences = await uploadEvidence(caseId, files, sessionId);
      const newFileList: UploadFile[] = files.reduce<UploadFile[]>((acc, file, index) => {
        const evidence = evidences[index];
        if (!evidence) return acc;
        acc.push({ uid: evidence.id || file.name + Date.now(), name: file.name, status: 'done', url: evidence.file_url, response: evidence } as UploadFile);
        return acc;
      }, []);
      const updatedFileList = [...value, ...newFileList];
      onChange?.(updatedFileList);
      onUploadComplete?.(evidences);
      toast.success(t('fileUpload.uploadSuccessCount').replace('{count}', String(newFileList.length)));
    } catch (error: unknown) {
      toast.error(getLocalizedUploadError(error, 'fileUpload.uploadFail'));
      throw error;
    } finally { setUploading(false); }
  }, [caseId, sessionId, value, onChange, onUploadComplete]);

  const validateFile = (file: File): boolean => {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) { toast.error(t('fileUpload.formatNotAllowed')); return false; }
    if (file.size === 0) { toast.error(t('fileUpload.emptyFile')); return false; }
    if (file.size > MAX_FILE_SIZE) { toast.error(t('fileUpload.sizeLimit').replace('{size}', formatFileSize(MAX_FILE_SIZE))); return false; }
    if (value.length >= maxCount) { toast.error(t('fileUpload.countLimit').replace('{count}', String(maxCount))); return false; }
    return true;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter(validateFile);
    if (validFiles.length === 0) return;

    if (caseId) {
      setUploadProgress(Object.fromEntries(validFiles.map((f) => [f.name, 50])));
      try {
        await handleActualUpload(validFiles);
      } finally {
        setUploadProgress({});
      }
    } else {
      const newFiles: UploadFile[] = validFiles.map((file) => ({
        uid: `${file.name}-${Date.now()}-${Math.random()}`,
        name: file.name,
        status: 'done' as const,
        url: URL.createObjectURL(file),
        originFileObj: file as unknown as UploadFile['originFileObj'],
      } as UploadFile));
      onChange?.([...value, ...newFiles]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const performRemove = useCallback(async (file: UploadFile) => {
    if (caseId) {
      type FileWithResponse = { response?: { id?: string }; uid: string };
      const evidenceId = (file as FileWithResponse)?.response?.id || file.uid;
      if (evidenceId) {
        try { await deleteEvidence(caseId, evidenceId, sessionId); }
        catch (err: unknown) { toast.error(getLocalizedUploadError(err, 'fileUpload.deleteEvidenceFail')); return false; }
      }
    }
    onChange?.(value.filter((item) => item.uid !== file.uid));
    return true;
  }, [caseId, sessionId, value, onChange]);

  const handleRemove = (file: UploadFile) => {
    if (confirmBeforeRemove && caseId) { setPendingRemoveFile(file); return; }
    void performRemove(file);
  };

  const handlePreview = async (file: UploadFile) => {
    const targetUrl = file.url || (file as { preview?: string }).preview;
    if (!targetUrl) return;
    const probe = async (url: string) => { try { return (await fetch(url, { method: 'HEAD' })).ok; } catch { return false; } };
    if (await probe(targetUrl)) { window.open(targetUrl, '_blank'); return; }
    const refreshedList = await refreshEvidenceUrls();
    type ItemWithResponse = { response?: { id?: string }; uid: string };
    const refreshedUrl = refreshedList?.find((item) => ((item as ItemWithResponse)?.response?.id || item.uid) === ((file as ItemWithResponse)?.response?.id || file.uid))?.url;
    if (refreshedUrl && refreshedUrl !== targetUrl) { window.open(refreshedUrl, '_blank'); return; }
    toast.error(t('fileUpload.linkInvalid'));
  };

  return (
    <div className="space-y-3">
      {/* File Grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((file) => (
          <div key={file.uid} className="group relative aspect-square rounded-lg border border-border bg-muted/30 overflow-hidden">
            {file.url ? (
              <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{file.name}</div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => handlePreview(file)} className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/40">
                <Eye className="size-4" />
              </button>
              {!disabled && (
                <button type="button" onClick={() => handleRemove(file)} className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/40">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Upload Button */}
        {value.length < maxCount && !disabled && (
          <label className={cn(
            'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary/50 hover:bg-primary-light/20',
            uploading && 'pointer-events-none opacity-50',
          )}>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled || uploading}
            />
            {uploading ? <Loader2 className="size-6 animate-spin text-primary" /> : <Upload className="size-6 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">{t('fileUpload.uploadBtn')}</span>
          </label>
        )}
      </div>

      {/* Upload Progress */}
      {uploading && Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([uid, percent]) => (
            <Progress key={uid} value={percent} className="h-1.5" />
          ))}
        </div>
      )}

      {/* File Count */}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('fileUpload.uploadedCount').replace('{current}', String(value.length)).replace('{max}', String(maxCount))}
        </p>
      )}

      {/* Confirm Remove Modal */}
      <ConfirmModal
        open={!!pendingRemoveFile}
        onCancel={() => setPendingRemoveFile(null)}
        onConfirm={async () => { if (pendingRemoveFile) { setPendingRemoveFile(null); await performRemove(pendingRemoveFile); } }}
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
