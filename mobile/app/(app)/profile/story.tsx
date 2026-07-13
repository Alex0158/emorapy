import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { m2Api, normalizeM2Error } from '@/src/features/m2/api';
import { tokenStorage } from '@/src/platform/storage/secureStore';
import { t, useLocale } from '@/src/i18n';
import {
  ActionButton,
  FeatureRow,
  LinkButton,
  Panel,
  Screen,
  StatusPill,
} from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';
import {
  identityScopedQueryKey,
  useIdentityQueryScope,
} from '@/src/providers/identityQueryScope';

function readFeedbackCardSummary(feedbackCard: string | null | undefined) {
  if (!feedbackCard) return t('profileStory.feedback.pending');
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
  return t('profileStory.feedback.itemTitle', { index: index + 1 });
}

export default function MyStoryScreen() {
  useLocale();
  const queryClient = useQueryClient();
  const identityScope = useIdentityQueryScope();
  const identityQueriesEnabled = identityScope.privateDataEnabled && !identityScope.transitioning;
  const identityEpoch = identityScope.epoch;
  const authQuery = useQuery({
    queryKey: identityScopedQueryKey(identityEpoch, 'app', 'auth-token'),
    queryFn: () => tokenStorage.getToken(),
    enabled: identityQueriesEnabled,
  });
  const isAuthenticated = Boolean(authQuery.data);
  const psychQuery = useQuery({
    queryKey: identityScopedQueryKey(identityEpoch, 'm2', 'psych-profile'),
    queryFn: () => m2Api.psychProfile.getProfile(),
    enabled: identityQueriesEnabled && isAuthenticated,
  });
  const historyQuery = useQuery({
    queryKey: identityScopedQueryKey(identityEpoch, 'm2', 'psych-feedback-history'),
    queryFn: () => m2Api.psychProfile.getFeedbackHistory(),
    enabled: identityQueriesEnabled && isAuthenticated && psychQuery.data?.consent_given === true,
  });
  const deleteMutation = useMutation({
    mutationFn: () => m2Api.psychProfile.deleteAllData(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: identityScopedQueryKey(identityEpoch, 'm2'),
      });
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
      <Screen
        eyebrow={t('profileStory.eyebrow')}
        title={t('profileStory.authGate.title')}
        subtitle={t('profileStory.authGate.subtitle')}
        testID="profile.story.auth-gate.screen">
        <Panel title={t('profileStory.authGate.panel')}>
          <FeatureRow
            title={t('profileStory.authGate.noPreload.title')}
            detail={t('profileStory.authGate.noPreload.detail')}
            tone="teal"
          />
          <FeatureRow
            title={t('profileStory.authGate.revocable.title')}
            detail={t('profileStory.authGate.revocable.detail')}
            tone="coral"
          />
        </Panel>
        <LinkButton
          href="/auth"
          label={t('profile.authGate.login')}
          tone="teal"
          testID="profile.story.auth-gate.login"
        />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow={t('profileStory.eyebrow')}
      title={t('profileStory.title')}
      subtitle={t('profileStory.subtitle')}
      testID="profile.story.screen">
      <Panel title={t('profileStory.statusPanel')}>
        <StatusPill
          label={psychQuery.data?.consent_given
            ? t('profileStory.status.manageable')
            : t('profileStory.status.noConsent')}
          tone={psychQuery.data?.consent_given ? 'teal' : 'amber'}
        />
        {errorMessage ? (
          <Text style={{ ...typography.small, color: palette.coral }}>
            {errorMessage}
          </Text>
        ) : null}
        <FeatureRow
          title={t('profileStory.narratives.title')}
          detail={t('profileStory.narratives.count', {
            count: psychQuery.data?.narratives?.length ?? 0,
          })}
          tone="teal"
        />
        <FeatureRow
          title={t('profileStory.insights.title')}
          detail={t('profileStory.insights.count', {
            count: psychQuery.data?.insights?.length ?? 0,
          })}
          tone="blue"
        />
        <FeatureRow
          title={t('profileStory.feedback.title')}
          detail={t('profileStory.feedback.count', {
            count: historyQuery.data?.history?.length ?? 0,
          })}
          tone="coral"
        />
      </Panel>

      <Panel title={t('profileStory.recentPanel')}>
        {(historyQuery.data?.history ?? []).slice(0, 3).map((item, index) => (
          <FeatureRow
            key={item.session_id}
            title={labelFeedbackHistoryItem(index)}
            detail={readFeedbackCardSummary(item.feedback_card)}
            tone="teal"
          />
        ))}
        {historyQuery.data?.history?.length ? null : (
          <Text style={{ ...typography.small, color: palette.muted }}>
            {t('profileStory.feedback.empty')}
          </Text>
        )}
      </Panel>

      <View style={{ gap: spacing.sm }}>
        <LinkButton
          href="/profile"
          label={t('profileStory.back')}
          tone="teal"
          testID="profile.story.back"
        />
        <ActionButton
          label={t('profileStory.delete')}
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
