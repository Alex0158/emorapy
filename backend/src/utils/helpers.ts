/**
 * 輔助函數
 */

/**
 * 生成案件標題
 */
export function generateCaseTitle(statement: string): string {
  // 簡單標題生成：取前30個字符；null/undefined 視為空字串（防禦邊界）
  const s = statement ?? '';
  const title = s.substring(0, 30).trim();
  return title.length < 5 ? '案件-' + new Date().toLocaleDateString() : title;
}

/**
 * 驗證郵箱格式
 */
export function isValidEmail(email: string): boolean {
  // null/undefined 視為空字串（防禦邊界）
  const e = email ?? '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(e);
}

/**
 * 驗證URL格式
 */
export function isValidUrl(url: string): boolean {
  // null/undefined 視為空字串（防禦邊界）
  const u = url ?? '';
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

/**
 * 格式化日期時間
 */
export function formatDateTime(date: Date): string {
  // null/undefined 視為無效，返回空字串（防禦邊界）
  if (date == null) return '';
  return date.toISOString();
}

/**
 * 計算分頁信息
 */
export function calculatePagination(
  page: number,
  pageSize: number,
  total: number
): {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_more: boolean;
} {
  const safePageSize = pageSize > 0 ? pageSize : 1;
  const safeTotal = total >= 0 ? total : 0; // 負數視為 0（防禦邊界）
  const totalPages = Math.ceil(safeTotal / safePageSize);
  return {
    page,
    page_size: pageSize,
    total: safeTotal,
    total_pages: totalPages,
    has_more: page < totalPages,
  };
}

/**
 * 提取關鍵詞（簡單實現）
 */
export function extractKeywords(text: string, count: number = 5): string[] {
  // 簡單的關鍵詞提取：取前N個詞；null/undefined 視為空字串（防禦邊界）
  const t = text ?? '';
  const words = t.split(/\s+/).filter(word => word.length > 2);
  return words.slice(0, count);
}

/**
 * 清理文本
 */
export function sanitizeText(text: string): string {
  // null/undefined 視為空字串（防禦邊界）
  const t = text ?? '';
  return t.trim().replace(/\s+/g, ' ');
}

