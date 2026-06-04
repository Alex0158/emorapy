import type { Href } from 'expo-router';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { normalizeM1Error, m1Api } from '@/src/features/m1/api';
import { clearAppStorageWithPushCleanup } from '@/src/features/m5/pushLifecycle';
import { getPostAuthResumeHref } from '@/src/platform/linking/authGate';
import { APP_AUTH_TOKEN_QUERY_KEY, APP_SESSION_ID_QUERY_KEY } from '@/src/providers/AuthSessionBootstrap';
import {
  pendingLandingStorage,
  sessionStorage,
  tokenStorage,
} from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';
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

type AuthMode = 'login' | 'register';

const CLEAR_SESSION_ON_CLAIM_ERROR_CODES = new Set([
  'INVALID_SESSION_ID',
  'SESSION_EXPIRED',
  'SESSION_ID_REQUIRED',
  'HTTP_400',
  'HTTP_404',
]);

function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

export default function AuthScreen() {
  useLocale();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [statusText, setStatusText] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const authMutation = useMutation({
    mutationFn: async () => {
      const trimmedEmail = email.trim();
      const trimmedNickname = nickname.trim();
      if (!isValidEmail(trimmedEmail)) {
        throw new Error(t('auth.error.invalidEmail'));
      }
      if (password.length < 8) {
        throw new Error(t('auth.error.passwordMin'));
      }

      const auth =
        mode === 'login'
          ? await m1Api.auth.login({ email: trimmedEmail, password })
          : await m1Api.auth.register({
              email: trimmedEmail,
              password,
              nickname: trimmedNickname || undefined,
            });

      await tokenStorage.setToken(auth.token);
      queryClient.setQueryData(APP_AUTH_TOKEN_QUERY_KEY, auth.token);

      const sessionId = await sessionStorage.getSessionId();
      queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, sessionId);
      if (sessionId) {
        try {
          const claim = await m1Api.auth.claimSession(sessionId);
          setStatusText(
            claim.case_id
              ? t('auth.status.claimSaved')
              : t('auth.status.noAnonymousCase')
          );
        } catch (error) {
          const claimError = normalizeM1Error(error);
          captureTelemetry({
            name: 'app_auth_claim_session_failed',
            severity: 'warning',
            route: '/auth',
            context: {
              code: claimError.code,
              hasSession: true,
            },
          });
          if (CLEAR_SESSION_ON_CLAIM_ERROR_CODES.has(claimError.code)) {
            await sessionStorage.clearSessionId();
            queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, null);
            setStatusText(t('auth.status.claimExpired'));
          } else {
            setStatusText(t('auth.status.claimFailed'));
          }
        }
      } else {
        setStatusText(t('auth.status.loggedIn'));
      }

      const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
      const pendingHref = await pendingLandingStorage.consumePendingHref();
      const resumeHref = getPostAuthResumeHref(nextParam) ?? getPostAuthResumeHref(pendingHref);

      return { auth, resumeHref };
    },
    onMutate: () => {
      setFormError(null);
      setStatusText(null);
    },
    onSuccess: ({ resumeHref }) => {
      router.replace((resumeHref ?? '/case') as Href);
    },
    onError: (error) => {
      setFormError(normalizeM1Error(error).message);
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearAppStorageWithPushCleanup,
    onSuccess: () => {
      queryClient.setQueryData(APP_AUTH_TOKEN_QUERY_KEY, null);
      queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, null);
      setStatusText(t('auth.status.cleared'));
    },
  });

  const canSubmit = isValidEmail(email) && password.length >= 8;

  return (
    <Screen
      eyebrow={t('auth.eyebrow')}
      title={t('auth.title')}
      subtitle={t('auth.subtitle')}
      action={(
        <LinkButton
          href="/"
          label={t('auth.home')}
          tone="neutral"
          testID="auth.home"
          variant="outline"
        />
      )}
      testID="auth.screen">
      <Panel title={t('auth.accountPanel')}>
        <View style={styles.segment}>
          <ActionButton
            label={t('auth.login')}
            onPress={() => setMode('login')}
            testID="auth.mode.login"
            tone={mode === 'login' ? 'teal' : 'neutral'}
            variant={mode === 'login' ? 'filled' : 'outline'}
          />
          <ActionButton
            label={t('auth.register')}
            onPress={() => setMode('register')}
            testID="auth.mode.register"
            tone={mode === 'register' ? 'teal' : 'neutral'}
            variant={mode === 'register' ? 'filled' : 'outline'}
          />
        </View>

        {mode === 'register' ? (
          <View style={styles.inputPreview}>
            <Text style={styles.inputLabel}>{t('auth.nickname.label')}</Text>
            <TextInput
              accessibilityLabel={t('auth.nickname.label')}
              accessibilityHint={t('auth.nickname.hint')}
              onChangeText={setNickname}
              placeholder={t('auth.nickname.placeholder')}
              placeholderTextColor={palette.muted}
              style={styles.inputText}
              testID="auth.nickname.input"
              value={nickname}
            />
          </View>
        ) : null}

        <View style={styles.inputPreview}>
          <Text style={styles.inputLabel}>{t('auth.email.label')}</Text>
          <TextInput
            accessibilityLabel={t('auth.email.label')}
            accessibilityHint={t('auth.email.hint')}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={palette.muted}
            style={styles.inputText}
            testID="auth.email.input"
            textContentType="emailAddress"
            value={email}
          />
          <Text style={styles.inputHelper}>
            {email && !isValidEmail(email)
              ? t('auth.email.invalid')
              : t('auth.email.helper')}
          </Text>
        </View>
        <View style={styles.inputPreview}>
          <Text style={styles.inputLabel}>{t('auth.password.label')}</Text>
          <TextInput
            accessibilityLabel={t('auth.password.label')}
            accessibilityHint={t('auth.password.hint')}
            autoCapitalize="none"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            autoCorrect={false}
            onChangeText={setPassword}
            placeholder={t('auth.password.placeholder')}
            placeholderTextColor={palette.muted}
            secureTextEntry
            style={styles.inputText}
            testID="auth.password.input"
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            value={password}
          />
          <Text style={styles.inputHelper}>
            {password.length < 8
              ? t('auth.password.needMore', { count: 8 - password.length })
              : t('auth.password.valid')}
          </Text>
        </View>
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
        <ActionButton
          disabled={!canSubmit}
          accessibilityHint={t('auth.submit.hint')}
          label={mode === 'login' ? t('auth.submit.login') : t('auth.submit.register')}
          loading={authMutation.isPending}
          onPress={() => authMutation.mutate()}
          testID="auth.submit"
          tone="teal"
        />
        <StatusPill label={t('auth.localSafe')} tone="amber" />
      </Panel>

      <Panel title={t('auth.afterPanel')}>
        <FeatureRow
          title={t('auth.safeSave.title')}
          detail={t('auth.safeSave.detail')}
          tone="teal"
        />
        <FeatureRow
          title={t('auth.claimQuick.title')}
          detail={t('auth.claimQuick.detail')}
          tone="blue"
        />
        <FeatureRow
          title={t('auth.logoutClean.title')}
          detail={t('auth.logoutClean.detail')}
          tone="coral"
        />
      </Panel>

      <View style={styles.actions}>
        <LinkButton href="/case" label={t('auth.enterApp')} tone="teal" testID="auth.app" />
        <ActionButton
          label={t('auth.clearLocal')}
          loading={clearMutation.isPending}
          onPress={() => clearMutation.mutate()}
          testID="auth.clear-local-session"
          tone="coral"
          variant="outline"
        />
        <LinkButton
          href="/"
          label={t('auth.skip')}
          tone="neutral"
          testID="auth.home.footer"
          variant="outline"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputPreview: {
    gap: spacing.xs,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputLabel: {
    ...typography.caption,
    color: palette.muted,
  },
  inputText: {
    ...typography.body,
    color: palette.ink,
    minHeight: 34,
    padding: 0,
  },
  inputHelper: {
    ...typography.small,
    color: palette.muted,
  },
  errorText: {
    ...typography.small,
    color: palette.coral,
  },
  statusText: {
    ...typography.small,
    color: palette.teal,
  },
  actions: {
    gap: spacing.sm,
  },
});
