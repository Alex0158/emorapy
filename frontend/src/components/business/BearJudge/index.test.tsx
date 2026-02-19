/**
 * BearJudge 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BearJudge from './index';

describe('BearJudge', () => {
  it('預設應渲染中立圖示', () => {
    render(<BearJudge />);
    const el = document.querySelector('.bear-judge');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-label', '中立調解圖示');
    expect(el?.textContent).toContain('🤝');
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

  it('appearance=bear 時應渲染熊圖示', () => {
    render(<BearJudge appearance="bear" />);
    const el = document.querySelector('.bear-judge.appearance-bear');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-label', '熊形象圖示');
    expect(el?.textContent).toContain('🐻');
  });
});
