/**
 * Markdown 工具單元測試
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import {
  renderMarkdown,
  extractResponsibilityRatio,
  extractMarkdownTitles,
} from './markdown';

describe('markdown', () => {
  describe('renderMarkdown', () => {
    it('應返回 React 元素', () => {
      const result = renderMarkdown('# Hello');
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('extractResponsibilityRatio', () => {
    it('應解析 原告：X% 責任 與 被告：Y% 責任 且總和為 100', () => {
      const content = '原告：60% 責任\n被告：40% 責任';
      expect(extractResponsibilityRatio(content)).toEqual({ plaintiff: 60, defendant: 40 });
    });

    it('支援冒號 原告: 與 被告:', () => {
      const content = '原告: 50% 責任 被告: 50% 責任';
      expect(extractResponsibilityRatio(content)).toEqual({ plaintiff: 50, defendant: 50 });
    });

    it('總和不為 100 應返回 null', () => {
      const content = '原告：70% 責任\n被告：20% 責任';
      expect(extractResponsibilityRatio(content)).toBeNull();
    });

    it('缺少原告或被告應返回 null', () => {
      expect(extractResponsibilityRatio('原告：100% 責任')).toBeNull();
      expect(extractResponsibilityRatio('被告：100% 責任')).toBeNull();
      expect(extractResponsibilityRatio('無關內容')).toBeNull();
    });
  });

  describe('extractMarkdownTitles', () => {
    it('應提取 # 至 ###### 標題', () => {
      const content = '# 一\n## 二\n### 三\n正文';
      expect(extractMarkdownTitles(content)).toEqual(['一', '二', '三']);
    });

    it('應去除標題前後空白', () => {
      const content = '#  標題  ';
      expect(extractMarkdownTitles(content)).toEqual(['標題']);
    });

    it('無標題應返回空陣列', () => {
      expect(extractMarkdownTitles('純文字')).toEqual([]);
    });
  });
});
