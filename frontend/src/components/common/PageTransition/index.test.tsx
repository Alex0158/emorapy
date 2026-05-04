import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageTransition, StaggerContainer, StaggerItem } from './index';

describe('PageTransition', () => {
  it('渲染子內容', () => {
    render(
      <PageTransition>
        <div>Page Content</div>
      </PageTransition>,
    );
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('預設 variant 為 slideUp', () => {
    const { container } = render(
      <PageTransition>
        <div>Content</div>
      </PageTransition>,
    );
    // Framer Motion renders motion.div with style
    const motionDiv = container.firstElementChild;
    expect(motionDiv).toBeInTheDocument();
  });

  it('支持 className prop', () => {
    const { container } = render(
      <PageTransition className="custom-class">
        <div>Content</div>
      </PageTransition>,
    );
    const motionDiv = container.firstElementChild;
    expect(motionDiv?.className).toContain('custom-class');
  });

  it('支持所有 variant 類型', () => {
    const variants = ['fade', 'slideUp', 'slideLeft', 'scale'] as const;
    for (const variant of variants) {
      const { unmount } = render(
        <PageTransition variant={variant}>
          <div>{variant}</div>
        </PageTransition>,
      );
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('StaggerContainer + StaggerItem', () => {
  it('渲染所有子項', () => {
    render(
      <StaggerContainer>
        <StaggerItem>Item 1</StaggerItem>
        <StaggerItem>Item 2</StaggerItem>
        <StaggerItem>Item 3</StaggerItem>
      </StaggerContainer>,
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('StaggerContainer 支持 className', () => {
    const { container } = render(
      <StaggerContainer className="grid gap-4">
        <StaggerItem>Item</StaggerItem>
      </StaggerContainer>,
    );
    expect(container.firstElementChild?.className).toContain('grid');
  });
});
