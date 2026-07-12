/**
 * Chat room alerts - error, invite success, safety banner
 */

import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { t } from '@/utils/i18n';

interface ChatRoomAlertsProps {
  errorText: string;
  lastInviteCode: string;
  latestSafetyContent: string | null;
  hasRoom: boolean;
  roomId: string | undefined;
  onRetryLoad: () => void;
}

export default function ChatRoomAlerts({ errorText, lastInviteCode, latestSafetyContent, hasRoom, roomId, onRetryLoad }: ChatRoomAlertsProps) {
  const safetyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (latestSafetyContent) safetyRef.current?.focus();
  }, [latestSafetyContent]);

  return (
    <>
      {errorText && (
        <Alert className="border-destructive/30 bg-destructive/5 mb-3">
          <AlertCircle className="size-4" />
          <AlertTitle>{errorText}</AlertTitle>
          {!hasRoom && roomId && (
            <AlertDescription><Button variant="outline" size="sm" onClick={onRetryLoad} data-testid="chat-room-load-retry">{t('common.retry')}</Button></AlertDescription>
          )}
        </Alert>
      )}
      {lastInviteCode && (
        <Alert className="border-success/30 bg-success/5 mb-3">
          <CheckCircle className="size-4" />
          <AlertTitle>{t('chat.inviteCodeLabel').replace('{code}', lastInviteCode)}</AlertTitle>
        </Alert>
      )}
      {latestSafetyContent && (
        <div ref={safetyRef} tabIndex={-1} className="outline-none" data-testid="chat-safety-interruption">
          <Alert className="border-warning/50 bg-warning/5 mb-3" aria-live="assertive" aria-atomic="true">
            <AlertTriangle className="size-4" />
            <AlertTitle>{t('chat.safetyBannerTitle')}</AlertTitle>
            <AlertDescription>{latestSafetyContent}</AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
}
