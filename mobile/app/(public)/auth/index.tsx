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
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
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
        throw new Error('請輸入有效的電子郵件。');
      }
      if (password.length < 8) {
        throw new Error('密碼至少需要 8 個字元。');
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
          setStatusText(claim.case_id ? '已保存快速整理。' : '已登入，暫無可保存的匿名案件。');
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
            setStatusText('已登入，但匿名進度已過期或無法保存。你可以從案件與修復繼續。');
          } else {
            setStatusText('已登入，但匿名進度暫時無法保存。你可以稍後在 App 內重試。');
          }
        }
      } else {
        setStatusText('已登入。');
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
      setStatusText('這台裝置的登入狀態、快速整理和提醒通道已清理。');
    },
  });

  const canSubmit = isValidEmail(email) && password.length >= 8;

  return (
    <Screen
      eyebrow="帳號"
      title="保存你的進度"
      subtitle="登入後可以把匿名整理、案件和修復計畫放到同一個帳號下。"
      action={<LinkButton href="/" label="回到首頁" tone="neutral" testID="auth.home" variant="outline" />}
      testID="auth.screen">
      <Panel title="帳號資訊">
        <View style={styles.segment}>
          <ActionButton
            label="登入"
            onPress={() => setMode('login')}
            testID="auth.mode.login"
            tone={mode === 'login' ? 'teal' : 'neutral'}
            variant={mode === 'login' ? 'filled' : 'outline'}
          />
          <ActionButton
            label="註冊"
            onPress={() => setMode('register')}
            testID="auth.mode.register"
            tone={mode === 'register' ? 'teal' : 'neutral'}
            variant={mode === 'register' ? 'filled' : 'outline'}
          />
        </View>

        {mode === 'register' ? (
          <View style={styles.inputPreview}>
            <Text style={styles.inputLabel}>暱稱</Text>
            <TextInput
              accessibilityLabel="暱稱"
              accessibilityHint="輸入你希望 App 顯示的稱呼"
              onChangeText={setNickname}
              placeholder="你想被怎麼稱呼"
              placeholderTextColor={palette.muted}
              style={styles.inputText}
              testID="auth.nickname.input"
              value={nickname}
            />
          </View>
        ) : null}

        <View style={styles.inputPreview}>
          <Text style={styles.inputLabel}>電子郵件</Text>
          <TextInput
            accessibilityLabel="電子郵件"
            accessibilityHint="輸入登入或註冊使用的電子郵件"
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
            {email && !isValidEmail(email) ? '請確認電子郵件格式。' : '用來保存你的案件與修復進度。'}
          </Text>
        </View>
        <View style={styles.inputPreview}>
          <Text style={styles.inputLabel}>密碼</Text>
          <TextInput
            accessibilityLabel="密碼"
            accessibilityHint="輸入至少八個字元的密碼"
            autoCapitalize="none"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            autoCorrect={false}
            onChangeText={setPassword}
            placeholder="至少 8 個字元"
            placeholderTextColor={palette.muted}
            secureTextEntry
            style={styles.inputText}
            testID="auth.password.input"
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            value={password}
          />
          <Text style={styles.inputHelper}>
            {password.length < 8 ? `還需要 ${8 - password.length} 個字元。` : '密碼長度符合要求。'}
          </Text>
        </View>
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
        <ActionButton
          disabled={!canSubmit}
          accessibilityHint="電子郵件格式有效且密碼至少八個字元後提交"
          label={mode === 'login' ? '登入並保存' : '註冊並保存'}
          loading={authMutation.isPending}
          onPress={() => authMutation.mutate()}
          testID="auth.submit"
          tone="teal"
        />
        <StatusPill label="本機安全保存" tone="amber" />
      </Panel>

      <Panel title="登入後會做的事">
        <FeatureRow title="安全保存" detail="登入狀態只保存在這台裝置。" tone="teal" />
        <FeatureRow title="承接快速整理" detail="如果剛做過快速整理，會嘗試收進你的帳號。" tone="blue" />
        <FeatureRow title="登出清理" detail="登出時會先關閉本機提醒，再清除登入狀態。" tone="coral" />
      </Panel>

      <View style={styles.actions}>
        <LinkButton href="/case" label="進入案件與修復" tone="teal" testID="auth.app" />
        <ActionButton
          label="清理本機會話"
          loading={clearMutation.isPending}
          onPress={() => clearMutation.mutate()}
          testID="auth.clear-local-session"
          tone="coral"
          variant="outline"
        />
        <LinkButton href="/" label="暫不登入" tone="neutral" testID="auth.home.footer" variant="outline" />
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
