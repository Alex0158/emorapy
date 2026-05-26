import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { m1Api } from '@/src/features/m1/api';
import { m3Api, normalizeM3Error } from '@/src/features/m3/api';
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
      if (!code) throw new Error('請輸入邀請碼。');
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
      eyebrow="對話"
      title="先聊再判"
      subtitle="先讓材料在對話裡沉澱，再決定是否進入判斷。"
      testID="chat.home.screen">
      <Panel title="開始">
        <StatusPill label="可開始" tone="teal" />
        <ActionButton
          label="開始新的對話"
          loading={createRoomMutation.isPending}
          onPress={() => createRoomMutation.mutate()}
          testID="chat.home.create-room"
          tone="teal"
        />
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>已有邀請碼</Text>
          <TextInput
            accessibilityLabel="已有邀請碼"
            accessibilityHint="輸入對方提供的邀請碼以加入對話"
            autoCapitalize="characters"
            onChangeText={setInviteCode}
            placeholder="輸入對方給你的邀請碼"
            placeholderTextColor={palette.muted}
            style={styles.input}
            testID="chat.home.invite-code.input"
            value={inviteCode}
          />
          <ActionButton
            disabled={!inviteCode.trim()}
            label="接受邀請"
            loading={acceptInviteMutation.isPending}
            onPress={() => acceptInviteMutation.mutate()}
            testID="chat.home.accept-invite"
            tone="blue"
            variant="outline"
          />
          <LinkButton
            href={buildChatInviteHref(inviteCode.trim())}
            label="打開邀請承接頁"
            testID="chat.home.open-invite"
            tone="neutral"
            variant="outline"
          />
        </View>
        {feedback ? <Text style={styles.errorText}>{feedback}</Text> : null}
      </Panel>

      <Panel title="對話階段">
        <FeatureRow title="共同整理" detail="可以先單人整理，也可以邀請對方加入。" tone="teal" />
        <FeatureRow title="可見範圍" detail="加入前後的內容按雙方同意的範圍呈現。" tone="amber" />
        <FeatureRow title="轉判斷" detail="材料足夠後再請求判斷，不急著定責。" tone="coral" />
      </Panel>
      <View style={{ gap: spacing.sm }}>
        <LinkButton href="/case" label="查看案件主線" tone="teal" testID="chat.home.case" />
        <LinkButton href="/profile" label="查看個人脈絡" tone="blue" testID="chat.home.profile" variant="outline" />
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
