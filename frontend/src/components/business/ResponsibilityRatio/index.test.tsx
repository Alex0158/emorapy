/**
 * ResponsibilityRatio 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResponsibilityRatio from './index';

describe('ResponsibilityRatio', () => {
  it('應渲染責任比例', () => {
    render(<ResponsibilityRatio ratio={{ plaintiff: 60, defendant: 40 }} />);
    expect(screen.getByText(/角色A: 60%/)).toBeInTheDocument();
    expect(screen.getByText(/角色B: 40%/)).toBeInTheDocument();
  });

  it('應支援 size 與 showLabels', () => {
    render(
      <ResponsibilityRatio ratio={{ plaintiff: 50, defendant: 50 }} size="small" showLabels={false} />
    );
    const el = document.querySelector('.responsibility-ratio.small');
    expect(el).toBeInTheDocument();
  });
});
