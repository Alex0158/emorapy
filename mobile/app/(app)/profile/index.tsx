import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { m2Api, normalizeM2Error } from '@/src/features/m2/api';
import { tokenStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const authQuery = useQuery({
    queryKey: ['app', 'auth-token'],
    queryFn: () => tokenStorage.getToken(),
  });
  const isAuthenticated = Boolean(authQuery.data);
  const psychQuery = useQuery({
    queryKey: ['m2', 'psych-profile'],
    queryFn: () => m2Api.psychProfile.getProfile(),
    enabled: isAuthenticated,
  });
  const resumeQuery = useQuery({
    queryKey: ['m2', 'interview-resume'],
    queryFn: () => m2Api.interview.checkResume(),
    enabled: isAuthenticated,
  });
  const pendingSessionId = resumeQuery.data?.has_pending ? resumeQuery.data.session_id : null;
  const failedSessionId = resumeQuery.data?.has_failed ? resumeQuery.data.failed_session_id : null;

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!psychQuery.data?.consent_given) {
        await m2Api.psychProfile.giveConsent();
        await queryClient.invalidateQueries({ queryKey: ['m2', 'psych-profile'] });
      }
      return m2Api.interview.startSession('organic');
    },
    onSuccess: (session) => {
      router.push(`/profile/interview?sessionId=${encodeURIComponent(session.id)}` as Href);
    },
  });
  const retryMutation = useMutation({
    mutationFn: () => m2Api.interview.retryFailed(failedSessionId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['m2'] });
      router.push('/profile/story' as Href);
    },
  });

  const errorMessage = psychQuery.error
    ? normalizeM2Error(psychQuery.error).message
    : resumeQuery.error
      ? normalizeM2Error(resumeQuery.error).message
      : startMutation.error
        ? normalizeM2Error(startMutation.error).message
        : retryMutation.error
          ? normalizeM2Error(retryMutation.error).message
          : null;

  if (!isAuthenticated) {
    return (
      <Screen
        eyebrow="個人脈絡"
        title="先保存進度"
        subtitle="個人脈絡、訪談和我的故事需要登入後才會讀取。"
        testID="profile.auth-gate.screen">
        <Panel title="登入後可用">
          <FeatureRow title="心理訪談" detail="用短輪次整理關係模式。" tone="blue" />
          <FeatureRow title="我的故事" detail="查看和管理已整理的心理脈絡。" tone="coral" />
          <FeatureRow title="後續個人化" detail="讓正式案件和修復計畫使用你允許的背景。" tone="teal" />
        </Panel>
        <LinkButton href="/auth" label="登入或註冊" tone="teal" testID="profile.auth-gate.login" />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="個人脈絡"
      title="讓系統更懂你"
      subtitle="把你的關係模式和重要背景整理成可控的個人脈絡。"
      testID="profile.screen">
      <Panel title="個人脈絡">
        <StatusPill
          label={psychQuery.data?.consent_given ? '已同意心理畫像' : '同意後使用'}
          tone={psychQuery.data?.consent_given ? 'teal' : 'amber'}
        />
        {errorMessage ? <Text style={{ ...typography.small, color: palette.coral }}>{errorMessage}</Text> : null}
        <FeatureRow
          title="豐富度"
          detail={`目前分數 ${psychQuery.data?.richness_score ?? 0}，仍可逐步補足。`}
          tone="teal"
        />
        <FeatureRow
          title="訪談"
          detail={pendingSessionId ? '已有可繼續的訪談。' : '用短輪次整理關係模式，不要求一次說完。'}
          tone="blue"
        />
        <FeatureRow
          title="我的故事"
          detail={`已整理 ${psychQuery.data?.narratives?.length ?? 0} 段脈絡、${psychQuery.data?.insights?.length ?? 0} 條洞察。`}
          tone="coral"
        />
      </Panel>

      <View style={{ gap: spacing.sm }}>
        {pendingSessionId ? (
          <ActionButton
            label="繼續訪談"
            onPress={() => router.push(`/profile/interview?sessionId=${encodeURIComponent(pendingSessionId)}` as Href)}
            testID="profile.resume-interview"
            tone="blue"
          />
        ) : null}
        {failedSessionId ? (
          <ActionButton
            label="重試上次整理"
            loading={retryMutation.isPending}
            onPress={() => retryMutation.mutate()}
            testID="profile.retry-failed-interview"
            tone="amber"
            variant="outline"
          />
        ) : null}
        <ActionButton
          label={psychQuery.data?.consent_given ? '開始新的訪談' : '同意並開始訪談'}
          loading={startMutation.isPending}
          onPress={() => startMutation.mutate()}
          testID="profile.start-interview"
          tone="teal"
        />
        <LinkButton href="/profile/story" label="查看我的故事" tone="coral" testID="profile.story" variant="outline" />
        <LinkButton href="/chat" label="進入對話" tone="blue" testID="profile.chat" variant="outline" />
      </View>
    </Screen>
  );
}
