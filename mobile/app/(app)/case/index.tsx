import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Judgment } from '@cj/api-client';
import type { CaseStatus } from '@cj/contracts/case';

import { m4Api, normalizeM4Error } from '@/src/features/m4/api';
import { m5Api, normalizeM5Error } from '@/src/features/m5/api';
import { createEvidenceUploadFormData, pickImage } from '@/src/platform/upload/native';
import { tokenStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

const evidenceUploadableStatuses = new Set(['draft', 'submitted', 'in_progress']);
const MIN_FORMAL_CASE_STATEMENT_LENGTH = 30;
const MAX_FORMAL_CASE_STATEMENT_LENGTH = 1200;
const MAX_PAIRING_INVITE_CODE_LENGTH = 32;
const caseCreatedDateFormatter = new Intl.DateTimeFormat('zh-Hant', {
  day: 'numeric',
  month: 'numeric',
  timeZone: 'UTC',
  year: 'numeric',
});

const pairingStatusLabels: Record<'pending' | 'active' | 'cancelled' | 'temp', string> = {
  pending: '等待對方加入',
  active: '配對已建立',
  cancelled: '配對已取消',
  temp: '臨時配對',
};

const caseStatusLabels: Record<CaseStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  in_progress: '判斷中',
  completed: '已完成',
  cancelled: '已取消',
  judgment_failed: '判斷未完成',
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
    return '請先確認證據不包含非自願或違法內容。';
  }
  if (safety.containsMinor && !safety.minorGuardianOrSelfConfirmed) {
    return '涉及未成年人時，需要先確認你是本人、監護人或已取得必要授權。';
  }
  if (safety.containsSensitiveContent && !safety.sensitiveContentHandlingAck) {
    return '涉及敏感內容時，需要先確認只上傳處理案件必要的資料。';
  }
  return null;
}

function labelPairingStatus(status?: 'pending' | 'active' | 'cancelled' | 'temp' | null): string {
  return status ? pairingStatusLabels[status] : '尚未配對';
}

function labelCaseStatus(status?: CaseStatus | null): string {
  return status ? caseStatusLabels[status] : '狀態更新中';
}

function labelCaseTitle(item: { title?: string | null; type?: string | null }): string {
  return item.title || item.type || '未命名案件';
}

function labelCaseCreatedAt(value?: string | null): string {
  if (!value) return '建立時間待同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '建立時間待同步';
  return `建立於 ${caseCreatedDateFormatter.format(date)}`;
}

function countTrimmedText(value: string): number {
  return value.trim().length;
}

function formalCaseStatementHelperText(value: string): string {
  const length = countTrimmedText(value);
  if (length < MIN_FORMAL_CASE_STATEMENT_LENGTH) {
    return `再補 ${MIN_FORMAL_CASE_STATEMENT_LENGTH - length} 個字，讓案件有足夠脈絡。`;
  }
  return `${length}/${MAX_FORMAL_CASE_STATEMENT_LENGTH}，可以建立案件。`;
}

function optionalStatementHelperText(value: string): string {
  const length = countTrimmedText(value);
  if (!length) return '可選填，先留空也能建立案件。';
  return `${length}/${MAX_FORMAL_CASE_STATEMENT_LENGTH}，已補充對方可能視角。`;
}

function inviteCodeHelperText(value: string): string {
  return value.trim() ? '可以嘗試加入配對。' : '輸入對方提供的配對邀請碼。';
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
      if (!pairingId) throw new Error('請先建立或加入配對。');
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
        setEvidenceUploadNotice('未選擇檔案。');
        return;
      }

      if (result.count === 0) {
        setEvidenceUploadNotice('沒有新增證據。');
        return;
      }

      captureTelemetry({
        name: 'case_evidence_upload_success',
        route: '/case',
        context: {
          caseId,
        },
      });
      setEvidenceUploadNotice(`已上傳 ${result.count} 份證據。`);
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
        eyebrow="正式案件"
        title="先登入"
        subtitle="正式案件需要登入後才能建立配對、案件與判斷。"
        testID="case.auth-gate.screen">
        <Panel title="正式處理">
          <FeatureRow title="不使用匿名案件" detail="正式案件會綁定帳號與配對關係。" tone="teal" />
          <FeatureRow title="快速整理可匿名" detail="還沒準備好登入時，可先用快速整理。" tone="blue" />
        </Panel>
        <LinkButton href="/auth" label="登入或註冊" tone="teal" testID="case.auth-gate.login" />
        <LinkButton href="/quick" label="先做快速整理" tone="blue" testID="case.auth-gate.quick" variant="outline" />
      </Screen>
    );
  }

  return (
    <Screen eyebrow="正式案件" title="正式案件" subtitle="從配對、正式案件到判斷結果。" testID="case.screen">
      <Panel title="配對">
        <StatusPill label={labelPairingStatus(pairingQuery.data?.status)} tone={pairingQuery.data ? 'teal' : 'amber'} />
        {pairingQuery.data?.invite_code ? (
          <Text style={styles.inviteCode}>{pairingQuery.data.invite_code}</Text>
        ) : null}
        <View style={styles.actions}>
          <ActionButton
            label="建立配對邀請"
            loading={createPairingMutation.isPending}
            onPress={() => createPairingMutation.mutate()}
            testID="case.create-pairing"
            tone="teal"
          />
          <TextInput
            accessibilityLabel="配對邀請碼"
            accessibilityHint="輸入對方提供的配對邀請碼以加入正式配對"
            autoCapitalize="characters"
            maxLength={MAX_PAIRING_INVITE_CODE_LENGTH}
            onChangeText={setInviteCode}
            placeholder="輸入配對邀請碼"
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
            accessibilityHint="輸入配對邀請碼後加入正式配對"
            label="加入配對"
            loading={joinPairingMutation.isPending}
            onPress={() => joinPairingMutation.mutate()}
            testID="case.join-pairing"
            tone="blue"
            variant="outline"
          />
          {pairingQuery.data ? (
            <ActionButton
              label="取消配對"
              loading={cancelPairingMutation.isPending}
              onPress={() => cancelPairingMutation.mutate()}
              testID="case.cancel-pairing"
              tone="neutral"
              variant="outline"
            />
          ) : null}
        </View>
      </Panel>

      <Panel title="建立案件">
        <TextInput
          accessibilityLabel="我方正式案件說明"
          accessibilityHint="輸入你這邊的具體事件、影響和希望被理解的點"
          maxLength={MAX_FORMAL_CASE_STATEMENT_LENGTH}
          multiline
          onChangeText={setPlaintiffStatement}
          placeholder="先寫清楚你這邊的具體事件、影響和希望被理解的點。"
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
          accessibilityLabel="對方可能的正式案件說明"
          accessibilityHint="可選填，補上對方可能的說法或限制"
          maxLength={MAX_FORMAL_CASE_STATEMENT_LENGTH}
          multiline
          onChangeText={setDefendantStatement}
          placeholder="可選：補上對方可能的說法。"
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
          accessibilityHint={`需要先完成配對，且我方說明至少 ${MIN_FORMAL_CASE_STATEMENT_LENGTH} 個字`}
          disabled={!canCreateCase}
          label="建立正式案件"
          loading={createCaseMutation.isPending}
          onPress={() => createCaseMutation.mutate()}
          testID="case.create-case"
          tone="teal"
        />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      <Panel title="證據安全確認">
        <Text style={styles.safetyIntro}>
          上傳前先確認證據內容。App 只送出你的明確聲明，不替你默認代簽。
        </Text>
        <SafetyToggle
          checked={evidenceSafety.noIllegalOrNonconsensual}
          label="我確認證據不包含非自願取得、非自願裸露或違法內容"
          onPress={() => updateEvidenceSafety({
            noIllegalOrNonconsensual: !evidenceSafety.noIllegalOrNonconsensual,
          })}
          testID="case.evidence-safety.no-blocked.toggle"
        />
        <SafetyToggle
          checked={evidenceSafety.containsMinor}
          label="證據涉及未成年人"
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
            label="我確認我是本人、監護人或已取得必要授權"
            onPress={() => updateEvidenceSafety({
              minorGuardianOrSelfConfirmed: !evidenceSafety.minorGuardianOrSelfConfirmed,
            })}
            testID="case.evidence-safety.minor-confirm.toggle"
          />
        ) : null}
        <SafetyToggle
          checked={evidenceSafety.containsSensitiveContent}
          label="證據包含敏感資料或私密內容"
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
            label="我確認只上傳處理案件必要的資料"
            onPress={() => updateEvidenceSafety({
              sensitiveContentHandlingAck: !evidenceSafety.sensitiveContentHandlingAck,
            })}
            testID="case.evidence-safety.sensitive-ack.toggle"
          />
        ) : null}
        {evidenceSafetyError ? <Text style={styles.safetyWarning}>{evidenceSafetyError}</Text> : null}
        {evidenceUploadNotice ? <Text style={styles.successText}>{evidenceUploadNotice}</Text> : null}
      </Panel>

      <Panel title="案件列表">
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
                  label="提交案件"
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
                  label="上傳證據"
                  loading={uploadEvidenceMutation.isPending}
                  onPress={() => uploadEvidenceMutation.mutate(item.id)}
                  testID={`case.item.${item.id}.upload-evidence`}
                  tone="teal"
                  variant="outline"
                />
              ) : null}
              <ActionButton
                label="生成 / 重試判斷"
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
          <Text style={styles.emptyText}>還沒有正式案件。</Text>
        )}
      </Panel>

      {latestJudgment ? (
        <Panel title="最新判斷">
          <StatusPill label={`${latestJudgment.plaintiff_ratio}:${latestJudgment.defendant_ratio}`} tone="coral" />
          <Text style={styles.judgmentText}>{latestJudgment.summary || latestJudgment.judgment_content}</Text>
          <ActionButton
            label="接受判斷並進入修復"
            loading={acceptJudgmentMutation.isPending}
            onPress={() => acceptJudgmentMutation.mutate(latestJudgment.id)}
            testID="case.accept-judgment"
            tone="teal"
          />
          <LinkButton
            href={`/repair?judgmentId=${encodeURIComponent(latestJudgment.id)}`}
            label="查看修復主線"
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
