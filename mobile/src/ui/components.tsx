import { router, type Href } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/src/i18n';
import { palette, spacing, typography } from '@/src/ui/theme';

type Tone = 'teal' | 'coral' | 'amber' | 'blue' | 'neutral';

const toneColors: Record<Tone, string> = {
  teal: palette.teal,
  coral: palette.coral,
  amber: palette.amber,
  blue: palette.blue,
  neutral: palette.muted,
};

interface ScreenProps extends PropsWithChildren {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  testID?: string;
}

export function Screen({ eyebrow, title, subtitle, action, children, testID }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']} testID={testID}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {action}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

interface LinkButtonProps {
  href: string;
  label: string;
  tone?: Tone;
  variant?: 'filled' | 'outline';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function LinkButton({
  href,
  label,
  tone = 'teal',
  variant = 'filled',
  accessibilityLabel,
  accessibilityHint,
  testID,
}: LinkButtonProps) {
  const color = toneColors[tone];
  const filled = variant === 'filled';
  const resolvedAccessibilityLabel = accessibilityLabel ?? label;
  const resolvedAccessibilityHint = accessibilityHint ?? t('ui.link.accessibilityHint', { label });

  return (
    <Pressable
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityHint={resolvedAccessibilityHint}
      accessibilityRole="button"
      onPress={() => router.push(href as Href)}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: filled ? color : 'transparent',
          borderColor: color,
          opacity: pressed ? 0.78 : 1,
        },
      ]}>
      <Text style={[styles.buttonLabel, { color: filled ? palette.surface : color }]}>{label}</Text>
    </Pressable>
  );
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  tone?: Tone;
  variant?: 'filled' | 'outline';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  selected = false,
  tone = 'teal',
  variant = 'filled',
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ActionButtonProps) {
  const color = toneColors[tone];
  const filled = variant === 'filled';
  const foreground = filled ? palette.surface : color;
  const resolvedAccessibilityLabel = accessibilityLabel ?? label;
  const resolvedAccessibilityHint = accessibilityHint ?? t('ui.action.accessibilityHint', { label });

  return (
    <Pressable
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityHint={resolvedAccessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading, selected }}
      disabled={disabled || loading}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: filled ? color : 'transparent',
          borderColor: color,
          opacity: disabled ? 0.48 : pressed ? 0.78 : 1,
        },
      ]}>
      <View style={styles.buttonContent}>
        {loading ? <ActivityIndicator color={foreground} size="small" /> : null}
        <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

interface StatusPillProps {
  label: string;
  tone?: Tone;
}

export function StatusPill({ label, tone = 'teal' }: StatusPillProps) {
  return (
    <View style={[styles.pill, { borderColor: toneColors[tone] }]}>
      <Text style={[styles.pillText, { color: toneColors[tone] }]}>{label}</Text>
    </View>
  );
}

interface FeatureRowProps {
  title: string;
  detail: string;
  tone?: Tone;
}

export function FeatureRow({ title, detail, tone = 'neutral' }: FeatureRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${title}。${detail}`}
      style={styles.featureRow}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[styles.featureMark, { backgroundColor: toneColors[tone] }]}
      />
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDetail}>{detail}</Text>
      </View>
    </View>
  );
}

interface PanelProps extends PropsWithChildren {
  title?: string;
}

export function Panel({ title, children }: PanelProps) {
  return (
    <View style={styles.panel}>
      {title ? <Text accessibilityRole="header" style={styles.panelTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  content: {
    alignSelf: 'center',
    gap: spacing.lg,
    maxWidth: 760,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: palette.teal,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.hero,
    color: palette.ink,
  },
  subtitle: {
    ...typography.body,
    color: palette.muted,
  },
  button: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonLabel: {
    ...typography.bodyStrong,
    flexShrink: 1,
    textAlign: 'center',
  },
  buttonContent: {
    alignItems: 'center',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillText: {
    ...typography.caption,
  },
  featureRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  featureMark: {
    borderRadius: 999,
    height: 12,
    marginTop: 5,
    width: 12,
  },
  featureCopy: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  featureDetail: {
    ...typography.small,
    color: palette.muted,
  },
  panel: {
    gap: spacing.md,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  panelTitle: {
    ...typography.section,
    color: palette.ink,
  },
});
