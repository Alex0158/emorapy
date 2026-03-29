/**
 * Chat room alerts - error, invite success, safety banner
 */

import { Alert, Button } from 'antd';
import { t } from '@/utils/i18n';

interface ChatRoomAlertsProps {
  errorText: string;
  lastInviteCode: string;
  latestSafetyContent: string | null;
  hasRoom: boolean;
  roomId: string | undefined;
  onRetryLoad: () => void;
}

export default function ChatRoomAlerts({
  errorText,
  lastInviteCode,
  latestSafetyContent,
  hasRoom,
  roomId,
  onRetryLoad,
}: ChatRoomAlertsProps) {
  return (
    <>
      {errorText ? (
        <Alert
          type="error"
          showIcon
          title={errorText}
          action={
            !hasRoom && roomId ? (
              <Button size="small" onClick={onRetryLoad} data-testid="chat-room-load-retry">
                {t('common.retry')}
              </Button>
            ) : null
          }
        />
      ) : null}
      {lastInviteCode ? (
        <Alert
          type="success"
          showIcon
          title={t('chat.inviteCodeLabel').replace('{code}', lastInviteCode)}
        />
      ) : null}
      {latestSafetyContent ? (
        <Alert
          className="chat-room-page__safety-banner"
          type="warning"
          showIcon
          title={t('chat.safetyBannerTitle')}
          description={latestSafetyContent}
        />
      ) : null}
    </>
  );
}
