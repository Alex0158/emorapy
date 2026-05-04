/**
 * ResponsibilityRatio 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResponsibilityRatio from './index';

describe('ResponsibilityRatio', () => {
  it('應渲染責任比例', () => {
    render(<ResponsibilityRatio ratio={{ plaintiff: 60, defendant: 40 }} />);
    expect(screen.getByText(/角色A 60%/)).toBeInTheDocument();
    expect(screen.getByText(/角色B 40%/)).toBeInTheDocument();
  });

  it('size="small" 時應套用 small class', () => {
    const { container } = render(
      <ResponsibilityRatio ratio={{ plaintiff: 50, defendant: 50 }} size="small" />
    );
    // Now uses Tailwind: size="small" applies gap-3 class
    expect(container.firstChild).toHaveClass('gap-3');
  });

  it('showLabels={false} 時不應渲染 responsibility-labels', () => {
    render(
      <ResponsibilityRatio ratio={{ plaintiff: 50, defendant: 50 }} showLabels={false} />
    );
    expect(document.querySelector('.responsibility-labels')).not.toBeInTheDocument();
  });

  it('ratio 為 null 時應不渲染（F04 邊界）', () => {
    const { container } = render(<ResponsibilityRatio ratio={null as unknown as { plaintiff: number; defendant: number }} />);
    expect(container.querySelector('.responsibility-ratio')).not.toBeInTheDocument();
  });

  it('plaintiff 為 undefined 時應不渲染（F04 邊界：API 回傳不完整時不崩潰）', () => {
    const { container } = render(
      <ResponsibilityRatio ratio={{ plaintiff: undefined as unknown as number, defendant: 40 }} />
    );
    expect(container.querySelector('.responsibility-ratio')).not.toBeInTheDocument();
  });

  it('defendant 為 NaN 時應不渲染（F04 邊界：API 回傳不完整時不崩潰）', () => {
    const { container } = render(
      <ResponsibilityRatio ratio={{ plaintiff: 60, defendant: NaN }} />
    );
    expect(container.querySelector('.responsibility-ratio')).not.toBeInTheDocument();
  });
});
