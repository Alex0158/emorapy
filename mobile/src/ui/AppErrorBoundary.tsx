import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

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
      eyebrow="App"
      title="暫時無法載入"
      subtitle="這次操作沒有完成。你可以重試，或先回到上一個安全入口。">
      <Panel title="恢復方式">
        <StatusPill label="安全恢復" tone="amber" />
        <Text style={styles.body}>
          錯誤細節不會直接顯示在畫面上；我們只保留安全的錯誤上下文。
        </Text>
        <FeatureRow title="本機資料" detail="重試不會清除這台裝置的登入狀態或快速整理。" tone="teal" />
        <FeatureRow title="重新檢查" detail="重試後仍會重新確認目前帳號和流程狀態。" tone="blue" />
        <ActionButton label="重新嘗試" onPress={() => { void retry(); }} tone="teal" />
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
