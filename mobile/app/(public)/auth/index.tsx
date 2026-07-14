import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  getRegistrationPasswordErrorMessage,
  isValidAuthEmail,
} from '@/src/features/m1/authRegistration';
import { RegistrationVerificationStep } from '@/src/features/m1/RegistrationVerificationStep';
import { useAuthFlow } from '@/src/features/m1/useAuthFlow';
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

export default function AuthScreen() {
  useLocale();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const authFlow = useAuthFlow(nextParam);
  const {
    canSubmit,
    clearLocalSession,
    clearPending,
    completeVerification,
    email,
    formError,
    handleEmailChange,
    handleModeChange,
    handlePrimarySubmit,
    handleVerificationBack,
    handleVerificationResend,
    isAuthBusy,
    loginPending,
    mode,
    nickname,
    password,
    resendSecondsRemaining,
    setNickname,
    setPassword,
    setVerificationCode,
    statusText,
    verificationCode,
    verificationEmail,
    verificationPending,
    verificationPurpose,
    verificationSendPending,
  } = authFlow;

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
            disabled={isAuthBusy}
            label={t('auth.login')}
            onPress={() => handleModeChange('login')}
            testID="auth.mode.login"
            tone={mode === 'login' ? 'teal' : 'neutral'}
            variant={mode === 'login' ? 'filled' : 'outline'}
          />
          <ActionButton
            disabled={isAuthBusy}
            label={t('auth.register')}
            onPress={() => handleModeChange('register')}
            testID="auth.mode.register"
            tone={mode === 'register' ? 'teal' : 'neutral'}
            variant={mode === 'register' ? 'filled' : 'outline'}
          />
        </View>

        {verificationPurpose && verificationEmail ? (
          <>
            {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            <RegistrationVerificationStep
              code={verificationCode}
              email={verificationEmail}
              loading={verificationPending}
              onBack={handleVerificationBack}
              onChangeCode={setVerificationCode}
              onComplete={completeVerification}
              onResend={handleVerificationResend}
              purpose={verificationPurpose}
              resendSecondsRemaining={resendSecondsRemaining}
              resendLoading={verificationSendPending}
            />
          </>
        ) : (
          <>
            {mode === 'register' ? (
              <View style={styles.inputPreview}>
                <Text style={styles.inputLabel}>{t('auth.nickname.label')}</Text>
                <TextInput
                  accessibilityLabel={t('auth.nickname.label')}
                  accessibilityHint={t('auth.nickname.hint')}
                  editable={!isAuthBusy}
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
                editable={!isAuthBusy}
                keyboardType="email-address"
                onChangeText={handleEmailChange}
                placeholder="name@example.com"
                placeholderTextColor={palette.muted}
                style={styles.inputText}
                testID="auth.email.input"
                textContentType="emailAddress"
                value={email}
              />
              <Text style={styles.inputHelper}>
                {email && !isValidAuthEmail(email)
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
                editable={!isAuthBusy}
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
                {mode === 'register'
                  ? getRegistrationPasswordErrorMessage(password)
                    ?? t('auth.password.registrationValid')
                  : password.length < 8
                    ? t('auth.password.needMore', { count: 8 - password.length })
                    : t('auth.password.valid')}
              </Text>
            </View>
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
            <ActionButton
              accessibilityHint={
                mode === 'login'
                  ? t('auth.submit.hint')
                  : t('auth.submit.sendCode.hint')
              }
              disabled={!canSubmit}
              label={mode === 'login' ? t('auth.submit.login') : t('auth.submit.sendCode')}
              loading={mode === 'login'
                ? loginPending
                : verificationSendPending}
              onPress={handlePrimarySubmit}
              testID="auth.submit"
              tone="teal"
            />
          </>
        )}
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
          loading={clearPending}
          onPress={clearLocalSession}
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
