/**
 * 安全警示組件
 *
 * 在訪談中偵測到風險信號時顯示。
 * 遷移: Ant Alert/Space/Typography/Icons → shadcn Alert + Tailwind + Lucide
 */

import React, { useEffect, useRef } from 'react';
import { HeartHandshake, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getCrisisSupportResource } from '@/config/crisisSupport';
import { cn } from '@/lib/utils';
import { t } from '@/utils/i18n';

interface SafetyAlertProps {
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  onDismiss?: () => void;
}

const severityStyles = {
  info: 'border-border bg-card',
  warning: 'border-warning/30 bg-warning/5',
  critical: 'border-destructive/50 bg-destructive/5',
} as const;

const SafetyAlert: React.FC<SafetyAlertProps> = ({ message: alertMessage, severity = 'info', onDismiss }) => {
  const isCritical = severity === 'critical';
  const containerRef = useRef<HTMLDivElement>(null);
  const crisisSupportResource = getCrisisSupportResource();

  useEffect(() => {
    if (isCritical) containerRef.current?.focus();
  }, [isCritical]);

  return (
    <div
      ref={containerRef}
      tabIndex={isCritical ? -1 : undefined}
      className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      data-critical={isCritical || undefined}
    >
      <Alert
        className={cn('relative', severityStyles[severity])}
        aria-live={isCritical ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        <HeartHandshake className={cn('size-4', isCritical ? 'text-destructive' : 'text-primary')} />
        <AlertTitle className="font-semibold">{t('safety.title')}</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm text-foreground">{alertMessage}</p>
          {isCritical && (
            <div className="space-y-2 border-t border-destructive/20 pt-3 text-sm text-foreground">
              <p className="font-medium">{t('safety.resources')}</p>
              <p>{t('safety.resourcesEmergency')}</p>
              <a
                href={crisisSupportResource.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 hover:text-primary-hover"
              >
                {crisisSupportResource.source === 'deployment_config'
                  ? t('safety.resourcesConfiguredLink', { region: crisisSupportResource.region })
                  : t('safety.resourcesGlobalLink')}
              </a>
            </div>
          )}
        </AlertDescription>
        {onDismiss && !isCritical && (
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
