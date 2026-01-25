/**
 * 輔助函數
 */

/**
 * 生成案件標題
 */
export function generateCaseTitle(statement: string): string {
  // 簡單標題生成：取前30個字符
  const title = statement.substring(0, 30).trim();
  return title.length < 5 ? '案件-' + new Date().toLocaleDateString() : title;
}

/**
 * 驗證郵箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 驗證URL格式
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 格式化日期時間
 */
export function formatDateTime(date: Date): string {
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
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
    has_more: page < totalPages,
  };
}

/**
 * 提取關鍵詞（簡單實現）
 */
export function extractKeywords(text: string, count: number = 5): string[] {
  // 簡單的關鍵詞提取：取前N個詞
  const words = text.split(/\s+/).filter(word => word.length > 2);
  return words.slice(0, count);
}

/**
 * 清理文本
 */
export function sanitizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

