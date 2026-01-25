/**
 * 責任分比例工具
 */

import type { ResponsibilityRatio } from '@/types/common';

/**
 * 格式化責任分比例顯示
 */
export function formatResponsibilityRatio(ratio: ResponsibilityRatio): string {
  return `原告 ${ratio.plaintiff}% : 被告 ${ratio.defendant}%`;
}

/**
 * 獲取責任分比例顏色
 */
export function getResponsibilityColor(percentage: number): string {
  if (percentage >= 70) {
    return '#FF4D4F'; // 紅色：主要責任
  } else if (percentage >= 50) {
    return '#FA8C16'; // 橙色：較大責任
  } else if (percentage >= 30) {
    return '#FAAD14'; // 黃色：次要責任
  } else {
    return '#52C41A'; // 綠色：較小責任
  }
}

/**
 * 判斷責任等級
 */
export function getResponsibilityLevel(percentage: number): 'major' | 'moderate' | 'minor' | 'minimal' {
  if (percentage >= 70) {
    return 'major';
  } else if (percentage >= 50) {
    return 'moderate';
  } else if (percentage >= 30) {
    return 'minor';
  } else {
    return 'minimal';
  }
}

