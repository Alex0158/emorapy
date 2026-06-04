import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getRuntimeConfig } from '@/src/config/runtime';
import { t } from '@/src/i18n';
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
  const uploadStatusText =
    uploadProbeStatus === 'idle'
      ? t('modal.upload.status.idle')
      : uploadProbeStatus === 'permission_denied'
        ? t('modal.upload.status.permissionDenied')
        : uploadProbeStatus === 'unsupported'
          ? t('modal.upload.status.unsupported')
          : uploadProbeStatus === 'cancelled'
            ? t('modal.upload.status.cancelled')
            : uploadProbeReady
              ? t('modal.upload.status.ready')
              : t('modal.upload.status.selected');

  return (
    <Screen
      title={t('modal.title')}
      eyebrow={t('modal.eyebrow')}
      subtitle={t('modal.subtitle')}
      testID="modal.screen">
      <View style={styles.panel}>
        <StatusPill
          label={hasServiceConfig ? t('modal.service.configured') : t('modal.service.pending')}
          tone={hasServiceConfig ? 'blue' : 'amber'}
        />
        <Text style={styles.label}>{t('modal.service.label')}</Text>
        <Text style={styles.value} testID="modal.service.status">
          {hasServiceConfig ? t('modal.service.ready') : t('modal.service.notReady')}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.tile}>
          <Text style={styles.tileTitle}>{t('modal.localStorage.title')}</Text>
          <Text style={styles.tileValue}>{t('modal.localStorage.value')}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileTitle}>{t('modal.errorReport.title')}</Text>
          <Text style={styles.tileValue}>{t('modal.errorReport.value')}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <StatusPill label={t('modal.media.pill')} tone="teal" />
        <Text style={styles.label}>{t('modal.upload.label')}</Text>
        <Text style={styles.value} testID={`modal.upload.${uploadProbeStatus}`}>
          {uploadStatusText}
        </Text>
        <ActionButton
          label={t('modal.upload.pick')}
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
