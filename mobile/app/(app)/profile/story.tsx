import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { m2Api, normalizeM2Error } from '@/src/features/m2/api';
import { tokenStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

function readFeedbackCardSummary(feedbackCard: string | null | undefined) {
  if (!feedbackCard) return '回饋仍在整理中';
  try {
    const parsed = JSON.parse(feedbackCard) as {
      summary?: unknown;
      encouragement?: unknown;
      continuation_hint?: unknown;
    };
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const encouragement = typeof parsed.encouragement === 'string' ? parsed.encouragement.trim() : '';
    const continuationHint = typeof parsed.continuation_hint === 'string' ? parsed.continuation_hint.trim() : '';
    return [summary, encouragement, continuationHint].filter(Boolean).join('\n\n') || feedbackCard;
  } catch {
    return feedbackCard;
  }
}

function labelFeedbackHistoryItem(index: number): string {
  return `第 ${index + 1} 次訪談回饋`;
}

export default function MyStoryScreen() {
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
  const historyQuery = useQuery({
    queryKey: ['m2', 'psych-feedback-history'],
    queryFn: () => m2Api.psychProfile.getFeedbackHistory(),
    enabled: isAuthenticated && psychQuery.data?.consent_given === true,
  });
  const deleteMutation = useMutation({
    mutationFn: () => m2Api.psychProfile.deleteAllData(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['m2'] });
    },
  });

  const errorMessage = psychQuery.error
    ? normalizeM2Error(psychQuery.error).message
    : historyQuery.error
      ? normalizeM2Error(historyQuery.error).message
      : deleteMutation.error
        ? normalizeM2Error(deleteMutation.error).message
      : null;

  if (!isAuthenticated) {
    return (
      <Screen eyebrow="我的故事" title="先登入" subtitle="我的故事只會在登入後讀取。" testID="profile.story.auth-gate.screen">
        <Panel title="資料保護">
          <FeatureRow title="本機不預載" detail="未登入時不讀取心理畫像或訪談歷史。" tone="teal" />
          <FeatureRow title="可撤回" detail="登入後可管理和清除心理畫像資料。" tone="coral" />
        </Panel>
        <LinkButton href="/auth" label="登入或註冊" tone="teal" testID="profile.story.auth-gate.login" />
      </Screen>
    );
  }

  return (
    <Screen eyebrow="我的故事" title="我的故事" subtitle="只呈現可查看、可管理、可撤回的心理脈絡。" testID="profile.story.screen">
      <Panel title="資料狀態">
        <StatusPill
          label={psychQuery.data?.consent_given ? '可管理' : '尚未同意'}
          tone={psychQuery.data?.consent_given ? 'teal' : 'amber'}
        />
        {errorMessage ? <Text style={{ ...typography.small, color: palette.coral }}>{errorMessage}</Text> : null}
        <FeatureRow title="脈絡摘要" detail={`${psychQuery.data?.narratives?.length ?? 0} 段`} tone="teal" />
        <FeatureRow title="洞察" detail={`${psychQuery.data?.insights?.length ?? 0} 條`} tone="blue" />
        <FeatureRow title="訪談回饋" detail={`${historyQuery.data?.history?.length ?? 0} 次`} tone="coral" />
      </Panel>

      <Panel title="最近回饋">
        {(historyQuery.data?.history ?? []).slice(0, 3).map((item, index) => (
          <FeatureRow
            key={item.session_id}
            title={labelFeedbackHistoryItem(index)}
            detail={readFeedbackCardSummary(item.feedback_card)}
            tone="teal"
          />
        ))}
        {historyQuery.data?.history?.length ? null : (
          <Text style={{ ...typography.small, color: palette.muted }}>完成一次訪談後，回饋會出現在這裡。</Text>
        )}
      </Panel>

      <View style={{ gap: spacing.sm }}>
        <LinkButton href="/profile" label="回到個人脈絡" tone="teal" testID="profile.story.back" />
        <ActionButton
          label="清除心理畫像資料"
          loading={deleteMutation.isPending}
          onPress={() => deleteMutation.mutate()}
          testID="profile.story.delete"
          tone="coral"
          variant="outline"
        />
      </View>
    </Screen>
  );
}
