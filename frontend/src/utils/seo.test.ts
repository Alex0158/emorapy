/**
 * SEO 工具單元測試
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setPageTitle, setMetaTag, initSEO } from './seo';

describe('seo', () => {
  beforeEach(() => {
    document.title = '';
  });

  describe('setPageTitle', () => {
    it('應設置 document.title 為「標題 - 關係修復室」', () => {
      setPageTitle('執行儀表板');
      expect(document.title).toBe('執行儀表板 - 關係修復室');
    });
  });

  describe('setMetaTag', () => {
    it('應創建或更新 meta[name] 的 content', () => {
      setMetaTag('description', '測試描述');
      const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      expect(meta).toBeTruthy();
      expect(meta?.content).toBe('測試描述');
    });
  });

  describe('initSEO', () => {
    it('應設置 title、description 與 og:title、og:type', () => {
      initSEO({ title: '首頁', description: '首頁描述' });
      expect(document.title).toBe('首頁 - 關係修復室');
      const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      expect(desc?.content).toBe('首頁描述');
      const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
      expect(ogTitle?.content).toBe('首頁');
      const ogType = document.querySelector('meta[property="og:type"]') as HTMLMetaElement;
      expect(ogType?.content).toBe('website');
    });
    it('有 keywords 時應設置 keywords meta', () => {
      initSEO({ title: 'T', description: 'D', keywords: '關鍵詞' });
      const meta = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
      expect(meta?.content).toBe('關鍵詞');
    });
  });
});
