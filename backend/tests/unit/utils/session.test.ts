/**
 * Session 工具測試（快速體驗模式）
 */

import { generateSessionId, validateSessionId } from '../../../src/utils/session';

describe('Session Utils', () => {
  describe('generateSessionId', () => {
    it('應該生成符合格式且隨機部分為16位的Session ID', () => {
      const id = generateSessionId();

      expect(id.startsWith('guest_')).toBe(true);

      const parts = id.split('_');
      expect(parts.length).toBe(3);

      const [, ts, rand] = parts;
      expect(ts).toMatch(/^\d+$/);
      expect(rand).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('validateSessionId', () => {
    it('應該接受8位及以上隨機部分的Session ID（向後兼容）', () => {
      expect(validateSessionId('guest_1704067200000_a1b2c3d4')).toBe(true);
      expect(validateSessionId('guest_1704067200000_a1b2c3d4e5f6g7h8')).toBe(true);
    });

    it('應該拒絕不符合格式的Session ID', () => {
      expect(validateSessionId('')).toBe(false);
      expect(validateSessionId('guest__abc')).toBe(false);
      expect(validateSessionId('xxx_1704067200000_a1b2c3d4')).toBe(false);
      expect(validateSessionId('guest_1704067200000_')).toBe(false);
    });
  });
});

