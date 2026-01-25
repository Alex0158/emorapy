/**
 * URL工具函數
 */

/**
 * 構建查詢字符串
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

/**
 * 解析查詢字符串
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(queryString);
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/**
 * 獲取當前查詢參數
 */
export function getQueryParams(): Record<string, string> {
  return parseQueryString(window.location.search);
}

/**
 * 更新URL查詢參數（不刷新頁面）
 */
export function updateQueryParams(params: Record<string, any>, replace: boolean = false): void {
  const currentParams = getQueryParams();
  const newParams = { ...currentParams, ...params };
  const queryString = buildQueryString(newParams);
  const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;

  if (replace) {
    window.history.replaceState({}, '', newUrl);
  } else {
    window.history.pushState({}, '', newUrl);
  }
}

/**
 * 移除查詢參數
 */
export function removeQueryParams(keys: string[]): void {
  const currentParams = getQueryParams();
  keys.forEach((key) => {
    delete currentParams[key];
  });
  const queryString = buildQueryString(currentParams);
  const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
  window.history.replaceState({}, '', newUrl);
}
