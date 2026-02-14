/**
 * 案件類型工具
 */

export type CaseType =
  | '生活習慣衝突'
  | '消費決策衝突'
  | '社交關係衝突'
  | '價值觀衝突'
  | '情感需求衝突'
  | '其他衝突';

export const CASE_TYPES: CaseType[] = [
  '生活習慣衝突',
  '消費決策衝突',
  '社交關係衝突',
  '價值觀衝突',
  '情感需求衝突',
  '其他衝突',
];

/** 案件類型 → caseList i18n key（用於篩選、表單選項） */
export const CASE_TYPE_I18N_KEYS: Record<CaseType, string> = {
  '生活習慣衝突': 'caseList.typeLife',
  '消費決策衝突': 'caseList.typeConsumption',
  '社交關係衝突': 'caseList.typeSocial',
  '價值觀衝突': 'caseList.typeValues',
  '情感需求衝突': 'caseList.typeEmotion',
  '其他衝突': 'caseList.typeOther',
};

/**
 * 獲取案件類型標籤顏色
 */
export function getCaseTypeColor(type: CaseType): string {
  const colorMap: Record<CaseType, string> = {
    '生活習慣衝突': '#52C41A',
    '消費決策衝突': '#1890FF',
    '社交關係衝突': '#722ED1',
    '價值觀衝突': '#FA8C16',
    '情感需求衝突': '#EB2F96',
    '其他衝突': '#8C8C8C',
  };
  return colorMap[type] || '#8C8C8C';
}

/**
 * 獲取案件類型圖標
 */
export function getCaseTypeIcon(type: CaseType): string {
  const iconMap: Record<CaseType, string> = {
    '生活習慣衝突': '🏠',
    '消費決策衝突': '💰',
    '社交關係衝突': '👥',
    '價值觀衝突': '💭',
    '情感需求衝突': '💕',
    '其他衝突': '❓',
  };
  return iconMap[type] || '❓';
}

