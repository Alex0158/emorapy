import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Judgment } from '@cj/api-client';
import type { CaseStatus } from '@cj/contracts/case';

import { m4Api, normalizeM4Error } from '@/src/features/m4/api';
import { m5Api, normalizeM5Error } from '@/src/features/m5/api';
import { getLocale, t, useLocale } from '@/src/i18n';
import { createEvidenceUploadFormData, pickImage } from '@/src/platform/upload/native';
import { tokenStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

const evidenceUploadableStatuses = new Set(['draft', 'submitted', 'in_progress']);
const MIN_FORMAL_CASE_STATEMENT_LENGTH = 30;
const MAX_FORMAL_CASE_STATEMENT_LENGTH = 1200;
const MAX_PAIRING_INVITE_CODE_LENGTH = 32;

const pairingStatusLabelKeys: Record<'pending' | 'active' | 'cancelled' | 'temp', string> = {
  pending: 'case.pairing.pending',
  active: 'case.pairing.active',
  cancelled: 'case.pairing.cancelled',
  temp: 'case.pairing.temp',
};

const caseStatusLabelKeys: Record<CaseStatus, string> = {
  draft: 'case.status.draft',
  submitted: 'case.status.submitted',
  in_progress: 'case.status.inProgress',
  completed: 'case.status.completed',
  cancelled: 'case.status.cancelled',
  judgment_failed: 'case.status.analysisFailed',
};

interface EvidenceUploadResult {
  cancelled: boolean;
  count: number;
}

interface EvidenceSafetyState {
  noIllegalOrNonconsensual: boolean;
  containsMinor: boolean;
  minorGuardianOrSelfConfirmed: boolean;
  containsSensitiveContent: boolean;
  sensitiveContentHandlingAck: boolean;
}

const initialEvidenceSafety: EvidenceSafetyState = {
  noIllegalOrNonconsensual: false,
  containsMinor: false,
  minorGuardianOrSelfConfirmed: false,
  containsSensitiveContent: false,
  sensitiveContentHandlingAck: false,
};

function buildEvidenceSafetyAssertion(safety: EvidenceSafetyState) {
  return {
    contains_illegal_content: false,
    contains_minor: safety.containsMinor,
    contains_nonconsensual_content: false,
    contains_sensitive_content: safety.containsSensitiveContent,
    minor_guardian_or_self_upload_confirmed: safety.containsMinor
      ? safety.minorGuardianOrSelfConfirmed
      : false,
    sensitive_content_handling_ack: safety.containsSensitiveContent
      ? safety.sensitiveContentHandlingAck
      : false,
  };
}

function validateEvidenceSafety(safety: EvidenceSafetyState): string | null {
  if (!safety.noIllegalOrNonconsensual) {
    return t('case.evidence.error.blocked');
  }
  if (safety.containsMinor && !safety.minorGuardianOrSelfConfirmed) {
    return t('case.evidence.error.minor');
  }
  if (safety.containsSensitiveContent && !safety.sensitiveContentHandlingAck) {
    return t('case.evidence.error.sensitive');
  }
  return null;
}

function labelPairingStatus(status?: 'pending' | 'active' | 'cancelled' | 'temp' | null): string {
  return status ? t(pairingStatusLabelKeys[status]) : t('case.pairing.none');
}

function labelCaseStatus(status?: CaseStatus | null): string {
  return status ? t(caseStatusLabelKeys[status]) : t('case.status.updating');
}

function labelCaseTitle(item: { title?: string | null; type?: string | null }): string {
  return item.title || item.type || t('case.titleFallback');
}

function labelCaseCreatedAt(value?: string | null): string {
  if (!value) return t('case.createdAt.unsynced');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('case.createdAt.unsynced');
  const formattedDate = new Intl.DateTimeFormat(getLocale() === 'en-US' ? 'en-US' : 'zh-Hant', {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
  return t('case.createdAt.prefix', { date: formattedDate });
}

function countTrimmedText(value: string): number {
  return value.trim().length;
}

function formalCaseStatementHelperText(value: string): string {
  const length = countTrimmedText(value);
  if (length < MIN_FORMAL_CASE_STATEMENT_LENGTH) {
    return t('case.statement.needMore', { count: MIN_FORMAL_CASE_STATEMENT_LENGTH - length });
  }
  return t('case.statement.ready', { length, max: MAX_FORMAL_CASE_STATEMENT_LENGTH });
}

function optionalStatementHelperText(value: string): string {
  const length = countTrimmedText(value);
  if (!length) return t('case.optional.empty');
  return t('case.optional.ready', { length, max: MAX_FORMAL_CASE_STATEMENT_LENGTH });
}

function inviteCodeHelperText(value: string): string {
  return value.trim() ? t('case.inviteHelper.ready') : t('case.inviteHelper.empty');
}

function SafetyToggle({
  checked,
  label,
  onPress,
  testID,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.safetyToggle, { opacity: pressed ? 0.75 : 1 }]}
      testID={testID}>
      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <Text style={styles.safetyToggleLabel}>{label}</Text>
    </Pressable>
  );
}

export default function CaseScreen() {
  useLocale();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState('');
  const [plaintiffStatement, setPlaintiffStatement] = useState('');
  const [defendantStatement, setDefendantStatement] = useState('');
  const [latestJudgment, setLatestJudgment] = useState<Judgment | null>(null);
  const [evidenceSafety, setEvidenceSafety] = useState<EvidenceSafetyState>(initialEvidenceSafety);
  const [evidenceUploadNotice, setEvidenceUploadNotice] = useState<string | null>(null);

  const authQuery = useQuery({
    queryKey: ['app', 'auth-token'],
    queryFn: () => tokenStorage.getToken(),
  });
  const isAuthenticated = Boolean(authQuery.data);

  const pairingQuery = useQuery({
    queryKey: ['m4', 'pairing-status'],
    queryFn: () => m4Api.pairing.getStatus(),
    enabled: isAuthenticated,
  });

  const casesQuery = useQuery({
    queryKey: ['m4', 'case-list'],
    queryFn: () => m4Api.cases.list({ page_size: 10 }),
    enabled: isAuthenticated,
  });

  const refreshM4 = async () => {
    await queryClient.invalidateQueries({ queryKey: ['m4'] });
  };

  const createPairingMutation = useMutation({
    mutationFn: () => m4Api.pairing.create(),
    onSuccess: refreshM4,
  });
  const joinPairingMutation = useMutation({
    mutationFn: () => m4Api.pairing.join(inviteCode.trim()),
    onSuccess: async () => {
      setInviteCode('');
      await refreshM4();
    },
  });
  const cancelPairingMutation = useMutation({
    mutationFn: () => m4Api.pairing.cancel(),
    onSuccess: refreshM4,
  });
  const createCaseMutation = useMutation({
    mutationFn: () => {
      const pairingId = pairingQuery.data?.id;
      if (!pairingId) throw new Error(t('case.error.missingPartnerLink'));
      return m4Api.cases.create({
        pairing_id: pairingId,
        plaintiff_statement: plaintiffStatement.trim(),
        defendant_statement: defendantStatement.trim() || undefined,
        mode: 'remote',
      });
    },
    onSuccess: async () => {
      setPlaintiffStatement('');
      setDefendantStatement('');
      await refreshM4();
    },
  });
  const submitCaseMutation = useMutation({
    mutationFn: (caseId: string) => m4Api.cases.submit(caseId),
    onSuccess: refreshM4,
  });
  const generateJudgmentMutation = useMutation({
    mutationFn: (caseId: string) => m4Api.judgment.generate(caseId),
    onSuccess: async (judgment) => {
      setLatestJudgment(judgment);
      await refreshM4();
    },
  });
  const acceptJudgmentMutation = useMutation({
    mutationFn: (judgmentId: string) => m4Api.judgment.accept(judgmentId, { accepted: true, rating: 5 }),
    onSuccess: async (judgment) => {
      setLatestJudgment(judgment);
      await refreshM4();
      router.push(`/repair?judgmentId=${encodeURIComponent(judgment.id)}` as Href);
    },
  });
  const uploadEvidenceMutation = useMutation<EvidenceUploadResult, unknown, string>({
    mutationFn: async (caseId: string) => {
      const safetyError = validateEvidenceSafety(evidenceSafety);
      if (safetyError) throw new Error(safetyError);

      const asset = await pickImage({ allowsEditing: false, quality: 0.82 });
      if (!asset) return { cancelled: true, count: 0 };

      const formData = createEvidenceUploadFormData([asset], {
        safetyAssertion: buildEvidenceSafetyAssertion(evidenceSafety),
      });
      const evidences = await m5Api.media.uploadEvidence(caseId, formData);
      return { cancelled: false, count: evidences.length };
    },
    onSuccess: async (result, caseId) => {
      if (result.cancelled) {
        setEvidenceUploadNotice(t('case.upload.cancelled'));
        return;
      }

      if (result.count === 0) {
        setEvidenceUploadNotice(t('case.upload.empty'));
        return;
      }

      captureTelemetry({
        name: 'case_evidence_upload_success',
        route: '/case',
        context: {
          caseId,
        },
      });
      setEvidenceUploadNotice(t('case.upload.success', { count: result.count }));
      await refreshM4();
    },
    onError: (error) => {
      setEvidenceUploadNotice(null);
      captureTelemetry({
        name: 'case_evidence_upload_error',
        severity: 'error',
        route: '/case',
        context: {
          code: normalizeM5Error(error).code,
        },
      });
    },
  });

  const errorMessage = pairingQuery.error
    ? normalizeM4Error(pairingQuery.error).message
    : casesQuery.error
      ? normalizeM4Error(casesQuery.error).message
      : createPairingMutation.error
        ? normalizeM4Error(createPairingMutation.error).message
        : joinPairingMutation.error
          ? normalizeM4Error(joinPairingMutation.error).message
          : cancelPairingMutation.error
            ? normalizeM4Error(cancelPairingMutation.error).message
            : createCaseMutation.error
              ? normalizeM4Error(createCaseMutation.error).message
              : submitCaseMutation.error
                ? normalizeM4Error(submitCaseMutation.error).message
                : generateJudgmentMutation.error
                  ? normalizeM4Error(generateJudgmentMutation.error).message
                  : acceptJudgmentMutation.error
                    ? normalizeM4Error(acceptJudgmentMutation.error).message
                    : uploadEvidenceMutation.error
                      ? normalizeM5Error(uploadEvidenceMutation.error).message
                    : null;

  const canCreateCase =
    Boolean(pairingQuery.data?.id)
    && countTrimmedText(plaintiffStatement) >= MIN_FORMAL_CASE_STATEMENT_LENGTH;
  const evidenceSafetyError = validateEvidenceSafety(evidenceSafety);
  const canUploadEvidence = !evidenceSafetyError;
  const updateEvidenceSafety = (patch: Partial<EvidenceSafetyState>) => {
    setEvidenceUploadNotice(null);
    setEvidenceSafety((current) => ({ ...current, ...patch }));
  };

  if (!isAuthenticated) {
    return (
      <Screen
        eyebrow={t('case.eyebrow')}
        title={t('case.authGate.title')}
        subtitle={t('case.authGate.subtitle')}
        testID="case.auth-gate.screen">
        <Panel title={t('case.authGate.panel')}>
          <FeatureRow title={t('case.authGate.noAnonymous.title')} detail={t('case.authGate.noAnonymous.detail')} tone="teal" />
          <FeatureRow title={t('case.authGate.quick.title')} detail={t('case.authGate.quick.detail')} tone="blue" />
        </Panel>
        <LinkButton href="/auth" label={t('profile.authGate.login')} tone="teal" testID="case.auth-gate.login" />
        <LinkButton href="/quick" label={t('case.authGate.quick')} tone="blue" testID="case.auth-gate.quick" variant="outline" />
      </Screen>
    );
  }

  return (
    <Screen eyebrow={t('case.eyebrow')} title={t('case.title')} subtitle={t('case.subtitle')} testID="case.screen">
      <Panel title={t('case.partnerPanel')}>
        <StatusPill label={labelPairingStatus(pairingQuery.data?.status)} tone={pairingQuery.data ? 'teal' : 'amber'} />
        {pairingQuery.data?.invite_code ? (
          <Text style={styles.inviteCode}>{pairingQuery.data.invite_code}</Text>
        ) : null}
        <View style={styles.actions}>
          <ActionButton
            label={t('case.createPartnerLink')}
            loading={createPairingMutation.isPending}
            onPress={() => createPairingMutation.mutate()}
            testID="case.create-pairing"
            tone="teal"
          />
          <TextInput
            accessibilityLabel={t('case.inviteCode.label')}
            accessibilityHint={t('case.inviteCode.hint')}
            autoCapitalize="characters"
            maxLength={MAX_PAIRING_INVITE_CODE_LENGTH}
            onChangeText={setInviteCode}
            placeholder={t('case.inviteCode.placeholder')}
            placeholderTextColor={palette.muted}
            style={styles.input}
            testID="case.invite-code.input"
            value={inviteCode}
          />
          <Text style={styles.fieldHelper} testID="case.invite-code.helper">
            {inviteCodeHelperText(inviteCode)}
          </Text>
          <ActionButton
            disabled={!inviteCode.trim()}
            accessibilityHint={t('case.inviteCode.joinHint')}
            label={t('case.joinPartnerLink')}
            loading={joinPairingMutation.isPending}
            onPress={() => joinPairingMutation.mutate()}
            testID="case.join-pairing"
            tone="blue"
            variant="outline"
          />
          {pairingQuery.data ? (
            <ActionButton
              label={t('case.cancelPartnerLink')}
              loading={cancelPairingMutation.isPending}
              onPress={() => cancelPairingMutation.mutate()}
              testID="case.cancel-pairing"
              tone="neutral"
              variant="outline"
            />
          ) : null}
        </View>
      </Panel>

      <Panel title={t('case.createPanel')}>
        <TextInput
          accessibilityLabel={t('case.plaintiff.label')}
          accessibilityHint={t('case.plaintiff.hint')}
          maxLength={MAX_FORMAL_CASE_STATEMENT_LENGTH}
          multiline
          onChangeText={setPlaintiffStatement}
          placeholder={t('case.plaintiff.placeholder')}
          placeholderTextColor={palette.muted}
          style={styles.textArea}
          testID="case.plaintiff-statement.input"
          textAlignVertical="top"
          value={plaintiffStatement}
        />
        <Text style={styles.fieldHelper} testID="case.plaintiff-statement.helper">
          {formalCaseStatementHelperText(plaintiffStatement)}
        </Text>
        <TextInput
          accessibilityLabel={t('case.defendant.label')}
          accessibilityHint={t('case.defendant.hint')}
          maxLength={MAX_FORMAL_CASE_STATEMENT_LENGTH}
          multiline
          onChangeText={setDefendantStatement}
          placeholder={t('case.defendant.placeholder')}
          placeholderTextColor={palette.muted}
          style={styles.textAreaAlt}
          testID="case.defendant-statement.input"
          textAlignVertical="top"
          value={defendantStatement}
        />
        <Text style={styles.fieldHelper} testID="case.defendant-statement.helper">
          {optionalStatementHelperText(defendantStatement)}
        </Text>
        <ActionButton
          accessibilityHint={t('case.createHint', { count: MIN_FORMAL_CASE_STATEMENT_LENGTH })}
          disabled={!canCreateCase}
          label={t('case.createCase')}
          loading={createCaseMutation.isPending}
          onPress={() => createCaseMutation.mutate()}
          testID="case.create-case"
          tone="teal"
        />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      <Panel title={t('case.evidencePanel')}>
        <Text style={styles.safetyIntro}>
          {t('case.evidenceIntro')}
        </Text>
        <SafetyToggle
          checked={evidenceSafety.noIllegalOrNonconsensual}
          label={t('case.evidence.noBlocked')}
          onPress={() => updateEvidenceSafety({
            noIllegalOrNonconsensual: !evidenceSafety.noIllegalOrNonconsensual,
          })}
          testID="case.evidence-safety.no-blocked.toggle"
        />
        <SafetyToggle
          checked={evidenceSafety.containsMinor}
          label={t('case.evidence.containsMinor')}
          onPress={() => updateEvidenceSafety({
            containsMinor: !evidenceSafety.containsMinor,
            minorGuardianOrSelfConfirmed: evidenceSafety.containsMinor
              ? false
              : evidenceSafety.minorGuardianOrSelfConfirmed,
          })}
          testID="case.evidence-safety.contains-minor.toggle"
        />
        {evidenceSafety.containsMinor ? (
          <SafetyToggle
            checked={evidenceSafety.minorGuardianOrSelfConfirmed}
            label={t('case.evidence.minorConfirm')}
            onPress={() => updateEvidenceSafety({
              minorGuardianOrSelfConfirmed: !evidenceSafety.minorGuardianOrSelfConfirmed,
            })}
            testID="case.evidence-safety.minor-confirm.toggle"
          />
        ) : null}
        <SafetyToggle
          checked={evidenceSafety.containsSensitiveContent}
          label={t('case.evidence.containsSensitive')}
          onPress={() => updateEvidenceSafety({
            containsSensitiveContent: !evidenceSafety.containsSensitiveContent,
            sensitiveContentHandlingAck: evidenceSafety.containsSensitiveContent
              ? false
              : evidenceSafety.sensitiveContentHandlingAck,
          })}
          testID="case.evidence-safety.contains-sensitive.toggle"
        />
        {evidenceSafety.containsSensitiveContent ? (
          <SafetyToggle
            checked={evidenceSafety.sensitiveContentHandlingAck}
            label={t('case.evidence.sensitiveAck')}
            onPress={() => updateEvidenceSafety({
              sensitiveContentHandlingAck: !evidenceSafety.sensitiveContentHandlingAck,
            })}
            testID="case.evidence-safety.sensitive-ack.toggle"
          />
        ) : null}
        {evidenceSafetyError ? <Text style={styles.safetyWarning}>{evidenceSafetyError}</Text> : null}
        {evidenceUploadNotice ? <Text style={styles.successText}>{evidenceUploadNotice}</Text> : null}
      </Panel>

      <Panel title={t('case.listPanel')}>
        {(casesQuery.data?.cases ?? []).slice(0, 5).map((item) => (
          <View key={item.id} style={styles.caseCard}>
            <View style={styles.caseHeader}>
              <Text style={styles.caseTitle}>{labelCaseTitle(item)}</Text>
              <StatusPill label={labelCaseStatus(item.status)} tone="blue" />
            </View>
            <Text
              accessibilityLabel={labelCaseCreatedAt(item.created_at)}
              style={styles.caseMeta}
              testID={`case.item.${item.id}.created-at`}>
              {labelCaseCreatedAt(item.created_at)}
            </Text>
            <View style={styles.actions}>
              {item.status === 'draft' ? (
                <ActionButton
                  label={t('case.submitCase')}
                  loading={submitCaseMutation.isPending}
                  onPress={() => submitCaseMutation.mutate(item.id)}
                  testID={`case.item.${item.id}.submit`}
                  tone="blue"
                  variant="outline"
                />
              ) : null}
              {evidenceUploadableStatuses.has(item.status) ? (
                <ActionButton
                  disabled={!canUploadEvidence}
                  label={t('case.uploadEvidence')}
                  loading={uploadEvidenceMutation.isPending}
                  onPress={() => uploadEvidenceMutation.mutate(item.id)}
                  testID={`case.item.${item.id}.upload-evidence`}
                  tone="teal"
                  variant="outline"
                />
              ) : null}
              <ActionButton
                label={t('case.generateAnalysis')}
                loading={generateJudgmentMutation.isPending}
                onPress={() => generateJudgmentMutation.mutate(item.id)}
                testID={`case.item.${item.id}.generate-judgment`}
                tone="coral"
                variant="outline"
              />
            </View>
          </View>
        ))}
        {casesQuery.data?.cases?.length ? null : (
          <Text style={styles.emptyText}>{t('case.empty')}</Text>
        )}
      </Panel>

      {latestJudgment ? (
        <Panel title={t('case.latestAnalysisPanel')}>
          <StatusPill label={`${latestJudgment.plaintiff_ratio}:${latestJudgment.defendant_ratio}`} tone="coral" />
          <Text style={styles.judgmentText}>{latestJudgment.summary || latestJudgment.judgment_content}</Text>
          <ActionButton
            label={t('case.acceptAnalysis')}
            loading={acceptJudgmentMutation.isPending}
            onPress={() => acceptJudgmentMutation.mutate(latestJudgment.id)}
            testID="case.accept-judgment"
            tone="teal"
          />
          <LinkButton
            href={`/repair?judgmentId=${encodeURIComponent(latestJudgment.id)}`}
            label={t('case.repair')}
            tone="coral"
            testID="case.repair"
            variant="outline"
          />
        </Panel>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inviteCode: {
    ...typography.hero,
    color: palette.ink,
  },
  input: {
    ...typography.body,
    color: palette.ink,
    minHeight: 44,
    padding: 0,
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
  textAreaAlt: {
    ...typography.body,
    color: palette.ink,
    minHeight: 88,
    padding: 0,
  },
  actions: {
    gap: spacing.sm,
  },
  caseCard: {
    gap: spacing.sm,
    borderRadius: 8,
    backgroundColor: palette.panel,
    padding: spacing.md,
  },
  caseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  caseTitle: {
    ...typography.bodyStrong,
    color: palette.ink,
    flex: 1,
  },
  caseMeta: {
    ...typography.caption,
    color: palette.muted,
  },
  judgmentText: {
    ...typography.body,
    color: palette.ink,
  },
  emptyText: {
    ...typography.small,
    color: palette.muted,
  },
  errorText: {
    ...typography.small,
    color: palette.coral,
  },
  safetyIntro: {
    ...typography.small,
    color: palette.muted,
  },
  safetyToggle: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    marginTop: 1,
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: palette.teal,
    borderColor: palette.teal,
  },
  checkboxMark: {
    ...typography.caption,
    color: palette.surface,
  },
  safetyToggleLabel: {
    ...typography.body,
    color: palette.ink,
    flex: 1,
  },
  safetyWarning: {
    ...typography.small,
    color: palette.amber,
  },
  successText: {
    ...typography.small,
    color: palette.teal,
  },
});
