/**
 * PageHeader 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageHeader from './index';

describe('PageHeader', () => {
  it('應渲染 title', () => {
    render(<PageHeader title="頁面標題" />);
    expect(screen.getByText('頁面標題')).toBeInTheDocument();
  });

  it('應渲染 subtitle 當有提供時', () => {
    render(<PageHeader title="標題" subtitle="副標題" />);
    expect(screen.getByText('副標題')).toBeInTheDocument();
  });

  it('應渲染 extra 當有提供時', () => {
    render(
      <PageHeader title="標題" extra={<button type="button">操作</button>} />
    );
    expect(screen.getByRole('button', { name: '操作' })).toBeInTheDocument();
  });

  it('應渲染 icon 當有提供時', () => {
    const { container } = render(
      <PageHeader title="標題" icon={<span data-testid="icon">🔖</span>} />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(container.querySelector('.page-header-icon')).toBeInTheDocument();
  });

  it('應有 page-header 類名', () => {
    const { container } = render(<PageHeader title="標題" />);
    expect(container.querySelector('.page-header')).toBeInTheDocument();
  });
});
