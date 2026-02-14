/**
 * BearJudge 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BearJudge from './index';

describe('BearJudge', () => {
  it('應渲染且包含熊 emoji', () => {
    render(<BearJudge />);
    const el = document.querySelector('.bear-judge');
    expect(el).toBeInTheDocument();
    expect(el?.textContent).toContain('🐻');
  });

  it('size=small 應應用對應樣式', () => {
    render(<BearJudge size="small" />);
    const el = document.querySelector('.bear-judge.small');
    expect(el).toBeInTheDocument();
  });

  it('animated=false 時不應有 animated class', () => {
    render(<BearJudge animated={false} />);
    const el = document.querySelector('.bear-judge');
    expect(el).not.toHaveClass('animated');
  });
});
