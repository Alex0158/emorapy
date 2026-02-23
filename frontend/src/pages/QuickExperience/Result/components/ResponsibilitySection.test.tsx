import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResponsibilitySection from './ResponsibilitySection';

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/ResponsibilityRatio', () => ({
  default: ({ ratio }: { ratio: { plaintiff: number; defendant: number } }) => (
    <div data-testid="ratio">{ratio.plaintiff}:{ratio.defendant}</div>
  ),
}));

describe('ResponsibilitySection', () => {
  it('應渲染標題和責任比例', () => {
    render(<ResponsibilitySection ratio={{ plaintiff: 60, defendant: 40 }} />);
    expect(screen.getByText('responsibility.title')).toBeInTheDocument();
    expect(screen.getByText('60:40')).toBeInTheDocument();
  });

  it('應渲染 ResponsibilityRatio 組件', () => {
    render(<ResponsibilitySection ratio={{ plaintiff: 50, defendant: 50 }} />);
    expect(screen.getByTestId('ratio')).toBeInTheDocument();
  });
});
