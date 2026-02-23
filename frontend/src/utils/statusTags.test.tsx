/**
 * statusTags 工具單元測試
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  getDifficultyText,
  getPlanTypeText,
  getPlanTypeTagColor,
  getDifficultyTagColor,
  getExecutionStatusTag,
  getCaseStatusTag,
  getCaseTypeTag,
} from './statusTags';

describe('statusTags', () => {
  describe('getDifficultyText', () => {
    it('應返回對應中文', () => {
      expect(getDifficultyText('easy')).toBe('簡單');
      expect(getDifficultyText('medium')).toBe('中等');
      expect(getDifficultyText('hard')).toBe('困難');
    });
    it('未知難度應原樣返回', () => {
      expect(getDifficultyText('unknown')).toBe('unknown');
    });
  });

  describe('getPlanTypeText', () => {
    it('應返回對應中文', () => {
      expect(getPlanTypeText('activity')).toBe('活動');
      expect(getPlanTypeText('communication')).toBe('溝通');
      expect(getPlanTypeText('intimacy')).toBe('親密');
      expect(getPlanTypeText('gift')).toBe('禮物');
      expect(getPlanTypeText('service')).toBe('服務');
    });
    it('未知類型應原樣返回', () => {
      expect(getPlanTypeText('other')).toBe('other');
    });
  });

  describe('getPlanTypeTagColor', () => {
    it('應返回對應顏色', () => {
      expect(getPlanTypeTagColor('activity')).toBe('blue');
      expect(getPlanTypeTagColor('communication')).toBe('purple');
      expect(getPlanTypeTagColor('intimacy')).toBe('pink');
      expect(getPlanTypeTagColor('gift')).toBe('cyan');
      expect(getPlanTypeTagColor('service')).toBe('green');
    });
    it('未知類型應返回 default', () => {
      expect(getPlanTypeTagColor('other')).toBe('default');
    });
  });

  describe('getDifficultyTagColor', () => {
    it('應返回對應顏色', () => {
      expect(getDifficultyTagColor('easy')).toBe('success');
      expect(getDifficultyTagColor('medium')).toBe('warning');
      expect(getDifficultyTagColor('hard')).toBe('error');
    });
    it('未知難度應返回 default', () => {
      expect(getDifficultyTagColor('unknown')).toBe('default');
    });
  });

  describe('getExecutionStatusTag', () => {
    it('應渲染對應狀態文案', () => {
      const { container } = render(getExecutionStatusTag('pending'));
      expect(container.textContent).toContain('待開始');
      const { container: c2 } = render(getExecutionStatusTag('in_progress'));
      expect(c2.textContent).toContain('進行中');
      const { container: c3 } = render(getExecutionStatusTag('completed'));
      expect(c3.textContent).toContain('已完成');
    });
    it('未知狀態應原樣顯示', () => {
      const { container } = render(getExecutionStatusTag('unknown'));
      expect(container.textContent).toContain('unknown');
    });
  });

  describe('getCaseStatusTag', () => {
    it('應渲染對應案件狀態文案', () => {
      const { container } = render(getCaseStatusTag('draft'));
      expect(container.textContent).toContain('草稿');
      const { container: c2 } = render(getCaseStatusTag('completed'));
      expect(c2.textContent).toContain('已完成');
    });
    it('未知狀態應原樣顯示', () => {
      const { container } = render(getCaseStatusTag('unknown' as unknown as import('@/types/case').CaseStatus));
      expect(container.textContent).toContain('unknown');
    });
  });

  describe('getCaseTypeTag', () => {
    it('應渲染案件類型文案', () => {
      const { container } = render(getCaseTypeTag('生活習慣衝突'));
      // Implementation uses i18n key caseList.typeLife for 生活習慣衝突
      expect(container.textContent).toMatch(/生活習慣|caseList\.typeLife/);
    });
    it('未知類型應原樣顯示', () => {
      const { container } = render(getCaseTypeTag('other'));
      expect(container.textContent).toContain('other');
    });
  });
});
