import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MediatorAvatar from './index';

describe('MediatorAvatar', () => {
  it('預設應渲染中立圖示', () => {
    render(<MediatorAvatar />);
    const el = document.querySelector('.mediator-avatar');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-label', '中立調解圖示');
    expect(el?.textContent).toContain('🤝');
  });

  it('size=small 應應用對應樣式', () => {
    render(<MediatorAvatar size="small" />);
    const el = document.querySelector('.mediator-avatar.small');
    expect(el).toBeInTheDocument();
  });

  it('animated=false 時不應有 animated class', () => {
    render(<MediatorAvatar animated={false} />);
    const el = document.querySelector('.mediator-avatar');
    expect(el).not.toHaveClass('animated');
  });

  it('appearance=support 時應渲染支援圖示', () => {
    render(<MediatorAvatar appearance="support" />);
    const el = document.querySelector('.mediator-avatar.appearance-support');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-label', '支援助手圖示');
    expect(el?.textContent).toContain('✨');
  });
});
