/**
 * 格式化工具函數
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { t, getLocale } from '@/utils/i18n';

dayjs.extend(relativeTime);

function dayjsLocale(): string {
  return getLocale().startsWith('zh') ? 'zh-cn' : 'en';
}

/**
 * 格式化日期
 */
export const formatDate = (date: string | Date, format = 'YYYY-MM-DD HH:mm:ss'): string => {
  return dayjs(date).format(format);
};

/**
 * 相對時間（如：3分鐘前）
 */
export const formatRelativeTime = (date: string | Date): string => {
  return dayjs(date).locale(dayjsLocale()).fromNow();
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * 格式化字數統計
 */
export const formatWordCount = (count: number, max: number): string => {
  return t('common.wordCount').replace('{count}', String(count)).replace('{max}', String(max));
};

/**
 * 截斷文本
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

/**
 * 格式化百分比
 */
export const formatPercent = (value: number, decimals = 0): string => {
  return `${value.toFixed(decimals)}%`;
};

