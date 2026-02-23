/**
 * Tooltip 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Tooltip from './index';

describe('Tooltip', () => {
  it('應渲染 children', () => {
    render(
      <Tooltip title="提示文字">
        <button type="button">懸停</button>
      </Tooltip>
    );
    expect(screen.getByRole('button', { name: '懸停' })).toBeInTheDocument();
  });

  it('傳入 title 與各種 props 時不應拋錯', () => {
    const { unmount } = render(
      <Tooltip title="自定義提示" placement="top" color="blue">
        <span>觸發</span>
      </Tooltip>
    );
    expect(screen.getByText('觸發')).toBeInTheDocument();
    unmount();
  });
});
