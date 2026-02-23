/**
 * AI prompt 安全工具
 */

/**
 * 用 XML fence 包裹使用者輸入，防止 prompt injection。
 * 自動移除任何可能被 LLM 當作指令的標籤。
 */
export function fenceUserInput(label: string, text: string): string {
  const sanitized = (text || '')
    .replace(/<\/?user_input>/gi, '')
    .replace(/<\/?system>/gi, '')
    .replace(/<\/?instruction>/gi, '')
    .replace(/---METADATA---/gi, '');
  return `<user_input label="${label}">\n${sanitized}\n</user_input>`;
}
