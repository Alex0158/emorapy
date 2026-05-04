import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MediatorAvatar from './index';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'mediatorAvatar.aria.neutral': '中立調解圖示',
      'mediatorAvatar.aria.support': '支援助手圖示',
      'mediatorAvatar.aria.balance': '平衡圖示',
    };
    return map[key] ?? key;
  },
}));

describe('MediatorAvatar', () => {
  it('預設應渲染中立圖示', () => {
    render(<MediatorAvatar />);
    const el = screen.getByTestId('mediator-avatar');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-label', '中立調解圖示');
    expect(el.textContent).toContain('🤝');
  });

  it('size=small 應設定正確尺寸', () => {
    render(<MediatorAvatar size="small" />);
    const el = screen.getByTestId('mediator-avatar');
    expect(el).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('animated=false 時不應有動畫 class', () => {
    render(<MediatorAvatar animated={false} />);
    const el = screen.getByTestId('mediator-avatar');
    expect(el.className).not.toContain('animate-');
  });

  it('appearance=support 時應渲染支援圖示', () => {
    render(<MediatorAvatar appearance="support" />);
    const el = screen.getByTestId('mediator-avatar');
    expect(el).toHaveAttribute('aria-label', '支援助手圖示');
    expect(el.textContent).toContain('✨');
  });
});
