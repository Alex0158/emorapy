/**
 * SEO 工具單元測試
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setPageTitle, setMetaTag, setOGTag, setDescription, setKeywords, setImage, setURL, initSEO } from './seo';

describe('seo', () => {
  beforeEach(() => {
    document.title = '';
    document.head.querySelectorAll('meta[name="description"], meta[property^="og:"]').forEach((el) => el.remove());
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

  describe('setOGTag', () => {
    it('應創建或更新 meta[property] 的 content', () => {
      setOGTag('og:image', 'https://example.com/img.png');
      const meta = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
      expect(meta).toBeTruthy();
      expect(meta?.content).toBe('https://example.com/img.png');
    });
  });

  describe('setDescription', () => {
    it('應同時設置 description 與 og:description', () => {
      setDescription('頁面描述');
      expect((document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content).toBe('頁面描述');
      expect((document.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content).toBe('頁面描述');
    });
  });

  describe('setKeywords', () => {
    it('應設置 keywords meta', () => {
      setKeywords('a, b, c');
      expect((document.querySelector('meta[name="keywords"]') as HTMLMetaElement)?.content).toBe('a, b, c');
    });
  });

  describe('setImage', () => {
    it('應設置 og:image', () => {
      setImage('https://example.com/cover.jpg');
      expect((document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content).toBe('https://example.com/cover.jpg');
    });
  });

  describe('setURL', () => {
    it('應設置 og:url', () => {
      setURL('https://example.com/page');
      expect((document.querySelector('meta[property="og:url"]') as HTMLMetaElement)?.content).toBe('https://example.com/page');
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
    it('有 image 時應設置 og:image', () => {
      initSEO({ title: 'T', description: 'D', image: 'https://site.com/img.png' });
      expect((document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content).toBe('https://site.com/img.png');
    });
    it('有 url 時應設置 og:url', () => {
      initSEO({ title: 'T', description: 'D', url: 'https://site.com/page' });
      expect((document.querySelector('meta[property="og:url"]') as HTMLMetaElement)?.content).toBe('https://site.com/page');
    });
  });
});
