/**
 * StatementInput 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatementInput from './index';

vi.mock('@/utils/validate', () => ({
  validateStatement: vi.fn(() => ({ valid: true })),
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
});
