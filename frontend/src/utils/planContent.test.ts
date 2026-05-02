/**
 * planContent 工具函數單元測試
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

import { safeParsePlanContent } from './planContent';

describe('safeParsePlanContent', () => {
  it('有效 JSON 應正確解析所有欄位', () => {
    const raw = JSON.stringify({
      title: '方案一',
      description: '描述文字',
      steps: ['步驟一', '步驟二'],
      expected_effect: '預期效果',
    });
    const result = safeParsePlanContent(raw);
    expect(result).toEqual({
      title: '方案一',
      description: '描述文字',
      steps: ['步驟一', '步驟二'],
      expected_effect: '預期效果',
      fit_reason: '',
      do_not_use_when: [],
      first_step: '',
      fallback_step: '',
      pause_rule: '',
      risk_note: '',
    });
  });

  it('JSON 缺少欄位時應使用 fallback', () => {
    const raw = JSON.stringify({ title: '只有標題' });
    const result = safeParsePlanContent(raw);
    expect(result.title).toBe('只有標題');
    expect(result.description).toBe(raw);
    expect(result.steps).toEqual([]);
    expect(result.expected_effect).toBe('');
  });

  it('JSON 中 steps 含非字串元素時應過濾掉', () => {
    const raw = JSON.stringify({
      title: 'T',
      description: 'D',
      steps: ['valid', 123, null, 'also-valid'],
      expected_effect: 'E',
    });
    const result = safeParsePlanContent(raw);
    expect(result.steps).toEqual(['valid', 'also-valid']);
  });

  it('非 JSON 字串應 fallback 為第一行作 title、原始內容作 description', () => {
    const raw = '第一行\n第二行\n第三行';
    const result = safeParsePlanContent(raw);
    expect(result.title).toBe('第一行');
    expect(result.description).toBe(raw);
    expect(result.steps).toEqual([]);
    expect(result.expected_effect).toBe('');
  });

  it('空字串應 fallback 且 title 使用 i18n key', () => {
    const result = safeParsePlanContent('');
    expect(result.title).toBe('reconList.heading');
    expect(result.description).toBe('');
    expect(result.steps).toEqual([]);
  });

  it('null 或 undefined 應 fallback 為空字串且不拋錯', () => {
    const r1 = safeParsePlanContent(null as unknown as string);
    const r2 = safeParsePlanContent(undefined as unknown as string);
    expect(r1.title).toBe('reconList.heading');
    expect(r1.description).toBe('');
    expect(r1.steps).toEqual([]);
    expect(r2.title).toBe('reconList.heading');
    expect(r2.description).toBe('');
    expect(r2.steps).toEqual([]);
  });

  it('JSON 為非物件（如 array/null）時應 fallback', () => {
    const raw = JSON.stringify([1, 2, 3]);
    const result = safeParsePlanContent(raw);
    expect(result.description).toBe(raw);
  });

  it('JSON 欄位型別錯誤時應使用 fallback 值', () => {
    const raw = JSON.stringify({
      title: 123,
      description: false,
      steps: 'not-an-array',
      expected_effect: null,
    });
    const result = safeParsePlanContent(raw);
    expect(result.title).toBe(raw.split('\n')[0]);
    expect(result.description).toBe(raw);
    expect(result.steps).toEqual([]);
    expect(result.expected_effect).toBe('');
  });
});
