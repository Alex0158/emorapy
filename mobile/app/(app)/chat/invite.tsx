import type { Href } from 'expo-router';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { m3Api, normalizeM3Error } from '@/src/features/m3/api';
import { buildAuthHrefForPostLogin } from '@/src/platform/linking/authGate';
import { pendingLandingStorage, tokenStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

function buildChatInviteHref(code: string): string {
  return `/chat/invite?code=${encodeURIComponent(code)}`;
}

const inviteStatusLabels: Record<string, string> = {
  accepted: '已接受邀請',
  declined: '已拒絕邀請',
  pending: '邀請仍在等待回應',
  revoked: '邀請已撤回',
};

function labelInviteStatus(status?: string | null): string {
  return inviteStatusLabels[status ?? ''] ?? '邀請已更新';
}

export default function ChatInviteScreen() {
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
      if (!trimmed) throw new Error('請輸入邀請碼。');
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
      if (!trimmed) throw new Error('請輸入邀請碼。');
      return m3Api.chat.declineInvite(trimmed);
    },
    onMutate: () => setFeedback(null),
    onSuccess: (invite) => setFeedback(labelInviteStatus(invite.status)),
    onError: (error) => setFeedback(normalizeM3Error(error).message),
  });

  if (!mounted) {
    return (
      <Screen
        eyebrow="邀請"
        title="載入邀請"
        subtitle="正在讀取對話邀請。"
        testID="chat.invite.loading.screen">
        <Panel title="狀態">
          <StatusPill label="載入中" tone="blue" />
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="邀請"
      title="加入對話"
      subtitle="接受邀請後，你會以 B 方加入這段對話。"
      action={<LinkButton href="/chat" label="回到對話" tone="teal" testID="chat.invite.back" variant="outline" />}
      testID="chat.invite.screen">
      <Panel title="邀請碼">
        <FeatureRow title="登入要求" detail="接受邀請需要登入帳號；拒絕公開邀請只允許邀請方撤回。" tone="amber" />
        <TextInput
          accessibilityLabel="邀請碼"
          accessibilityHint="輸入邀請碼以查看並接受對話邀請"
          autoCapitalize="characters"
          onChangeText={setCode}
          placeholder="輸入邀請碼"
          placeholderTextColor={palette.muted}
          style={styles.input}
          testID="chat.invite.code.input"
          value={code}
        />
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
        <View style={styles.actions}>
          <ActionButton
            disabled={!code.trim()}
            label="接受邀請"
            loading={acceptMutation.isPending}
            onPress={() => acceptMutation.mutate()}
            testID="chat.invite.accept"
            tone="teal"
          />
          <ActionButton
            disabled={!code.trim()}
            label="拒絕 / 撤回邀請"
            loading={declineMutation.isPending}
            onPress={() => declineMutation.mutate()}
            testID="chat.invite.decline"
            tone="coral"
            variant="outline"
          />
        </View>
      </Panel>

      <Panel title="加入後">
        <FeatureRow title="歷史可見" detail="你能看到的歷史由邀請方設定決定。" tone="blue" />
        <FeatureRow title="轉判斷" detail="只有 A 方明確請求，且同意範圍成立時才轉判斷。" tone="coral" />
      </Panel>

      <LinkButton href="/chat" label="回到對話" tone="teal" testID="chat.invite.back.footer" variant="outline" />
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
