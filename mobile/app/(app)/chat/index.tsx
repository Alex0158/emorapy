import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { m1Api } from '@/src/features/m1/api';
import { m3Api, normalizeM3Error } from '@/src/features/m3/api';
import { t, useLocale } from '@/src/i18n';
import { buildAuthHrefForPostLogin } from '@/src/platform/linking/authGate';
import { pendingLandingStorage, sessionStorage, tokenStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

function buildChatInviteHref(code: string): string {
  return `/chat/invite?code=${encodeURIComponent(code)}`;
}

async function ensureChatActor() {
  const token = await tokenStorage.getToken();
  if (token) return;

  const currentSessionId = await sessionStorage.getSessionId();
  try {
    const session = currentSessionId
      ? await m1Api.session.refreshQuickSession(currentSessionId)
      : await m1Api.session.createQuickSession();
    await sessionStorage.setSessionId(session.session_id);
  } catch (error) {
    if (!currentSessionId) throw error;
    const session = await m1Api.session.createQuickSession();
    await sessionStorage.setSessionId(session.session_id);
  }
}

export default function ChatScreen() {
  useLocale();
  const [inviteCode, setInviteCode] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      await ensureChatActor();
      return m3Api.chat.createRoom('share_summary_only');
    },
    onMutate: () => setFeedback(null),
    onSuccess: (room) => {
      router.push(`/chat/room?roomId=${encodeURIComponent(room.id)}` as Href);
    },
    onError: (error) => setFeedback(normalizeM3Error(error).message),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async () => {
      const code = inviteCode.trim();
      if (!code) throw new Error(t('chatHome.error.inviteCodeRequired'));
      const token = await tokenStorage.getToken();
      if (!token) {
        const resumeHref = buildChatInviteHref(code);
        await pendingLandingStorage.setPendingHref(resumeHref);
        captureTelemetry({
          name: 'chat_invite_auth_handoff',
          route: '/chat',
          context: {
            hasInviteCode: true,
            source: 'chat_home',
          },
        });
        router.push(buildAuthHrefForPostLogin(resumeHref) as Href);
        return null;
      }
      return m3Api.chat.acceptInvite(code);
    },
    onMutate: () => setFeedback(null),
    onSuccess: (room) => {
      if (!room) return;
      router.push(`/chat/room?roomId=${encodeURIComponent(room.id)}` as Href);
    },
    onError: (error) => setFeedback(normalizeM3Error(error).message),
  });

  return (
    <Screen
      eyebrow={t('chatHome.eyebrow')}
      title={t('chatHome.title')}
      subtitle={t('chatHome.subtitle')}
      testID="chat.home.screen">
      <Panel title={t('chatHome.startPanel')}>
        <StatusPill label={t('chatHome.ready')} tone="teal" />
        <ActionButton
          label={t('chatHome.createRoom')}
          loading={createRoomMutation.isPending}
          onPress={() => createRoomMutation.mutate()}
          testID="chat.home.create-room"
          tone="teal"
        />
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>{t('chatHome.invite.label')}</Text>
          <TextInput
            accessibilityLabel={t('chatHome.invite.label')}
            accessibilityHint={t('chatHome.invite.hint')}
            autoCapitalize="characters"
            onChangeText={setInviteCode}
            placeholder={t('chatHome.invite.placeholder')}
            placeholderTextColor={palette.muted}
            style={styles.input}
            testID="chat.home.invite-code.input"
            value={inviteCode}
          />
          <ActionButton
            disabled={!inviteCode.trim()}
            label={t('chatHome.invite.accept')}
            loading={acceptInviteMutation.isPending}
            onPress={() => acceptInviteMutation.mutate()}
            testID="chat.home.accept-invite"
            tone="blue"
            variant="outline"
          />
          <LinkButton
            href={buildChatInviteHref(inviteCode.trim())}
            label={t('chatHome.invite.open')}
            testID="chat.home.open-invite"
            tone="neutral"
            variant="outline"
          />
        </View>
        {feedback ? <Text style={styles.errorText}>{feedback}</Text> : null}
      </Panel>

      <Panel title={t('chatHome.stagesPanel')}>
        <FeatureRow title={t('chatHome.stage.shared.title')} detail={t('chatHome.stage.shared.detail')} tone="teal" />
        <FeatureRow title={t('chatHome.stage.visibility.title')} detail={t('chatHome.stage.visibility.detail')} tone="amber" />
        <FeatureRow title={t('chatHome.stage.analysis.title')} detail={t('chatHome.stage.analysis.detail')} tone="coral" />
      </Panel>
      <View style={{ gap: spacing.sm }}>
        <LinkButton href="/case" label={t('chatHome.case')} tone="teal" testID="chat.home.case" />
        <LinkButton href="/profile" label={t('chatHome.profile')} tone="blue" testID="chat.home.profile" variant="outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    gap: spacing.sm,
    borderRadius: 8,
    backgroundColor: palette.panel,
    padding: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    color: palette.muted,
  },
  input: {
    ...typography.body,
    color: palette.ink,
    minHeight: 44,
    padding: 0,
  },
  errorText: {
    ...typography.small,
    color: palette.coral,
  },
});
