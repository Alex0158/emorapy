import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import JudgmentSection from './JudgmentSection';

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/JudgmentViewer', () => ({
  default: ({ content }: { content: string }) => <div data-testid="judgment-viewer">{content}</div>,
}));

describe('JudgmentSection', () => {
  it('應渲染標題和判決內容', () => {
    render(<JudgmentSection content="判決書全文" />);
    expect(screen.getByText('judgment.title')).toBeInTheDocument();
    expect(screen.getByText('判決書全文')).toBeInTheDocument();
  });

  it('應渲染 JudgmentViewer', () => {
    render(<JudgmentSection content="test" />);
    expect(screen.getByTestId('judgment-viewer')).toBeInTheDocument();
  });
});
