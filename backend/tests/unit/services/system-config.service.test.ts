/**
 * SystemConfigService 單元測試（mock Prisma）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  systemConfig: { findUnique: jest.fn() },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { systemConfigService } from '../../../src/services/system-config.service';

describe('SystemConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfigValue', () => {
    it('key 不存在時應返回 undefined（F10 邊界：config 缺失防禦）', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue(null);

      const result = await systemConfigService.getConfigValue('unknown_key');

      expect(prismaMock.systemConfig.findUnique).toHaveBeenCalledWith({
        where: { key: 'unknown_key' },
        select: { value: true },
      });
      expect(result).toBeUndefined();
    });

    it('key 存在時應返回 value（F10 成功路徑）', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: 'some_value' });

      const result = await systemConfigService.getConfigValue<string>('my_key');

      expect(result).toBe('some_value');
    });

    it('prisma 拋錯時應返回 undefined（F10 邊界：錯誤不崩潰）', async () => {
      prismaMock.systemConfig.findUnique.mockRejectedValue(new Error('DB error'));

      const result = await systemConfigService.getConfigValue('my_key');

      expect(result).toBeUndefined();
    });
  });

  describe('getBooleanConfig', () => {
    it('value 為 boolean 時應直接返回', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: true });

      const result = await systemConfigService.getBooleanConfig('flag', false);

      expect(result).toBe(true);
    });

    it('value 為字串 "true" 時應返回 true（F10 邊界：字串正規化）', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: 'true' });

      const result = await systemConfigService.getBooleanConfig('flag', false);

      expect(result).toBe(true);
    });

    it('value 為字串 "false" 時應返回 false', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: 'false' });

      const result = await systemConfigService.getBooleanConfig('flag', true);

      expect(result).toBe(false);
    });

    it('value 無效時應返回 fallback', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: 'invalid' });

      const result = await systemConfigService.getBooleanConfig('flag', true);

      expect(result).toBe(true);
    });

    it('value 為 null 時應返回 fallback（F10 邊界：DB 存 null 防禦）', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: null });

      const result = await systemConfigService.getBooleanConfig('flag', false);

      expect(result).toBe(false);
    });
  });

  describe('getNumberConfig', () => {
    it('value 為 number 時應直接返回', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: 42 });

      const result = await systemConfigService.getNumberConfig('limit', 0);

      expect(result).toBe(42);
    });

    it('value 為可解析字串時應返回數字（F10 邊界：字串正規化）', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: '100' });

      const result = await systemConfigService.getNumberConfig('limit', 0);

      expect(result).toBe(100);
    });

    it('value 無效時應返回 fallback', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: 'not-a-number' });

      const result = await systemConfigService.getNumberConfig('limit', 10);

      expect(result).toBe(10);
    });

    it('value 為 null 時應返回 fallback（F10 邊界：DB 存 null 防禦）', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({ value: null });

      const result = await systemConfigService.getNumberConfig('limit', 5);

      expect(result).toBe(5);
    });
  });
});
