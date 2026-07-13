import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import type { ChatMessage } from '@emorapy/api-client';

import { t } from '@/src/i18n';
import { ActionButton, FeatureRow, Panel } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';
import { normalizeM3Error } from './api';
import { useChatContextCapsuleLifecycle } from './useChatContextCapsuleLifecycle';

type ChatContextCapsuleComposerProps = {
  messages: ChatMessage[];
  privateChannelId: string;
  roomId: string;
};

export function ChatContextCapsuleComposer({
  messages,
  privateChannelId,
  roomId,
}: ChatContextCapsuleComposerProps) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [sourceSnapshot, setSourceSnapshot] = useState<ChatMessage[]>([]);
  const lifecycle = useChatContextCapsuleLifecycle(roomId);
  const sourceCandidates = useMemo(() => messages.filter((message) => (
    message.channel_id === privateChannelId
    && !message.safety_flag
    && ['user_text', 'ai_reflection', 'ai_mediation', 'ai_summary'].includes(message.message_type)
  )).slice(-2), [messages, privateChannelId]);

  const saveDraft = () => {
    lifecycle.mutate({
      kind: 'create',
      sourceChannelId: privateChannelId,
      sourceMessageIds: sourceSnapshot.map((message) => message.id),
      summary,
    }, {
      onSuccess: () => {
        setOpen(false);
        setSummary('');
        setSourceSnapshot([]);
      },
    });
  };

  useEffect(() => {
    setOpen(false);
    setSummary('');
    setSourceSnapshot([]);
  }, [privateChannelId, roomId]);

  if (!open && sourceCandidates.length === 0) return null;

  return (
    <Panel title={t('chatRoom.capsule.panel')}>
      <FeatureRow
        title={t('chatRoom.capsule.title')}
        detail={t('chatRoom.capsule.detail', {
          count: open ? sourceSnapshot.length : sourceCandidates.length,
        })}
        tone="blue"
      />
      {lifecycle.error ? (
        <Text style={styles.errorText}>{normalizeM3Error(lifecycle.error).message}</Text>
      ) : null}
      {open ? (
        <>
          {sourceSnapshot.map((message) => (
            <FeatureRow
              key={message.id}
              title={t('chatRoom.capsule.sourcePreview')}
              detail={message.content}
              tone="blue"
            />
          ))}
          <TextInput
            accessibilityLabel={t('chatRoom.capsule.summaryLabel')}
            multiline
            onChangeText={setSummary}
            placeholder={t('chatRoom.capsule.placeholder')}
            placeholderTextColor={palette.muted}
            style={styles.textArea}
            testID="chat.room.capsule.summary"
            textAlignVertical="top"
            value={summary}
          />
          <FeatureRow
            title={t('chatRoom.capsule.draftBoundary')}
            detail={t('chatRoom.capsule.draftBoundary.detail')}
            tone="neutral"
          />
          <ActionButton
            disabled={summary.trim().length === 0}
            label={t('chatRoom.capsule.saveDraft')}
            loading={lifecycle.operationKey === `create:${privateChannelId}`}
            onPress={saveDraft}
            testID="chat.room.capsule.save-draft"
            tone="blue"
          />
        </>
      ) : (
        <ActionButton
          disabled={lifecycle.isPending}
          label={t('chatRoom.capsule.open')}
          loading={lifecycle.operationKey === `create:${privateChannelId}`}
          onPress={() => {
            const nextSnapshot = [...sourceCandidates];
            setSourceSnapshot(nextSnapshot);
            setSummary(
              [...nextSnapshot].reverse().find((message) => message.message_type !== 'user_text')?.content
                ?? nextSnapshot.at(-1)?.content
                ?? '',
            );
            lifecycle.reset();
            setOpen(true);
          }}
          testID="chat.room.capsule.open"
          tone="blue"
          variant="outline"
        />
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  errorText: {
    ...typography.caption,
    color: palette.coral,
  },
  textArea: {
    minHeight: 120,
    borderRadius: 8,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.panel,
    color: palette.ink,
    padding: spacing.md,
  },
});
