import type { Href } from 'expo-router';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { m3Api, normalizeM3Error } from '@/src/features/m3/api';
import { t, useLocale } from '@/src/i18n';
import { buildAuthHrefForPostLogin } from '@/src/platform/linking/authGate';
import { pendingLandingStorage, tokenStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

function buildChatInviteHref(code: string): string {
  return `/chat/invite?code=${encodeURIComponent(code)}`;
}

const inviteStatusLabelKeys: Record<string, string> = {
  accepted: 'chatInvite.status.accepted',
  declined: 'chatInvite.status.declined',
  pending: 'chatInvite.status.pending',
  revoked: 'chatInvite.status.revoked',
};

function labelInviteStatus(status?: string | null): string {
  return t(inviteStatusLabelKeys[status ?? ''] ?? 'chatInvite.status.updated');
}

export default function ChatInviteScreen() {
  useLocale();
  const params = useLocalSearchParams<{ code?: string }>();
  const paramCode = typeof params.code === 'string' ? params.code : '';
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState(paramCode);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && paramCode && paramCode !== code) {
      setCode(paramCode);
    }
  }, [code, mounted, paramCode]);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const trimmed = code.trim();
      if (!trimmed) throw new Error(t('chatInvite.error.codeRequired'));
      const token = await tokenStorage.getToken();
      if (!token) {
        const resumeHref = buildChatInviteHref(trimmed);
        await pendingLandingStorage.setPendingHref(resumeHref);
        captureTelemetry({
          name: 'chat_invite_auth_handoff',
          route: '/chat/invite',
          context: {
            hasInviteCode: true,
            source: 'chat_invite_landing',
          },
        });
        router.push(buildAuthHrefForPostLogin(resumeHref) as Href);
        return null;
      }
      return m3Api.chat.acceptInvite(trimmed);
    },
    onMutate: () => setFeedback(null),
    onSuccess: (room) => {
      if (!room) return;
      router.push(`/chat/room?roomId=${encodeURIComponent(room.id)}` as Href);
    },
    onError: (error) => setFeedback(normalizeM3Error(error).message),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const trimmed = code.trim();
      if (!trimmed) throw new Error(t('chatInvite.error.codeRequired'));
      return m3Api.chat.declineInvite(trimmed);
    },
    onMutate: () => setFeedback(null),
    onSuccess: (invite) => setFeedback(labelInviteStatus(invite.status)),
    onError: (error) => setFeedback(normalizeM3Error(error).message),
  });

  if (!mounted) {
    return (
      <Screen
        eyebrow={t('chatInvite.eyebrow')}
        title={t('chatInvite.loading.title')}
        subtitle={t('chatInvite.loading.subtitle')}
        testID="chat.invite.loading.screen">
        <Panel title={t('chatInvite.loading.panel')}>
          <StatusPill label={t('chatInvite.loading.pill')} tone="blue" />
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow={t('chatInvite.eyebrow')}
      title={t('chatInvite.title')}
      subtitle={t('chatInvite.subtitle')}
      action={<LinkButton href="/chat" label={t('chatInvite.back')} tone="teal" testID="chat.invite.back" variant="outline" />}
      testID="chat.invite.screen">
      <Panel title={t('chatInvite.codePanel')}>
        <FeatureRow
          title={t('chatInvite.loginRequirement.title')}
          detail={t('chatInvite.loginRequirement.detail')}
          tone="amber"
        />
        <TextInput
          accessibilityLabel={t('chatInvite.code.label')}
          accessibilityHint={t('chatInvite.code.hint')}
          autoCapitalize="characters"
          onChangeText={setCode}
          placeholder={t('chatInvite.code.placeholder')}
          placeholderTextColor={palette.muted}
          style={styles.input}
          testID="chat.invite.code.input"
          value={code}
        />
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
        <View style={styles.actions}>
          <ActionButton
            disabled={!code.trim()}
            label={t('chatInvite.accept')}
            loading={acceptMutation.isPending}
            onPress={() => acceptMutation.mutate()}
            testID="chat.invite.accept"
            tone="teal"
          />
          <ActionButton
            disabled={!code.trim()}
            label={t('chatInvite.decline')}
            loading={declineMutation.isPending}
            onPress={() => declineMutation.mutate()}
            testID="chat.invite.decline"
            tone="coral"
            variant="outline"
          />
        </View>
      </Panel>

      <Panel title={t('chatInvite.afterPanel')}>
        <FeatureRow title={t('chatInvite.after.history.title')} detail={t('chatInvite.after.history.detail')} tone="blue" />
        <FeatureRow title={t('chatInvite.after.analysis.title')} detail={t('chatInvite.after.analysis.detail')} tone="coral" />
      </Panel>

      <LinkButton href="/chat" label={t('chatInvite.back')} tone="teal" testID="chat.invite.back.footer" variant="outline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    ...typography.body,
    color: palette.ink,
    minHeight: 48,
    padding: 0,
  },
  feedback: {
    ...typography.small,
    color: palette.coral,
  },
  actions: {
    gap: spacing.sm,
  },
});
