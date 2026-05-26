import { StyleSheet, Text, View } from 'react-native';

import { FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

export default function PublicHomeScreen() {
  return (
    <Screen
      eyebrow="CJ"
      title="把拉扯整理成下一步"
      subtitle="先整理事實與感受，再進入判斷、對話或修復。"
      testID="public.home.screen">
      <View style={styles.heroPanel}>
        <StatusPill label="從快速整理開始" tone="teal" />
        <Text style={styles.heroText}>一個安靜、清楚、能回到進度的關係處理入口。</Text>
        <View style={styles.actions}>
          <LinkButton href="/quick" label="開始快速判斷" tone="teal" testID="public.home.quick" />
          <LinkButton href="/quick/collaborative" label="雙人快速說明" tone="blue" testID="public.home.quick-collaborative" variant="outline" />
          <LinkButton href="/chat" label="先聊再判" tone="amber" testID="public.home.chat" variant="outline" />
          <LinkButton href="/case" label="進入案件與修復" tone="amber" testID="public.home.app" variant="outline" />
          <LinkButton href="/auth" label="登入 / 註冊" tone="blue" testID="public.home.auth" variant="outline" />
        </View>
      </View>

      <Panel title="今日入口">
        <FeatureRow title="快速判斷" detail="先在這台裝置保存一次衝突整理。" tone="teal" />
        <FeatureRow title="雙人快速說明" detail="同一台設備輪流輸入，不把它誤當正式案件。" tone="blue" />
        <FeatureRow title="先聊再判" detail="聊天沉澱材料，再決定是否請求判斷。" tone="blue" />
        <FeatureRow title="修復旅程" detail="判斷之後回到可執行的小步計畫。" tone="coral" />
      </Panel>

      <View style={styles.secondaryActions}>
        <LinkButton href="/case" label="進入案件與修復" tone="amber" testID="public.home.app.footer" variant="outline" />
        <LinkButton href="/modal" label="App 狀態" tone="neutral" testID="public.home.modal" variant="outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroPanel: {
    gap: spacing.lg,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: palette.surface,
    padding: spacing.xl,
  },
  heroText: {
    ...typography.title,
    color: palette.ink,
  },
  actions: {
    gap: spacing.sm,
  },
  secondaryActions: {
    gap: spacing.sm,
  },
});
