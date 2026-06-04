import type { Href } from 'expo-router';
import { router } from 'expo-router';
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

export default function ProfileScreen() {
  useLocale();
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
        eyebrow={t('profile.eyebrow')}
        title={t('profile.authGate.title')}
        subtitle={t('profile.authGate.subtitle')}
        testID="profile.auth-gate.screen">
        <Panel title={t('profile.authGate.panel')}>
          <FeatureRow
            title={t('profile.authGate.interview.title')}
            detail={t('profile.authGate.interview.detail')}
            tone="blue"
          />
          <FeatureRow
            title={t('profile.authGate.story.title')}
            detail={t('profile.authGate.story.detail')}
            tone="coral"
          />
          <FeatureRow
            title={t('profile.authGate.personalization.title')}
            detail={t('profile.authGate.personalization.detail')}
            tone="teal"
          />
        </Panel>
        <LinkButton
          href="/auth"
          label={t('profile.authGate.login')}
          tone="teal"
          testID="profile.auth-gate.login"
        />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow={t('profile.eyebrow')}
      title={t('profile.title')}
      subtitle={t('profile.subtitle')}
      testID="profile.screen">
      <Panel title={t('profile.panel')}>
        <StatusPill
          label={psychQuery.data?.consent_given
            ? t('profile.consent.granted')
            : t('profile.consent.pending')}
          tone={psychQuery.data?.consent_given ? 'teal' : 'amber'}
        />
        {errorMessage ? (
          <Text style={{ ...typography.small, color: palette.coral }}>
            {errorMessage}
          </Text>
        ) : null}
        <FeatureRow
          title={t('profile.richness.title')}
          detail={t('profile.richness.detail', {
            score: psychQuery.data?.richness_score ?? 0,
          })}
          tone="teal"
        />
        <FeatureRow
          title={t('profile.interview.title')}
          detail={pendingSessionId
            ? t('profile.interview.resume')
            : t('profile.interview.detail')}
          tone="blue"
        />
        <FeatureRow
          title={t('profile.story.title')}
          detail={t('profile.story.detail', {
            narratives: psychQuery.data?.narratives?.length ?? 0,
            insights: psychQuery.data?.insights?.length ?? 0,
          })}
          tone="coral"
        />
      </Panel>

      <View style={{ gap: spacing.sm }}>
        {pendingSessionId ? (
          <ActionButton
            label={t('profile.resumeInterview')}
            onPress={() => router.push(
              `/profile/interview?sessionId=${encodeURIComponent(pendingSessionId)}` as Href
            )}
            testID="profile.resume-interview"
            tone="blue"
          />
        ) : null}
        {failedSessionId ? (
          <ActionButton
            label={t('profile.retryFailed')}
            loading={retryMutation.isPending}
            onPress={() => retryMutation.mutate()}
            testID="profile.retry-failed-interview"
            tone="amber"
            variant="outline"
          />
        ) : null}
        <ActionButton
          label={psychQuery.data?.consent_given
            ? t('profile.startInterview')
            : t('profile.consentAndStart')}
          loading={startMutation.isPending}
          onPress={() => startMutation.mutate()}
          testID="profile.start-interview"
          tone="teal"
        />
        <LinkButton
          href="/profile/story"
          label={t('profile.viewStory')}
          tone="coral"
          testID="profile.story"
          variant="outline"
        />
        <LinkButton
          href="/chat"
          label={t('profile.enterChat')}
          tone="blue"
          testID="profile.chat"
          variant="outline"
        />
      </View>
    </Screen>
  );
}
