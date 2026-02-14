/**
 * Empty 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Empty from './index';

describe('Empty', () => {
  it('預設應顯示「暫無數據」', () => {
    render(<Empty />);
    expect(screen.getByText('暫無數據')).toBeInTheDocument();
  });

  it('應支援自定義 description', () => {
    render(<Empty description="沒有找到案件" />);
    expect(screen.getByText('沒有找到案件')).toBeInTheDocument();
  });

  it('應渲染 action 子節點', () => {
    render(
      <Empty description="空" action={<button type="button">創建</button>} />
    );
    expect(screen.getByRole('button', { name: '創建' })).toBeInTheDocument();
  });
});
