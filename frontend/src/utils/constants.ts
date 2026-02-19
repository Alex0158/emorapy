/**
 * 常量定義
 */

import { env } from '@/config/env';

// API配置（統一使用 env.ts 中的定義）
export const API_BASE_URL = env.apiBaseURL;

// Session配置
export const SESSION_STORAGE_KEY = 'mbc_session_id';
export const SESSION_PREFIX = 'guest_';
export const SESSION_EXPIRY_HOURS = 24;

// 字數限制
export const MIN_STATEMENT_LENGTH = 30;
export const MAX_STATEMENT_LENGTH = 2000;
export const MIN_DEFENDANT_LENGTH = 10;

// 文件上傳限制
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGE_COUNT = 3;
export const MAX_VIDEO_COUNT = 1;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4'];

// 顏色定義（現代溫暖 SaaS 風格 - 友善、清晰、令人安心）
export const COLORS = {
  primary: '#FF8E5E', // 溫暖的珊瑚橘 (Role A) - 帶來鼓勵與活力
  secondary: '#5BB1D2', // 柔和的天空藍 (Role B) - 帶來平靜與理性
  success: '#4ADE80', // 現代感亮綠色
  warning: '#FBBF24', // 現代感溫暖黃
  error: '#F87171', // 柔和的警示紅
  textPrimary: '#1E293B', //  Slate 800 - 清晰但不刺眼的深色
  textSecondary: '#64748B', // Slate 500 - 友善的輔助文字色
  textTertiary: '#94A3B8', // Slate 400
  border: '#E2E8F0', // Slate 200 - 乾淨柔和的邊框
  background: '#F8FAFC', // Slate 50 - 極淡的冷白背景，讓純白卡片更突出
  white: '#FFFFFF', // 純白卡片
} as const;

// 間距定義
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// 圓角定義
export const BORDER_RADIUS = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
} as const;

// 動畫時長
export const ANIMATION_DURATION = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
} as const;

// 輪詢間隔
export const POLLING_INTERVAL = 5000; // 判決狀態輪詢：5秒
export const CASE_POLLING_INTERVAL = 3000; // 案件狀態輪詢：3秒

// 自動保存間隔
export const AUTO_SAVE_INTERVAL = 30000; // 30秒

// 響應式斷點
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1440,
} as const;
