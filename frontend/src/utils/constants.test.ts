/**
 * 常量定義單元測試
 */
import { describe, it, expect, vi } from 'vitest';

// 避免 env 在測試中拋錯，須在 import constants 前 mock
vi.mock('@/config/env', () => ({
  env: {
    apiBaseURL: 'http://test.example.com/api',
  },
}));

import {
  API_BASE_URL,
  SESSION_STORAGE_KEY,
  SESSION_PREFIX,
  SESSION_EXPIRY_HOURS,
  MIN_STATEMENT_LENGTH,
  MAX_STATEMENT_LENGTH,
  MIN_DEFENDANT_LENGTH,
  MAX_FILE_SIZE,
  MAX_IMAGE_COUNT,
  MAX_VIDEO_COUNT,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  COLORS,
  SPACING,
  BORDER_RADIUS,
  ANIMATION_DURATION,
  POLLING_INTERVAL,
  CASE_POLLING_INTERVAL,
  AUTO_SAVE_INTERVAL,
  BREAKPOINTS,
} from './constants';

describe('constants', () => {
  it('API_BASE_URL 來自 env mock', () => {
    expect(API_BASE_URL).toBe('http://test.example.com/api');
  });

  describe('Session', () => {
    it('SESSION_STORAGE_KEY 應為字串', () => {
      expect(SESSION_STORAGE_KEY).toBe('mbc_session_id');
    });
    it('SESSION_PREFIX 應為字串', () => {
      expect(SESSION_PREFIX).toBe('guest_');
    });
    it('SESSION_EXPIRY_HOURS 應為數字', () => {
      expect(SESSION_EXPIRY_HOURS).toBe(24);
    });
  });

  describe('字數與文件限制', () => {
    it('字數限制為正數', () => {
      expect(MIN_STATEMENT_LENGTH).toBe(30);
      expect(MAX_STATEMENT_LENGTH).toBe(2000);
      expect(MIN_DEFENDANT_LENGTH).toBe(10);
    });
    it('MAX_FILE_SIZE 為 5MB', () => {
      expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    });
    it('MAX_IMAGE_COUNT / MAX_VIDEO_COUNT', () => {
      expect(MAX_IMAGE_COUNT).toBe(3);
      expect(MAX_VIDEO_COUNT).toBe(1);
    });
    it('ALLOWED_IMAGE_TYPES / ALLOWED_VIDEO_TYPES', () => {
      expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
      expect(ALLOWED_IMAGE_TYPES).toContain('image/png');
      expect(ALLOWED_VIDEO_TYPES).toContain('video/mp4');
    });
  });

  describe('COLORS', () => {
    it('應包含品牌色與語義色', () => {
      expect(COLORS.primary).toBe('#FF8C42');
      expect(COLORS.secondary).toBe('#5B9BD5');
      expect(COLORS.success).toBe('#52C41A');
      expect(COLORS.warning).toBe('#FAAD14');
      expect(COLORS.error).toBe('#FF4D4F');
    });
  });

  describe('SPACING / BORDER_RADIUS / ANIMATION_DURATION', () => {
    it('SPACING 為數字', () => {
      expect(SPACING.xs).toBe(4);
      expect(SPACING.md).toBe(16);
      expect(SPACING.xxl).toBe(48);
    });
    it('BORDER_RADIUS 為數字', () => {
      expect(BORDER_RADIUS.sm).toBe(4);
      expect(BORDER_RADIUS.xl).toBe(16);
    });
    it('ANIMATION_DURATION 為數字', () => {
      expect(ANIMATION_DURATION.fast).toBe(0.2);
      expect(ANIMATION_DURATION.slow).toBe(0.5);
    });
  });

  describe('輪詢與間隔', () => {
    it('POLLING_INTERVAL / CASE_POLLING_INTERVAL / AUTO_SAVE_INTERVAL', () => {
      expect(POLLING_INTERVAL).toBe(5000);
      expect(CASE_POLLING_INTERVAL).toBe(3000);
      expect(AUTO_SAVE_INTERVAL).toBe(30000);
    });
  });

  describe('BREAKPOINTS', () => {
    it('應包含 mobile / tablet / desktop', () => {
      expect(BREAKPOINTS.mobile).toBe(768);
      expect(BREAKPOINTS.tablet).toBe(1024);
      expect(BREAKPOINTS.desktop).toBe(1440);
    });
  });
});
