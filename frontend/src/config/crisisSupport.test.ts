import { describe, expect, it } from 'vitest';
import { resolveCrisisSupportResource } from './crisisSupport';

describe('resolveCrisisSupportResource', () => {
  it('未設定地區資源時使用可選國家或地區的全球目錄', () => {
    expect(resolveCrisisSupportResource({})).toEqual({
      url: 'https://findahelpline.com/',
      region: 'global',
      source: 'global_directory',
    });
  });

  it('deployment 可用 https URL 與 region 明確覆蓋', () => {
    expect(resolveCrisisSupportResource({
      VITE_CRISIS_SUPPORT_URL: 'https://support.example.org/help',
      VITE_CRISIS_SUPPORT_REGION: 'GB',
    })).toEqual({
      url: 'https://support.example.org/help',
      region: 'GB',
      source: 'deployment_config',
    });
  });

  it('拒絕非 https 設定並回退全球目錄', () => {
    expect(resolveCrisisSupportResource({
      VITE_CRISIS_SUPPORT_URL: 'javascript:alert(1)',
      VITE_CRISIS_SUPPORT_REGION: 'unsafe',
    })).toEqual({
      url: 'https://findahelpline.com/',
      region: 'global',
      source: 'global_directory',
    });
  });
});
