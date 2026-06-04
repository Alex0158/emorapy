import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { t } from '@/src/i18n';
import { captureTelemetry } from '@/src/platform/telemetry/client';
import { ActionButton, FeatureRow, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureTelemetry({
      name: 'app_error_boundary',
      severity: 'error',
      route: '/app',
      context: {
        errorName: error.name || 'Error',
        hasMessage: Boolean(error.message),
      },
    });
  }, [error]);

  return (
    <Screen
      eyebrow={t('appError.eyebrow')}
      title={t('appError.title')}
      subtitle={t('appError.subtitle')}>
      <Panel title={t('appError.panel')}>
        <StatusPill label={t('appError.pill')} tone="amber" />
        <Text style={styles.body}>
          {t('appError.body')}
        </Text>
        <FeatureRow
          title={t('appError.localData.title')}
          detail={t('appError.localData.detail')}
          tone="teal"
        />
        <FeatureRow
          title={t('appError.retryCheck.title')}
          detail={t('appError.retryCheck.detail')}
          tone="blue"
        />
        <ActionButton label={t('appError.retry')} onPress={() => { void retry(); }} tone="teal" />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: palette.muted,
    marginBottom: spacing.xs,
  },
});
