import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getRuntimeConfig } from '@/src/config/runtime';
import { createEvidenceUploadFormData, pickImageWithStatus } from '@/src/platform/upload/native';
import type { PickImageResult } from '@/src/platform/upload/types';
import { ActionButton, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

export default function ModalScreen() {
  const runtime = getRuntimeConfig();
  const [uploadProbe, setUploadProbe] = useState<PickImageResult | null>(null);
  const [uploadProbeReady, setUploadProbeReady] = useState(false);
  const [uploadProbeBusy, setUploadProbeBusy] = useState(false);
  const hasServiceConfig = Boolean(runtime.apiBaseUrl);

  const runUploadProbe = async () => {
    setUploadProbeBusy(true);
    setUploadProbeReady(false);
    try {
      const result = await pickImageWithStatus({ allowsEditing: false, quality: 0.82 });
      setUploadProbe(result);
      if (result.status === 'selected' && result.asset) {
        createEvidenceUploadFormData([result.asset], {
          safetyAssertion: {
            contains_illegal_content: false,
            contains_nonconsensual_content: false,
          },
        });
        setUploadProbeReady(true);
      }
    } finally {
      setUploadProbeBusy(false);
    }
  };

  const uploadProbeStatus = uploadProbe?.status ?? 'idle';

  return (
    <Screen
      title="App 狀態"
      eyebrow="App"
      subtitle="確認服務連線、本機保存與圖片選擇是否可用。"
      testID="modal.screen">
      <View style={styles.panel}>
        <StatusPill label={hasServiceConfig ? '服務已設定' : '服務待設定'} tone={hasServiceConfig ? 'blue' : 'amber'} />
        <Text style={styles.label}>服務連線</Text>
        <Text style={styles.value} testID="modal.service.status">
          {hasServiceConfig ? '已準備連線' : '尚未完成設定'}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.tile}>
          <Text style={styles.tileTitle}>本機保存</Text>
          <Text style={styles.tileValue}>系統安全儲存</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileTitle}>錯誤回報</Text>
          <Text style={styles.tileValue}>只保留安全上下文</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <StatusPill label="媒體" tone="teal" />
        <Text style={styles.label}>圖片選擇</Text>
        <Text style={styles.value} testID={`modal.upload.${uploadProbeStatus}`}>
          {uploadProbeStatus === 'idle'
            ? '尚未選擇'
            : uploadProbeStatus === 'permission_denied'
              ? '相簿權限未開啟'
              : uploadProbeStatus === 'unsupported'
                ? '這個平台暫時不能選擇圖片'
                : uploadProbeStatus === 'cancelled'
                  ? '已返回 App，未選擇圖片'
                  : uploadProbeReady
                    ? '圖片已準備，可隨案件一起上傳。'
                    : '圖片已選擇'}
        </Text>
        <ActionButton
          label="選擇圖片"
          loading={uploadProbeBusy}
          onPress={runUploadProbe}
          testID="modal.upload.pick"
          tone="teal"
          variant="outline"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: palette.muted,
  },
  value: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tile: {
    flex: 1,
    gap: spacing.xs,
    borderRadius: 8,
    backgroundColor: palette.panel,
    padding: spacing.md,
  },
  tileTitle: {
    ...typography.caption,
    color: palette.muted,
  },
  tileValue: {
    ...typography.smallStrong,
    color: palette.ink,
  },
});
