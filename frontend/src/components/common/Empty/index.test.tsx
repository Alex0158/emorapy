/**
 * Empty 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Empty from './index';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) =>
    ({ 'common.noData': '暫無數據' }[key] ?? key),
}));

describe('Empty', () => {
  it('預設應顯示「暫無數據」', () => {
    render(<Empty />);
    expect(screen.getByText('暫無數據')).toBeInTheDocument();
  });

  it('應支援自定義 description', () => {
    render(<Empty description="沒有找到案件" />);
    expect(screen.getByText('沒有找到案件')).toBeInTheDocument();
  });

  it('應渲染 children 子節點', () => {
    render(
      <Empty description="空">
        <button type="button">創建</button>
      </Empty>
    );
    expect(screen.getByRole('button', { name: '創建' })).toBeInTheDocument();
  });
});
