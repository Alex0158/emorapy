import { t } from '@/src/i18n';

const caseTypeLabelKeys: Record<string, string> = {
  '生活習慣衝突': 'case.type.life',
  '消費決策衝突': 'case.type.consumption',
  '社交關係衝突': 'case.type.social',
  '價值觀衝突': 'case.type.values',
  '情感需求衝突': 'case.type.emotion',
  '其他衝突': 'case.type.other',
};

export function getCaseTypeLabel(type?: string | null): string | null {
  if (!type) return null;
  const key = caseTypeLabelKeys[type];
  return key ? t(key) : null;
}
