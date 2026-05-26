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

type CollaborativePhase = 'roleA' | 'roleB';

export default function QuickCollaborativeScreen() {
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
        if (roleATrimmed.length < 30) {
          throw new Error('第一方請至少寫 30 個字，讓第二方接得上脈絡。');
        }

        const { session } = await getOrCreateQuickSession();

        return m1Api.quick.createCollaborativeCase(
          { plaintiff_statement: roleATrimmed },
          session.session_id
        );
      }

      if (!caseId) {
        throw new Error('找不到第一方已建立的整理，請重新開始。');
      }
      if (roleBTrimmed.length < 10) {
        throw new Error('第二方請至少寫 10 個字，再提交雙方說明。');
      }

      const sessionId = await sessionStorage.getSessionId();
      if (!sessionId) {
        throw new Error('本機進度已遺失，請重新開始雙人快速說明。');
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
        setStatusText('第一方已記錄。請把設備交給第二方，讓對方補上自己的說法。');
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
    ? roleAStatement.trim().length >= 30
    : Boolean(caseId) && roleBStatement.trim().length >= 10;

  return (
    <Screen
      eyebrow="快速整理"
      title="雙人快速說明"
      subtitle="同一台設備上輪流填寫，先把雙方視角放進同一份整理。"
      testID="quick.collaborative.screen">
      <Panel title={isRoleA ? '第一方說明' : '第二方說明'}>
        <StatusPill label={isRoleA ? '步驟 1 / 2' : '步驟 2 / 2'} tone={isRoleA ? 'teal' : 'blue'} />
        {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>{isRoleA ? '第一方想說清楚的是' : '第二方想補充的是'}</Text>
          <TextInput
            accessibilityLabel={isRoleA ? '第一方想說清楚的是' : '第二方想補充的是'}
            accessibilityHint={isRoleA
              ? '輸入第一方的事件、感受與希望對方理解的重點'
              : '輸入第二方認為重要的事實、感受或限制'}
            multiline
            onChangeText={isRoleA ? setRoleAStatement : setRoleBStatement}
            placeholder={isRoleA
              ? '先寫下發生了什麼、自己在意什麼、希望對方理解哪一點。'
              : '不用反駁全部內容，只補上你認為重要的事實、感受或限制。'}
            placeholderTextColor={palette.muted}
            style={styles.textArea}
            textAlignVertical="top"
            value={isRoleA ? roleAStatement : roleBStatement}
          />
        </View>
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <ActionButton
          disabled={!canSubmit}
          label={isRoleA ? '記錄第一方' : '提交雙方說明'}
          loading={collaborativeMutation.isPending}
          onPress={() => collaborativeMutation.mutate()}
          tone={isRoleA ? 'teal' : 'blue'}
        />
      </Panel>

      <Panel title="流程邊界">
        <FeatureRow title="同一台裝置" detail="兩步都保存在這台裝置，提交後由結果頁承接。" tone="teal" />
        <FeatureRow title="不是正式案件" detail="這是快速雙人模式；需要長期保存時再登入收進帳號。" tone="blue" />
        <FeatureRow title="避免互相覆寫" detail="第二方只能補自己的說明，不能改第一方文字。" tone="coral" />
      </Panel>

      <View style={styles.actions}>
        <LinkButton href="/quick" label="改用單人快速判斷" tone="neutral" variant="outline" />
        <LinkButton href="/" label="回到首頁" tone="neutral" variant="outline" />
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
