import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { normalizeM1Error, m1Api } from '@/src/features/m1/api';
import { getOrCreateQuickSession } from '@/src/features/m1/session';
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
    return `再補 ${MIN_STATEMENT_LENGTH - length} 個字，讓整理有足夠上下文。`;
  }
  return `${length}/${MAX_STATEMENT_LENGTH}，可以提交。`;
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
        throw new Error(`請各寫至少 ${MIN_STATEMENT_LENGTH} 個字，讓系統有足夠上下文。`);
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
      eyebrow="快速整理"
      title="快速整理"
      subtitle="把雙方說法分開，先保留一個不急著下結論的版本。"
      action={<LinkButton href="/" label="回到首頁" tone="neutral" testID="quick.home" variant="outline" />}
      testID="quick.screen">
      <Panel title="輸入區">
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>我想說清楚的是</Text>
          <TextInput
            accessibilityLabel="我想說清楚的是"
            accessibilityHint="輸入你這邊的具體事件、影響與希望對方理解的重點"
            maxLength={MAX_STATEMENT_LENGTH}
            multiline
            onChangeText={setPlaintiffStatement}
            placeholder="誰做了什麼、我為什麼在意、我希望對方理解哪一點。"
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
          <Text style={styles.fieldLabel}>對方可能會說</Text>
          <TextInput
            accessibilityLabel="對方可能會說"
            accessibilityHint="補上對方可能的視角，幫助快速判斷降低單方偏誤"
            maxLength={MAX_STATEMENT_LENGTH}
            multiline
            onChangeText={setDefendantStatement}
            placeholder="補上對方視角，避免一開始就只剩單方結論。"
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
          accessibilityHint={`兩段說明都至少 ${MIN_STATEMENT_LENGTH} 個字後提交快速整理`}
          disabled={!canSubmit}
          label="提交快速整理"
          loading={quickMutation.isPending}
          onPress={() => quickMutation.mutate()}
          testID="quick.submit"
          tone="teal"
        />
      </Panel>

      <Panel title="保存方式">
        <StatusPill label="快速整理" tone="amber" />
        <FeatureRow title="匿名進度" detail="先保存這次整理，不必一開始就登入。" tone="teal" />
        <FeatureRow title="中斷恢復" detail="本機進度過期時會重建，再繼續這次整理。" tone="blue" />
        <FeatureRow title="登入保存" detail="需要長期查看時，再把進度收進帳號。" tone="coral" />
      </Panel>

      <View style={styles.actions}>
        <LinkButton href="/quick/collaborative" label="雙人快速說明" tone="blue" testID="quick.collaborative" variant="outline" />
        <LinkButton href="/auth" label="登入保存進度" tone="teal" testID="quick.auth" />
        <LinkButton href="/" label="回到首頁" tone="neutral" testID="quick.home.footer" variant="outline" />
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
