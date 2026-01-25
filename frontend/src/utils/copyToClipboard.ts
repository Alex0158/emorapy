/**
 * 剪貼板工具
 */

import { message } from 'antd';

/**
 * 複製文本到剪貼板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      message.success('已複製到剪貼板');
      return true;
    } else {
      // 降級方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (success) {
        message.success('已複製到剪貼板');
        return true;
      } else {
        message.error('複製失敗');
        return false;
      }
    }
  } catch (error) {
    message.error('複製失敗');
    return false;
  }
}

