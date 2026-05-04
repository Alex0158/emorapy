import { AlertCircle, CloudUpload, Upload, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MAX_IMAGE_COUNT } from '@/utils/constants';
import { t } from '@/utils/i18n';
import { useRef, useState } from 'react';

type Props = {
  status: 'success' | 'failed' | 'pending' | null;
  caseId: string;
  isUploading: boolean;
  onUploadFiles: (files: File[]) => void;
};

const EvidenceUploadSection = ({ status, caseId, isUploading, onUploadFiles }: Props) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!caseId || !status || status === 'success') return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files.slice(0, MAX_IMAGE_COUNT));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section className="mb-6" aria-labelledby="evidence-upload-title">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          {status === 'failed' ? (
            <AlertCircle className="size-7 text-destructive" />
          ) : (
            <CloudUpload className="size-7 text-warning" />
          )}
          <h3 id="evidence-upload-title" className="text-xl font-bold text-foreground">{t('evidence.title')}</h3>
        </div>

        {status === 'failed' && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-semibold text-destructive">{t('evidence.failed')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('evidence.failed.desc')}</p>
          </div>
        )}

        {status === 'pending' && (
          <div className="rounded-lg border border-primary/20 bg-primary-light/30 p-3">
            <p className="text-sm font-semibold text-foreground">{t('evidence.pending')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('evidence.pending.desc')}</p>
          </div>
        )}

        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
            id="evidence-file-input"
          />
          <Button
            variant="outline"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />{t('evidence.action.reupload')}
          </Button>
        </div>

        {selectedFiles.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {t('evidence.selectedCount').replace('{count}', String(selectedFiles.length))}
            </span>
            <Button
              size="sm"
              disabled={isUploading}
              onClick={() => { if (selectedFiles.length > 0) { onUploadFiles(selectedFiles); setSelectedFiles([]); } }}
            >
              {isUploading && <Loader2 className="size-3 animate-spin" />}
              {isUploading ? t('evidence.action.uploading') : t('evidence.action.uploadSelected')}
            </Button>
            <Button variant="ghost" size="sm" disabled={isUploading} onClick={() => setSelectedFiles([])}>
              {t('common.clear')}
            </Button>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default EvidenceUploadSection;
