import { StyleSheet, Text, TextInput, View } from 'react-native';

import { t } from '@/src/i18n';
import { ActionButton } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

import { sanitizeVerificationCode } from './authRegistration';

interface RegistrationVerificationStepProps {
  code: string;
  email: string;
  loading: boolean;
  purpose: 'register' | 'verify_email';
  resendSecondsRemaining: number;
  resendLoading: boolean;
  onBack: () => void;
  onChangeCode: (code: string) => void;
  onComplete: () => void;
  onResend: () => void;
}

const VERIFICATION_TEST_IDS = {
  register: {
    back: 'auth.registration.back',
    codeInput: 'auth.registration.code.input',
    complete: 'auth.registration.complete',
    resend: 'auth.registration.resend',
    root: 'auth.registration.verification',
  },
  verify_email: {
    back: 'auth.login-verification.back',
    codeInput: 'auth.login-verification.code.input',
    complete: 'auth.login-verification.complete',
    resend: 'auth.login-verification.resend',
    root: 'auth.login-verification.verification',
  },
} as const;

export function RegistrationVerificationStep({
  code,
  email,
  loading,
  purpose,
  resendSecondsRemaining,
  resendLoading,
  onBack,
  onChangeCode,
  onComplete,
  onResend,
}: RegistrationVerificationStepProps) {
  const busy = loading || resendLoading;
  const isRegistration = purpose === 'register';
  const testIds = VERIFICATION_TEST_IDS[purpose];

  return (
    <View style={styles.container} testID={testIds.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.verification.title')}</Text>
        <Text style={styles.detail}>{t('auth.verification.sentTo', { email })}</Text>
      </View>

      <View style={styles.inputPreview}>
        <Text style={styles.inputLabel}>{t('auth.verification.code.label')}</Text>
        <TextInput
          accessibilityLabel={t('auth.verification.code.label')}
          accessibilityHint={t('auth.verification.code.hint')}
          autoComplete="one-time-code"
          autoCorrect={false}
          editable={!busy}
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => onChangeCode(sanitizeVerificationCode(value))}
          placeholder={t('auth.verification.code.placeholder')}
          placeholderTextColor={palette.muted}
          style={styles.inputText}
          testID={testIds.codeInput}
          textContentType="oneTimeCode"
          value={code}
        />
        <Text style={styles.inputHelper}>
          {t(isRegistration
            ? 'auth.verification.code.helper'
            : 'auth.verification.code.existingHelper')}
        </Text>
      </View>

      <ActionButton
        accessibilityHint={t(isRegistration
          ? 'auth.verification.complete.hint'
          : 'auth.verification.completeExisting.hint')}
        disabled={code.length !== 6 || resendLoading}
        label={t(isRegistration
          ? 'auth.verification.complete'
          : 'auth.verification.completeExisting')}
        loading={loading}
        onPress={onComplete}
        testID={testIds.complete}
        tone="teal"
      />

      <View style={styles.secondaryActions}>
        <ActionButton
          disabled={loading || resendSecondsRemaining > 0}
          label={resendSecondsRemaining > 0
            ? t('auth.verification.resendCountdown', { count: resendSecondsRemaining })
            : t('auth.verification.resend')}
          loading={resendLoading}
          onPress={onResend}
          testID={testIds.resend}
          tone="blue"
          variant="outline"
        />
        <ActionButton
          disabled={busy}
          label={t('auth.verification.back')}
          onPress={onBack}
          testID={testIds.back}
          tone="neutral"
          variant="outline"
        />
      </View>

      <Text style={styles.privacyNote}>{t('auth.verification.privacy')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.section,
    color: palette.ink,
  },
  detail: {
    ...typography.small,
    color: palette.muted,
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
  secondaryActions: {
    gap: spacing.sm,
  },
  privacyNote: {
    ...typography.small,
    color: palette.muted,
  },
});
