/**
 * 下載工具
 */

/**
 * 下載文件
 */
export function downloadFile(url: string, filename?: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || '';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 下載文本內容
 */
export function downloadText(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  downloadFile(url, filename);
  URL.revokeObjectURL(url);
}

/**
 * 下載JSON
 */
export function downloadJSON(data: any, filename: string = 'data.json'): void {
  downloadText(JSON.stringify(data, null, 2), filename, 'application/json');
}

