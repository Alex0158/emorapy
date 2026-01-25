/**
 * Markdown工具函數
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * 渲染Markdown內容
 */
export function renderMarkdown(content: string): React.ReactElement {
  return React.createElement(ReactMarkdown, null, content);
}

/**
 * 提取Markdown中的責任分比例
 */
export function extractResponsibilityRatio(content: string): {
  plaintiff: number;
  defendant: number;
} | null {
  // 匹配格式：原告：[X]% 責任 或 原告: [X]% 責任
  const plaintiffMatch = content.match(/原告[：:]\s*(\d+)%\s*責任/);
  const defendantMatch = content.match(/被告[：:]\s*(\d+)%\s*責任/);

  if (plaintiffMatch && defendantMatch) {
    const plaintiff = parseInt(plaintiffMatch[1], 10);
    const defendant = parseInt(defendantMatch[1], 10);

    if (plaintiff + defendant === 100) {
      return { plaintiff, defendant };
    }
  }

  return null;
}

/**
 * 提取Markdown標題
 */
export function extractMarkdownTitles(content: string): string[] {
  const titleRegex = /^#{1,6}\s+(.+)$/gm;
  const titles: string[] = [];
  let match;

  while ((match = titleRegex.exec(content)) !== null) {
    titles.push(match[1].trim());
  }

  return titles;
}

