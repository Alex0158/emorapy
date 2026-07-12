import { describe, it, expect } from '@jest/globals';
import {
  mergeMediaProviderConfigWithStoredSecret,
  normalizeManagedConfigValue,
  projectManagedConfigValueForAdmin,
  validateCrossManagedConfigRules,
} from '../../../src/services/admin-config-rules';

describe('admin-config-rules', () => {
  describe('normalizeManagedConfigValue', () => {
    it('jobs.enabled 應將字串 true 正規化為 boolean', () => {
      const value = normalizeManagedConfigValue('jobs.enabled', 'true');
      expect(value).toBe(true);
    });

    it('interview.maxTurns 超出範圍應拋錯', () => {
      expect(() => normalizeManagedConfigValue('interview.maxTurns', 3)).toThrow();
    });

    it('interview.maxTurns 邊界值應通過', () => {
      expect(normalizeManagedConfigValue('interview.maxTurns', 5)).toBe(5);
      expect(normalizeManagedConfigValue('interview.maxTurns', 100)).toBe(100);
    });

    it('interview.turnIntervalMs 上下界應可正規化', () => {
      expect(normalizeManagedConfigValue('interview.turnIntervalMs', 0)).toBe(0);
      expect(normalizeManagedConfigValue('interview.turnIntervalMs', 300000)).toBe(300000);
    });

    it('interview.turnIntervalMs 可接受字串數字', () => {
      expect(normalizeManagedConfigValue('interview.turnIntervalMs', '1200')).toBe(1200);
    });

    it('feature.flags 非 object 應拋錯', () => {
      expect(() => normalizeManagedConfigValue('feature.flags', 'bad')).toThrow();
    });

    it('feature.flags key 過多應拋錯', () => {
      const hugeFlags: Record<string, boolean> = {};
      for (let i = 0; i < 201; i += 1) hugeFlags[`k_${i}`] = true;
      expect(() => normalizeManagedConfigValue('feature.flags', hugeFlags)).toThrow();
    });
  });

  describe('media provider secret preservation', () => {
    it('修改非 secret 欄位時應沿用已儲存 apiKey', () => {
      expect(mergeMediaProviderConfigWithStoredSecret(
        'media.provider.openai',
        { baseUrl: 'https://new.example.com', model: 'image-v2' },
        { apiKey: 'stored-secret', baseUrl: 'https://old.example.com' },
      )).toEqual({
        apiKey: 'stored-secret',
        baseUrl: 'https://new.example.com',
        model: 'image-v2',
      });
    });

    it('明確提供新 apiKey 時不得被舊值覆蓋', () => {
      expect(mergeMediaProviderConfigWithStoredSecret(
        'media.provider.openai',
        { apiKey: 'rotated-secret', baseUrl: 'https://new.example.com' },
        { apiKey: 'stored-secret' },
      )).toEqual({
        apiKey: 'rotated-secret',
        baseUrl: 'https://new.example.com',
      });
    });

    it('Admin read projection 只回傳 allowlisted 非 secret 欄位與狀態', () => {
      expect(projectManagedConfigValueForAdmin(
        'media.provider.openai',
        {
          apiKey: 'stored-secret',
          base_url: 'https://api.example.com',
          timeout_ms: 8000,
          model: 'image-v2',
          hiddenToken: 'must-not-leak',
        },
        true,
      )).toEqual({
        value: {
          baseUrl: 'https://api.example.com',
          timeoutMs: 8000,
          model: 'image-v2',
        },
        secretConfigured: true,
      });
    });
  });

  describe('validateCrossManagedConfigRules', () => {
    it('softTarget 大於 maxTurns 應拋錯', async () => {
      await expect(
        validateCrossManagedConfigRules(
          'interview.softTarget',
          20,
          async (key, fallback) => (key === 'interview.maxTurns' ? 10 : fallback),
          { maxTurns: 30, softTarget: 10 }
        )
      ).rejects.toThrow();
    });

    it('maxTurns >= softTarget 時應通過', async () => {
      await expect(
        validateCrossManagedConfigRules(
          'interview.maxTurns',
          20,
          async (key, fallback) => (key === 'interview.softTarget' ? 10 : fallback),
          { maxTurns: 30, softTarget: 10 }
        )
      ).resolves.toBeUndefined();
    });

    it('與 cross rule 無關的 key 應直接通過', async () => {
      await expect(
        validateCrossManagedConfigRules(
          'jobs.enabled',
          true,
          async (_key, fallback) => fallback,
          { maxTurns: 30, softTarget: 10 }
        )
      ).resolves.toBeUndefined();
    });
  });
});
