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

type WithJudgmentRoute = {
  judgment_route?: 'standard' | 'safety_support' | 'crisis_support';
};

const INTERNAL_FIELDS = ['emotional_analysis'] as const;

/**
 * 將判決標準化為向後兼容的格式，補充 responsibility_ratio，
 * 並移除不應暴露給前端的內部欄位（如 emotional_analysis 等臨床診斷資料）。
 */
export function normalizeJudgment<T extends JudgmentLike>(judgment: T): Omit<T, typeof INTERNAL_FIELDS[number]> & WithResponsibilityRatio & WithJudgmentRoute;
export function normalizeJudgment<T extends JudgmentLike>(judgment: T | null): (Omit<T, typeof INTERNAL_FIELDS[number]> & WithResponsibilityRatio & WithJudgmentRoute) | null;
export function normalizeJudgment<T extends JudgmentLike>(judgment: T | null): (Omit<T, typeof INTERNAL_FIELDS[number]> & WithResponsibilityRatio & WithJudgmentRoute) | null {
  if (!judgment) return null;

  const emotionalAnalysis = (judgment as Record<string, unknown>).emotional_analysis;
  const route = emotionalAnalysis && typeof emotionalAnalysis === 'object'
    ? (emotionalAnalysis as Record<string, unknown>).route
    : undefined;
  const result = { ...judgment };
  for (const field of INTERNAL_FIELDS) {
    delete (result as Record<string, unknown>)[field];
  }
  if (route === 'standard' || route === 'safety_support' || route === 'crisis_support') {
    (result as Record<string, unknown>).judgment_route = route;
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
