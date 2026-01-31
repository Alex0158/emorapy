/**
 * 判決相關工具函數
 */

/**
 * 將判決標準化為向後兼容的格式，補充 responsibility_ratio
 * 當 plaintiff_ratio/defendant_ratio 存在但 responsibility_ratio 不存在時，自動補充
 */
export function normalizeJudgment(judgment: any): any {
  if (!judgment) return judgment;
  if (
    judgment.plaintiff_ratio !== undefined &&
    judgment.defendant_ratio !== undefined &&
    judgment.responsibility_ratio === undefined
  ) {
    return {
      ...judgment,
      responsibility_ratio: {
        plaintiff: Number(judgment.plaintiff_ratio),
        defendant: Number(judgment.defendant_ratio),
      },
    };
  }
  return judgment;
}
