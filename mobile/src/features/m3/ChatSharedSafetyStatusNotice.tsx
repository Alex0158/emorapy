import { t } from '@/src/i18n';
import { FeatureRow } from '@/src/ui/components';
import type { ChatSharedSafetyViewState } from './useChatRoomSafetyStatus';

type ChatSharedSafetyStatusNoticeProps = {
  state: ChatSharedSafetyViewState;
};

export function ChatSharedSafetyStatusNotice({
  state,
}: ChatSharedSafetyStatusNoticeProps) {
  if (!state.blocked) return null;
  if (state.status === 'paused') {
    return (
      <FeatureRow
        title={t('chatRoom.safety.sharedPaused')}
        detail={t('chatRoom.safety.sharedPaused.detail')}
        tone="amber"
      />
    );
  }
  if (state.unavailable) {
    return (
      <FeatureRow
        title={t('chatRoom.safety.statusUnavailable')}
        detail={t('chatRoom.safety.statusUnavailable.detail')}
        tone="amber"
      />
    );
  }
  return (
    <FeatureRow
      title={t('chatRoom.safety.statusChecking')}
      detail={t('chatRoom.safety.statusChecking.detail')}
      tone="neutral"
    />
  );
}
