import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatMessage } from '@emorapy/api-client';

import { t } from '@/src/i18n';
import { ActionButton, FeatureRow, Panel } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';
import { m3Api, normalizeM3Error } from './api';
import { chatQueryKeys } from './chatQueryKeys';
import { useIdentityQueryScope } from '@/src/providers/identityQueryScope';

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
  const queryClient = useQueryClient();
  const { epoch: identityEpoch } = useIdentityQueryScope();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [includeInAnalysis, setIncludeInAnalysis] = useState(false);
  const [formalGrantWarning, setFormalGrantWarning] = useState(false);
  const [sourceSnapshot, setSourceSnapshot] = useState<ChatMessage[]>([]);
  const sourceCandidates = useMemo(() => messages.filter((message) => (
    message.channel_id === privateChannelId
    && !message.safety_flag
    && ['user_text', 'ai_reflection', 'ai_mediation', 'ai_summary'].includes(message.message_type)
  )).slice(-2), [messages, privateChannelId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const capsule = await m3Api.chat.createContextCapsule(roomId, {
        source_channel_id: privateChannelId,
        source_message_ids: sourceSnapshot.map((message) => message.id),
        summary: summary.trim(),
      });
      await m3Api.chat.grantContextAuthorization(roomId, capsule.id, {
        capsule_content_hash: capsule.content_hash,
        purpose: 'shared_mediation',
        audience: 'room_participants',
        target_type: 'chat_room',
        target_id: roomId,
        policy_version: capsule.policy_version,
      });
      let formalGrantFailed = false;
      if (includeInAnalysis) {
        try {
          await m3Api.chat.grantContextAuthorization(roomId, capsule.id, {
            capsule_content_hash: capsule.content_hash,
            purpose: 'formal_analysis_evidence',
            audience: 'analysis_participants',
            target_type: 'chat_room',
            target_id: roomId,
            policy_version: capsule.policy_version,
          });
        } catch {
          formalGrantFailed = true;
        }
      }
      return { capsule, formalGrantFailed };
    },
    onMutate: () => setFormalGrantWarning(false),
    onSuccess: async ({ formalGrantFailed }) => {
      setOpen(false);
      setSummary('');
      setIncludeInAnalysis(false);
      setSourceSnapshot([]);
      setFormalGrantWarning(formalGrantFailed);
      await queryClient.invalidateQueries({
        queryKey: chatQueryKeys.contextCapsules(identityEpoch, roomId),
      });
    },
  });

  useEffect(() => {
    setOpen(false);
    setSummary('');
    setIncludeInAnalysis(false);
    setSourceSnapshot([]);
    setFormalGrantWarning(false);
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
      {createMutation.error ? (
        <Text style={styles.errorText}>{normalizeM3Error(createMutation.error).message}</Text>
      ) : null}
      {formalGrantWarning ? (
        <FeatureRow
          title={t('chatRoom.capsule.formalGrantFailed')}
          detail={t('chatRoom.capsule.formalGrantFailed.detail')}
          tone="amber"
        />
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
          <ActionButton
            label={includeInAnalysis
              ? t('chatRoom.capsule.formalIncluded')
              : t('chatRoom.capsule.formalExcluded')}
            onPress={() => setIncludeInAnalysis((current) => !current)}
            selected={includeInAnalysis}
            testID="chat.room.capsule.formal-toggle"
            tone="amber"
            variant={includeInAnalysis ? 'filled' : 'outline'}
          />
          <ActionButton
            disabled={summary.trim().length === 0}
            label={t('chatRoom.capsule.approve')}
            loading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
            testID="chat.room.capsule.approve"
            tone="teal"
          />
        </>
      ) : (
        <ActionButton
          label={t('chatRoom.capsule.open')}
          onPress={() => {
            const nextSnapshot = [...sourceCandidates];
            setSourceSnapshot(nextSnapshot);
            setSummary(
              [...nextSnapshot].reverse().find((message) => message.message_type !== 'user_text')?.content
                ?? nextSnapshot.at(-1)?.content
                ?? '',
            );
            setIncludeInAnalysis(false);
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
