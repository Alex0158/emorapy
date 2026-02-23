/**
 * 下載工具
 */

/**
 * 下載文件
 */
const SAFE_URL_PATTERN = /^(https?:|blob:|data:)/i;

export function downloadFile(url: string, filename?: string): void {
  if (!SAFE_URL_PATTERN.test(url)) {
    throw new Error(`Blocked download from unsafe URL scheme: ${url.split(':')[0]}`);
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || '';
  link.target = '_blank';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
  }
}

/**
 * 下載文本內容
 */
export function downloadText(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    downloadFile(url, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 下載JSON
 */
export function downloadJSON(data: unknown, filename: string = 'data.json'): void {
  downloadText(JSON.stringify(data, null, 2), filename, 'application/json');
}

