/**
 * 安全警示組件
 *
 * 在訪談中偵測到風險信號時顯示。
 * 遷移: Ant Alert/Space/Typography/Icons → shadcn Alert + Tailwind + Lucide
 */

import React from 'react';
import { Heart, Phone, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { t } from '@/utils/i18n';

interface SafetyAlertProps {
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  onDismiss?: () => void;
}

const CRISIS_RESOURCES = [
  { nameKey: 'safety.crisis.peaceLine' as const, phone: '1925' },
  { nameKey: 'safety.crisis.lifeLine' as const, phone: '1995' },
  { nameKey: 'safety.crisis.teacherLine' as const, phone: '1980' },
];

const severityStyles = {
  info: 'border-primary/30 bg-primary-light/50',
  warning: 'border-warning/30 bg-warning/5',
  critical: 'border-destructive/30 bg-destructive/5',
} as const;

const SafetyAlert: React.FC<SafetyAlertProps> = ({ message: alertMessage, severity = 'info', onDismiss }) => {
  const isCritical = severity === 'critical';

  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
      <Alert className={cn('relative', severityStyles[severity])}>
        <Heart className="size-4 text-primary" />
        <AlertTitle className="font-semibold">{t('safety.title')}</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm text-foreground/80">{alertMessage}</p>
          {isCritical && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium text-muted-foreground">{t('safety.resources')}：</p>
              {CRISIS_RESOURCES.map((r) => (
                <a
                  key={r.phone}
                  href={`tel:${r.phone}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Phone className="size-3" />
                  <span>{t(r.nameKey)} {r.phone}</span>
                </a>
              ))}
            </div>
          )}
        </AlertDescription>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('common.dismiss')}
          >
            <X className="size-4" />
          </button>
        )}
      </Alert>
    </div>
  );
};

export default SafetyAlert;
