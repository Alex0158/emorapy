import { StyleSheet, Text, View } from 'react-native';

import { setLocale, t, useLocale } from '@/src/i18n';
import { FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

export default function PublicHomeScreen() {
  const locale = useLocale();
  const nextLocale = locale === 'en-US' ? 'zh-TW' : 'en-US';

  return (
    <Screen
      eyebrow={t('public.home.eyebrow')}
      title={t('public.home.title')}
      subtitle={t('public.home.subtitle')}
      testID="public.home.screen">
      <View style={styles.heroPanel}>
        <StatusPill label={t('public.home.startPill')} tone="teal" />
        <Text style={styles.heroText}>{t('public.home.heroText')}</Text>
        <View style={styles.actions}>
          <LinkButton href="/quick" label={t('public.home.quick')} tone="teal" testID="public.home.quick" />
          <LinkButton href="/quick/collaborative" label={t('public.home.collaborative')} tone="blue" testID="public.home.quick-collaborative" variant="outline" />
          <LinkButton href="/chat" label={t('public.home.chat')} tone="amber" testID="public.home.chat" variant="outline" />
          <LinkButton href="/case" label={t('public.home.case')} tone="amber" testID="public.home.app" variant="outline" />
          <LinkButton href="/auth" label={t('public.home.auth')} tone="blue" testID="public.home.auth" variant="outline" />
        </View>
        <Text style={styles.localeLabel}>{t('app.locale.current')}</Text>
        <Text
          accessibilityHint={t('app.locale.changeHint')}
          accessibilityRole="button"
          onPress={() => setLocale(nextLocale)}
          style={styles.localeAction}
          testID="public.home.locale">
          {nextLocale === 'en-US' ? t('app.locale.switchToEnglish') : t('app.locale.switchToZhTW')}
        </Text>
      </View>

      <Panel title={t('public.home.today')}>
        <FeatureRow title={t('public.home.feature.quick.title')} detail={t('public.home.feature.quick.detail')} tone="teal" />
        <FeatureRow title={t('public.home.feature.collaborative.title')} detail={t('public.home.feature.collaborative.detail')} tone="blue" />
        <FeatureRow title={t('public.home.feature.chat.title')} detail={t('public.home.feature.chat.detail')} tone="blue" />
        <FeatureRow title={t('public.home.feature.repair.title')} detail={t('public.home.feature.repair.detail')} tone="coral" />
      </Panel>

      <View style={styles.secondaryActions}>
        <LinkButton href="/case" label={t('public.home.case')} tone="amber" testID="public.home.app.footer" variant="outline" />
        <LinkButton href="/modal" label={t('public.home.appStatus')} tone="neutral" testID="public.home.modal" variant="outline" />
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
  localeAction: {
    ...typography.body,
    color: palette.teal,
    fontWeight: '700',
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  localeLabel: {
    ...typography.caption,
    color: palette.muted,
  },
  secondaryActions: {
    gap: spacing.sm,
  },
});
