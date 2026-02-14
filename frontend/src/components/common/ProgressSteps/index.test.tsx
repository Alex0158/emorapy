/**
 * ProgressSteps 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressSteps from './index';

describe('ProgressSteps', () => {
  const items = [
    { title: '第一步' },
    { title: '第二步', description: '說明' },
    { title: '第三步' },
  ];

  it('應渲染步驟標題', () => {
    render(<ProgressSteps current={0} items={items} />);
    expect(screen.getByText('第一步')).toBeInTheDocument();
    expect(screen.getByText('第二步')).toBeInTheDocument();
    expect(screen.getByText('第三步')).toBeInTheDocument();
  });

  it('應渲染 description 當有提供時', () => {
    render(<ProgressSteps current={0} items={items} />);
    expect(screen.getByText('說明')).toBeInTheDocument();
  });

  it('應有 progress-steps-wrapper 類名', () => {
    const { container } = render(<ProgressSteps current={1} items={items} />);
    expect(container.querySelector('.progress-steps-wrapper')).toBeInTheDocument();
  });
});
