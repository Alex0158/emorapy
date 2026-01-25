/**
 * 日期格式化工具
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 格式化日期時間
 */
export function formatDateTime(date: string | Date, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).format(format);
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date, format: string = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format);
}

/**
 * 格式化時間
 */
export function formatTime(date: string | Date, format: string = 'HH:mm:ss'): string {
  return dayjs(date).format(format);
}

/**
 * 相對時間（如：2小時前）
 */
export function formatRelativeTime(date: string | Date): string {
  return dayjs(date).fromNow();
}

/**
 * 格式化持續時間（如：3天）
 */
export function formatDuration(days: number): string {
  if (days === 1) {
    return '1天';
  }
  if (days < 7) {
    return `${days}天`;
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}週`;
  }
  const months = Math.floor(days / 30);
  return `${months}個月`;
}

