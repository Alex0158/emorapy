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

// 顏色定義（品牌色）
export const COLORS = {
  primary: '#FF8C42', // 溫暖橘
  secondary: '#5B9BD5', // 柔和藍
  success: '#52C41A',
  warning: '#FAAD14',
  error: '#FF4D4F',
  textPrimary: '#262626',
  textSecondary: '#595959',
  textTertiary: '#8C8C8C',
  border: '#D9D9D9',
  background: '#FAFAFA',
  white: '#FFFFFF',
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
