/**
 * 訪談同意確認彈窗（遷移：Ant Modal → shadcn Dialog）
 */

import React from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { t } from '@/utils/i18n';

interface ConsentModalProps {
  open: boolean;
  onConsent: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConsentModal: React.FC<ConsentModalProps> = ({ open, onConsent, onCancel, loading }) => {
  const [agreed, setAgreed] = React.useState(false);

  React.useEffect(() => {
    if (!open) setAgreed(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Shield className="size-7 text-success" />
            <DialogTitle>{t('consent.beforeStart')}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('consent.description')}</p>

          <div>
            <p className="text-sm font-semibold text-foreground mb-2">{t('consent.promise')}</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
              <li>{t('consent.point1')}</li>
              <li>{t('consent.point2')}</li>
              <li>{t('consent.point3')}</li>
              <li>{t('consent.point4')}</li>
              <li>{t('consent.point5')}</li>
            </ul>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary accent-primary"
            />
            <span className="text-sm text-foreground">{t('consent.agree')}</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{t('consent.notNow')}</Button>
          <Button onClick={onConsent} disabled={!agreed || loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {t('consent.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConsentModal;
