/**
 * 剪貼板工具
 */

import { toast } from 'sonner';
import { t } from '@/utils/i18n';

/**
 * 複製文本到剪貼板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success(t('common.copied'));
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
        toast.success(t('common.copied'));
        return true;
      } else {
        toast.error(t('common.copyFail'));
        return false;
      }
    }
  } catch {
    toast.error(t('common.copyFail'));
    return false;
  }
}

