/**
 * 確認彈窗組件（遷移：Ant Modal → shadcn Dialog）
 */

import React from 'react';
import { AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { t } from '@/utils/i18n';

interface ConfirmModalProps {
  open?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  title?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  children?: React.ReactNode;
}

const ConfirmModal = ({
  open = false,
  onConfirm,
  onCancel,
  title,
  confirmText = t('common.confirm'),
  cancelText = t('common.cancel'),
  type = 'warning',
  children,
}: ConfirmModalProps) => {
  const [confirming, setConfirming] = React.useState(false);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const Icon = type === 'danger' ? AlertCircle : AlertTriangle;

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) onCancel?.(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title || t(type === 'danger' ? 'confirmModal.dangerTitle' : 'confirmModal.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-3">
          {(type === 'warning' || type === 'danger') && (
            <Icon className={type === 'danger' ? 'size-5 shrink-0 mt-0.5 text-destructive' : 'size-5 shrink-0 mt-0.5 text-warning'} />
          )}
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{cancelText}</Button>
          <Button
            variant={type === 'danger' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming && <Loader2 className="size-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmModal;
