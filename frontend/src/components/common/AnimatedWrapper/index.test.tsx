/**
 * AnimatedWrapper 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnimatedWrapper from './index';

describe('AnimatedWrapper', () => {
  it('應渲染 children', () => {
    render(<AnimatedWrapper>內容</AnimatedWrapper>);
    expect(screen.getByText('內容')).toBeInTheDocument();
  });

  it('應支援 animation 與 direction 且不崩潰', () => {
    const { container } = render(
      <AnimatedWrapper animation="slide" direction="right">
        x
      </AnimatedWrapper>
    );
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(container.querySelector('.animated-wrapper')).toBeInTheDocument();
  });
});
