/**
 * ProgressSteps 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressSteps from './index';

describe('ProgressSteps', () => {
  const items = [
    { title: '第一步' },
    { title: '第二步' },
    { title: '第三步' },
  ];

  it('應渲染步驟標題', () => {
    render(<ProgressSteps current={0} items={items} />);
    expect(screen.getByText('第一步')).toBeInTheDocument();
    expect(screen.getByText('第二步')).toBeInTheDocument();
    expect(screen.getByText('第三步')).toBeInTheDocument();
  });

  it('當前步驟應有 primary 色', () => {
    const { container } = render(<ProgressSteps current={1} items={items} />);
    const circles = container.querySelectorAll('.rounded-full');
    // 前兩個（index 0, 1）應有 bg-primary
    expect(circles[0]?.className).toContain('bg-primary');
    expect(circles[1]?.className).toContain('bg-primary');
  });

  it('應渲染步驟編號', () => {
    render(<ProgressSteps current={0} items={items} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
