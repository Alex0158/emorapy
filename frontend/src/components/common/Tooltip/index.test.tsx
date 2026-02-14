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

  it('應傳遞 title 給 AntTooltip', () => {
    render(
      <Tooltip title="自定義提示">
        <span>觸發</span>
      </Tooltip>
    );
    expect(screen.getByText('觸發')).toBeInTheDocument();
  });

  it('應支援 placement 等 props', () => {
    render(
      <Tooltip title="T" placement="top">
        <span>內容</span>
      </Tooltip>
    );
    expect(screen.getByText('內容')).toBeInTheDocument();
  });
});
