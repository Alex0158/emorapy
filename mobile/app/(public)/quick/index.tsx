import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { normalizeM1Error, m1Api } from '@/src/features/m1/api';
import { getOrCreateQuickSession } from '@/src/features/m1/session';
import { t } from '@/src/i18n';
import { sessionStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

const MIN_STATEMENT_LENGTH = 10;
const MAX_STATEMENT_LENGTH = 800;

function countTrimmedText(value: string): number {
  return value.trim().length;
}

function statementHelperText(value: string): string {
  const length = countTrimmedText(value);
  if (length < MIN_STATEMENT_LENGTH) {
    return t('quick.helper.needsMore', { count: MIN_STATEMENT_LENGTH - length });
  }
  return t('quick.helper.ready', { length, max: MAX_STATEMENT_LENGTH });
}

export default function QuickScreen() {
  const [plaintiffStatement, setPlaintiffStatement] = useState('');
  const [defendantStatement, setDefendantStatement] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const quickMutation = useMutation({
    mutationFn: async () => {
      const trimmedPlaintiff = plaintiffStatement.trim();
      const trimmedDefendant = defendantStatement.trim();

      if (trimmedPlaintiff.length < MIN_STATEMENT_LENGTH || trimmedDefendant.length < MIN_STATEMENT_LENGTH) {
        throw new Error(t('quick.error.minLength', { count: MIN_STATEMENT_LENGTH }));
      }

      const { session } = await getOrCreateQuickSession();

      const result = await m1Api.quick.createQuickCase({
        plaintiff_statement: trimmedPlaintiff,
        defendant_statement: trimmedDefendant,
      });
      await sessionStorage.setSessionId(result.session_id ?? session.session_id);
      return result;
    },
    onMutate: () => {
      setFormError(null);
    },
    onSuccess: (result) => {
      router.push(`/quick/result?caseId=${encodeURIComponent(result.case.id)}` as Href);
    },
    onError: (error) => {
      setFormError(normalizeM1Error(error).message);
    },
  });

  const canSubmit =
    countTrimmedText(plaintiffStatement) >= MIN_STATEMENT_LENGTH
    && countTrimmedText(defendantStatement) >= MIN_STATEMENT_LENGTH;

  return (
    <Screen
      eyebrow={t('quick.eyebrow')}
      title={t('quick.title')}
      subtitle={t('quick.subtitle')}
      action={
        <LinkButton
          href="/"
          label={t('common.home')}
          tone="neutral"
          testID="quick.home"
          variant="outline"
        />
      }
      testID="quick.screen">
      <Panel title={t('quick.inputPanel')}>
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>{t('quick.plaintiff.label')}</Text>
          <TextInput
            accessibilityLabel={t('quick.plaintiff.label')}
            accessibilityHint={t('quick.plaintiff.accessibilityHint')}
            maxLength={MAX_STATEMENT_LENGTH}
            multiline
            onChangeText={setPlaintiffStatement}
            placeholder={t('quick.plaintiff.placeholder')}
            placeholderTextColor={palette.muted}
            style={styles.textArea}
            testID="quick.plaintiff.input"
            textAlignVertical="top"
            value={plaintiffStatement}
          />
          <Text style={styles.fieldHelper} testID="quick.plaintiff.helper">
            {statementHelperText(plaintiffStatement)}
          </Text>
        </View>
        <View style={styles.inputGroupAlt}>
          <Text style={styles.fieldLabel}>{t('quick.defendant.label')}</Text>
          <TextInput
            accessibilityLabel={t('quick.defendant.label')}
            accessibilityHint={t('quick.defendant.accessibilityHint')}
            maxLength={MAX_STATEMENT_LENGTH}
            multiline
            onChangeText={setDefendantStatement}
            placeholder={t('quick.defendant.placeholder')}
            placeholderTextColor={palette.muted}
            style={styles.textArea}
            testID="quick.defendant.input"
            textAlignVertical="top"
            value={defendantStatement}
          />
          <Text style={styles.fieldHelper} testID="quick.defendant.helper">
            {statementHelperText(defendantStatement)}
          </Text>
        </View>
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <ActionButton
          accessibilityHint={t('quick.submit.accessibilityHint', { count: MIN_STATEMENT_LENGTH })}
          disabled={!canSubmit}
          label={t('quick.submit')}
          loading={quickMutation.isPending}
          onPress={() => quickMutation.mutate()}
          testID="quick.submit"
          tone="teal"
        />
      </Panel>

      <Panel title={t('quick.storagePanel')}>
        <StatusPill label={t('quick.storagePill')} tone="amber" />
        <FeatureRow
          title={t('quick.storage.anonymous.title')}
          detail={t('quick.storage.anonymous.detail')}
          tone="teal"
        />
        <FeatureRow
          title={t('quick.storage.recovery.title')}
          detail={t('quick.storage.recovery.detail')}
          tone="blue"
        />
        <FeatureRow
          title={t('quick.storage.login.title')}
          detail={t('quick.storage.login.detail')}
          tone="coral"
        />
      </Panel>

      <View style={styles.actions}>
        <LinkButton
          href="/quick/collaborative"
          label={t('quick.collaborative')}
          tone="blue"
          testID="quick.collaborative"
          variant="outline"
        />
        <LinkButton href="/auth" label={t('quick.auth')} tone="teal" testID="quick.auth" />
        <LinkButton
          href="/"
          label={t('common.home')}
          tone="neutral"
          testID="quick.home.footer"
          variant="outline"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    gap: spacing.xs,
    borderRadius: 8,
    backgroundColor: palette.panel,
    padding: spacing.md,
  },
  inputGroupAlt: {
    gap: spacing.xs,
    borderRadius: 8,
    backgroundColor: palette.mist,
    padding: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    color: palette.muted,
  },
  fieldHelper: {
    ...typography.small,
    color: palette.muted,
  },
  textArea: {
    ...typography.body,
    color: palette.ink,
    minHeight: 108,
    padding: 0,
  },
  errorText: {
    ...typography.small,
    color: palette.coral,
  },
  actions: {
    gap: spacing.sm,
  },
});
