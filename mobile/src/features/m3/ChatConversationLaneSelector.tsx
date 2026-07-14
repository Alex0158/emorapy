import { StyleSheet, View } from 'react-native';

import { t } from '@/src/i18n';
import { ActionButton, FeatureRow } from '@/src/ui/components';
import { spacing } from '@/src/ui/theme';
import type { ChatConversationLane } from './useChatConversationLane';

interface ChatConversationLaneSelectorProps {
  activeLane: ChatConversationLane;
  sharedAvailable: boolean;
  sharedBlockedByTrust?: boolean;
  sharedReadOnly: boolean;
  onLaneChange: (lane: ChatConversationLane) => void;
}

export function ChatConversationLaneSelector({
  activeLane,
  sharedAvailable,
  sharedBlockedByTrust = false,
  sharedReadOnly,
  onLaneChange,
}: ChatConversationLaneSelectorProps) {
  const isPrivate = activeLane === 'private';

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <ActionButton
          label={t('chatRoom.lane.private')}
          onPress={() => onLaneChange('private')}
          selected={isPrivate}
          testID="chat.room.lane.private"
          tone="blue"
          variant={isPrivate ? 'filled' : 'outline'}
        />
        <ActionButton
          disabled={!sharedAvailable || sharedBlockedByTrust}
          label={t('chatRoom.lane.shared')}
          onPress={() => onLaneChange('shared')}
          selected={!isPrivate}
          testID="chat.room.lane.shared"
          tone="teal"
          variant={!isPrivate ? 'filled' : 'outline'}
        />
      </View>
      <FeatureRow
        title={isPrivate ? t('chatRoom.lane.private') : t('chatRoom.lane.shared')}
        detail={isPrivate ? t('chatRoom.lane.privateAudience') : t('chatRoom.lane.sharedAudience')}
        tone={isPrivate ? 'blue' : 'teal'}
      />
      {!sharedAvailable ? (
        <FeatureRow title={t('chatRoom.lane.shared')} detail={t('chatRoom.lane.sharedUnavailable')} tone="amber" />
      ) : null}
      {sharedAvailable && sharedBlockedByTrust ? (
        <FeatureRow title={t('chatRoom.lane.shared')} detail={t('chatRoom.lane.sharedTrustRequired')} tone="amber" />
      ) : null}
      {sharedReadOnly ? (
        <FeatureRow title={t('chatRoom.lane.shared')} detail={t('chatRoom.lane.sharedReadOnly')} tone="amber" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  container: {
    gap: spacing.md,
  },
});
