/**
 * StatementInput 組件單元測試
 * 使用真實 validateStatement 驗證業務邊界（不 mock 核心業務模組）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatementInput from './index';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => {
    if (key === 'validation.statementMin') return '至少{min}字，當前{length}字';
    if (key === 'validation.statementMax') return '不可超過{max}字，當前{length}字';
    if (key === 'statementInput.wordCountOk') return '字數OK';
    if (key === 'statementInput.optional') return '選填';
    if (key === 'statementInput.defaultPlaceholder') return '請詳細描述';
    if (key === 'common.wordCount') return '{count} / {max}';
    return key;
  },
}));

describe('StatementInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應渲染 value 與 placeholder', () => {
    const onChange = vi.fn();
    render(<StatementInput value="已有內容" onChange={onChange} />);
    expect(screen.getByDisplayValue('已有內容')).toBeInTheDocument();
  });

  it('onChange 應在輸入時被調用', async () => {
    const onChange = vi.fn();
    render(<StatementInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/請詳細描述/);
    await userEvent.type(input, 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('應支援 label', () => {
    const onChange = vi.fn();
    render(<StatementInput value="" onChange={onChange} label="原告陳述" />);
    expect(screen.getByText('原告陳述')).toBeInTheDocument();
  });

  it('不足 minLength 時應顯示驗證錯誤與 warning 樣式（邊界：真實 validateStatement 30-2000 規則）', () => {
    const onChange = vi.fn();
    render(<StatementInput value="這是一段不足三十字的短敘述" onChange={onChange} />); // 13 chars < 30
    expect(screen.getByText(/至少30字，當前13字/)).toBeInTheDocument();
    const wordCountEl = document.querySelector('.word-count.warning');
    expect(wordCountEl).toBeInTheDocument();
  });

  it('exactly 29 字時應仍顯示驗證錯誤', () => {
    const onChange = vi.fn();
    render(<StatementInput value="一二三四五六七八九十一二三四五六七八九十一二三四五六七八九" onChange={onChange} />); // 29 chars
    expect(screen.getByText(/至少30字，當前29字/)).toBeInTheDocument();
  });

  it('滿 minLength 時應顯示 valid 樣式', () => {
    const onChange = vi.fn();
    const validStatement = '這是一段超過三十字的原告敘述，用於覆蓋快速體驗當前真實提交流程。'; // ≥30 chars
    render(<StatementInput value={validStatement} onChange={onChange} />);
    expect(document.querySelector('.word-count.success')).toBeInTheDocument();
    expect(document.querySelector('.status-icon.valid')).toBeInTheDocument();
  });

  it('allowEmpty 且 value 為空時應顯示 optional', () => {
    const onChange = vi.fn();
    render(<StatementInput value="" onChange={onChange} allowEmpty role="defendant" />);
    expect(screen.getByText('選填')).toBeInTheDocument();
  });
});
