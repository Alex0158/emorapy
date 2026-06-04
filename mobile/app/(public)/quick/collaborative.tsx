import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { normalizeM1Error, m1Api } from '@/src/features/m1/api';
import { getOrCreateQuickSession } from '@/src/features/m1/session';
import { t, useLocale } from '@/src/i18n';
import { sessionStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

type CollaborativePhase = 'roleA' | 'roleB';

const ROLE_A_MIN_LENGTH = 30;
const ROLE_B_MIN_LENGTH = 10;

export default function QuickCollaborativeScreen() {
  useLocale();
  const [phase, setPhase] = useState<CollaborativePhase>('roleA');
  const [caseId, setCaseId] = useState<string | null>(null);
  const [roleAStatement, setRoleAStatement] = useState('');
  const [roleBStatement, setRoleBStatement] = useState('');
  const [statusText, setStatusText] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const collaborativeMutation = useMutation({
    mutationFn: async () => {
      const roleATrimmed = roleAStatement.trim();
      const roleBTrimmed = roleBStatement.trim();

      if (phase === 'roleA') {
        if (roleATrimmed.length < ROLE_A_MIN_LENGTH) {
          throw new Error(
            t('quick.collaborative.error.roleA.minLength', { count: ROLE_A_MIN_LENGTH })
          );
        }

        const { session } = await getOrCreateQuickSession();

        return m1Api.quick.createCollaborativeCase(
          { plaintiff_statement: roleATrimmed },
          session.session_id
        );
      }

      if (!caseId) {
        throw new Error(t('quick.collaborative.error.missingCase'));
      }
      if (roleBTrimmed.length < ROLE_B_MIN_LENGTH) {
        throw new Error(
          t('quick.collaborative.error.roleB.minLength', { count: ROLE_B_MIN_LENGTH })
        );
      }

      const sessionId = await sessionStorage.getSessionId();
      if (!sessionId) {
        throw new Error(t('quick.collaborative.error.missingSession'));
      }
      return m1Api.quick.createCollaborativeCase(
        {
          case_id: caseId,
          defendant_statement: roleBTrimmed,
        },
        sessionId
      );
    },
    onMutate: () => {
      setFormError(null);
      setStatusText(null);
    },
    onSuccess: async (result) => {
      await sessionStorage.setSessionId(result.session_id);
      if (result.phase === 'a_done') {
        setCaseId(result.case.id);
        setPhase('roleB');
        setStatusText(t('quick.collaborative.status.roleARecorded'));
        return;
      }

      router.push(`/quick/result?caseId=${encodeURIComponent(result.case.id)}` as Href);
    },
    onError: (error) => {
      setFormError(normalizeM1Error(error).message);
    },
  });

  const isRoleA = phase === 'roleA';
  const canSubmit = isRoleA
    ? roleAStatement.trim().length >= ROLE_A_MIN_LENGTH
    : Boolean(caseId) && roleBStatement.trim().length >= ROLE_B_MIN_LENGTH;

  return (
    <Screen
      eyebrow={t('quick.eyebrow')}
      title={t('quick.collaborative.title')}
      subtitle={t('quick.collaborative.subtitle')}
      testID="quick.collaborative.screen">
      <Panel
        title={isRoleA ? t('quick.collaborative.roleA.panel') : t('quick.collaborative.roleB.panel')}>
        <StatusPill
          label={isRoleA ? t('quick.collaborative.step1') : t('quick.collaborative.step2')}
          tone={isRoleA ? 'teal' : 'blue'}
        />
        {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>
            {isRoleA ? t('quick.collaborative.roleA.label') : t('quick.collaborative.roleB.label')}
          </Text>
          <TextInput
            accessibilityLabel={
              isRoleA ? t('quick.collaborative.roleA.label') : t('quick.collaborative.roleB.label')
            }
            accessibilityHint={isRoleA
              ? t('quick.collaborative.roleA.accessibilityHint')
              : t('quick.collaborative.roleB.accessibilityHint')}
            multiline
            onChangeText={isRoleA ? setRoleAStatement : setRoleBStatement}
            placeholder={isRoleA
              ? t('quick.collaborative.roleA.placeholder')
              : t('quick.collaborative.roleB.placeholder')}
            placeholderTextColor={palette.muted}
            style={styles.textArea}
            textAlignVertical="top"
            value={isRoleA ? roleAStatement : roleBStatement}
          />
        </View>
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <ActionButton
          disabled={!canSubmit}
          label={
            isRoleA
              ? t('quick.collaborative.roleA.submit')
              : t('quick.collaborative.roleB.submit')
          }
          loading={collaborativeMutation.isPending}
          onPress={() => collaborativeMutation.mutate()}
          tone={isRoleA ? 'teal' : 'blue'}
        />
      </Panel>

      <Panel title={t('quick.collaborative.boundary.panel')}>
        <FeatureRow
          title={t('quick.collaborative.boundary.sameDevice.title')}
          detail={t('quick.collaborative.boundary.sameDevice.detail')}
          tone="teal"
        />
        <FeatureRow
          title={t('quick.collaborative.boundary.notFormal.title')}
          detail={t('quick.collaborative.boundary.notFormal.detail')}
          tone="blue"
        />
        <FeatureRow
          title={t('quick.collaborative.boundary.noOverwrite.title')}
          detail={t('quick.collaborative.boundary.noOverwrite.detail')}
          tone="coral"
        />
      </Panel>

      <View style={styles.actions}>
        <LinkButton
          href="/quick"
          label={t('quick.collaborative.singleMode')}
          tone="neutral"
          variant="outline"
        />
        <LinkButton href="/" label={t('common.home')} tone="neutral" variant="outline" />
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
  fieldLabel: {
    ...typography.caption,
    color: palette.muted,
  },
  textArea: {
    ...typography.body,
    color: palette.ink,
    minHeight: 132,
    padding: 0,
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
