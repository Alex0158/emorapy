import { StyleSheet, View } from 'react-native';
import type { ChatMessage, ContextCapsuleListItem } from '@emorapy/api-client';

import { t } from '@/src/i18n';
import { ActionButton, FeatureRow } from '@/src/ui/components';
import { spacing } from '@/src/ui/theme';

interface ChatAnalysisEvidenceSelectorProps {
  eligibleMessages: ChatMessage[];
  formalCapsules: ContextCapsuleListItem[];
  selectedMessageIds: string[];
  selectedCapsuleIds: string[];
  onToggleMessage: (messageId: string) => void;
  onToggleCapsule: (capsuleId: string) => void;
}

export function ChatAnalysisEvidenceSelector({
  eligibleMessages,
  formalCapsules,
  selectedMessageIds,
  selectedCapsuleIds,
  onToggleMessage,
  onToggleCapsule,
}: ChatAnalysisEvidenceSelectorProps) {
  const selectedMessageIdSet = new Set(selectedMessageIds);
  const selectedCapsuleIdSet = new Set(selectedCapsuleIds);

  return (
    <>
      <FeatureRow
        title={t('chatRoom.analysis.exactScope')}
        detail={t('chatRoom.analysis.exactScope.detail', {
          capsules: selectedCapsuleIds.length,
          messages: selectedMessageIds.length,
        })}
        tone={selectedMessageIds.length + selectedCapsuleIds.length > 0 ? 'teal' : 'amber'}
      />
      {selectedMessageIds.length + selectedCapsuleIds.length === 0 ? (
        <FeatureRow
          title={t('chatRoom.analysis.selectEvidence')}
          detail={t('chatRoom.analysis.selectEvidence.detail')}
          tone="amber"
        />
      ) : null}
      {eligibleMessages.map((message) => {
        const selected = selectedMessageIdSet.has(message.id);
        const roleB = message.sender_participant?.role_in_room === 'roleB';
        return (
          <View key={message.id} style={styles.evidence}>
            <FeatureRow
              title={roleB
                ? t('chatRoom.messageMeta.roleB')
                : t('chatRoom.messageMeta.roleA')}
              detail={message.content}
              tone={roleB ? 'blue' : 'teal'}
            />
            <ActionButton
              label={selected
                ? t('chatRoom.analysis.removeMessage')
                : t('chatRoom.analysis.includeMessage')}
              onPress={() => onToggleMessage(message.id)}
              selected={selected}
              testID={`chat.room.analysis.message.${message.id}`}
              tone={roleB ? 'blue' : 'teal'}
              variant={selected ? 'filled' : 'outline'}
            />
          </View>
        );
      })}
      {formalCapsules.map((capsule) => {
        const selected = selectedCapsuleIdSet.has(capsule.id);
        return (
          <View key={capsule.id} style={styles.evidence}>
            <FeatureRow
              title={t('chatRoom.analysis.availableSummary')}
              detail={capsule.summary}
              tone="amber"
            />
            <ActionButton
              label={selected
                ? t('chatRoom.analysis.removeSummary')
                : t('chatRoom.analysis.includeSummary')}
              onPress={() => onToggleCapsule(capsule.id)}
              selected={selected}
              testID={`chat.room.analysis.capsule.${capsule.id}`}
              tone="amber"
              variant={selected ? 'filled' : 'outline'}
            />
          </View>
        );
      })}
      {eligibleMessages.length + formalCapsules.length === 0 ? (
        <FeatureRow
          title={t('chatRoom.analysis.noEvidence')}
          detail={t('chatRoom.analysis.noEvidence.detail')}
          tone="blue"
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  evidence: {
    gap: spacing.xs,
  },
});
