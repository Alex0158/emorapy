/**
 * 判決相關工具函數
 */

type JudgmentLike = {
  plaintiff_ratio: number;
  defendant_ratio: number;
};

type WithResponsibilityRatio = {
  responsibility_ratio?: { plaintiff: number; defendant: number };
};

const INTERNAL_FIELDS = ['emotional_analysis'] as const;

/**
 * 將判決標準化為向後兼容的格式，補充 responsibility_ratio，
 * 並移除不應暴露給前端的內部欄位（如 emotional_analysis 等臨床診斷資料）。
 */
export function normalizeJudgment<T extends JudgmentLike>(judgment: T): Omit<T, typeof INTERNAL_FIELDS[number]> & WithResponsibilityRatio;
export function normalizeJudgment<T extends JudgmentLike>(judgment: T | null): (Omit<T, typeof INTERNAL_FIELDS[number]> & WithResponsibilityRatio) | null;
export function normalizeJudgment<T extends JudgmentLike>(judgment: T | null): (Omit<T, typeof INTERNAL_FIELDS[number]> & WithResponsibilityRatio) | null {
  if (!judgment) return null;

  const result = { ...judgment };
  for (const field of INTERNAL_FIELDS) {
    delete (result as Record<string, unknown>)[field];
  }

  if (
    result.plaintiff_ratio !== undefined &&
    result.defendant_ratio !== undefined &&
    !(result as typeof result & WithResponsibilityRatio).responsibility_ratio
  ) {
    return {
      ...result,
      responsibility_ratio: {
        plaintiff: Number(result.plaintiff_ratio),
        defendant: Number(result.defendant_ratio),
      },
    };
  }
  return result;
}
