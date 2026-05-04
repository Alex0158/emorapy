/**
 * Skeleton 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Skeleton from './index';

describe('Skeleton', () => {
  it('預設 type 為 card 時應有 skeleton-card 類名', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('.skeleton-card')).toBeInTheDocument();
  });

  it('type 為 form 時應有 skeleton-form 類名', () => {
    const { container } = render(<Skeleton type="form" />);
    expect(container.querySelector('.skeleton-form')).toBeInTheDocument();
  });

  it('type 為 list 時應有 skeleton-list 類名', () => {
    const { container } = render(<Skeleton type="list" rows={5} />);
    expect(container.querySelector('.skeleton-list')).toBeInTheDocument();
  });

  it('type 為 text 時應渲染骨架元素', () => {
    const { container } = render(<Skeleton type="text" rows={2} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(2);
  });

  it('rows 應影響 list 的項目數', () => {
    const { container } = render(<Skeleton type="list" rows={4} />);
    const list = container.querySelector('.skeleton-list');
    const items = list?.querySelectorAll('[data-slot="skeleton"]');
    expect(items).toHaveLength(4);
  });
});
