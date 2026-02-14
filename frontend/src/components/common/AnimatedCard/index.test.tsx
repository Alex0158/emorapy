/**
 * AnimatedCard 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnimatedCard from './index';

vi.mock('@/utils/animations', () => ({
  fadeIn: vi.fn(),
  slideIn: vi.fn(),
}));

describe('AnimatedCard', () => {
  it('應渲染 children', () => {
    render(<AnimatedCard>內容</AnimatedCard>);
    expect(screen.getByText('內容')).toBeInTheDocument();
  });

  it('animation=none 時應仍渲染', () => {
    render(<AnimatedCard animation="none">x</AnimatedCard>);
    expect(screen.getByText('x')).toBeInTheDocument();
  });
});
