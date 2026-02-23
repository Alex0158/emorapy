import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SummarySection from './SummarySection';

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('SummarySection', () => {
  it('應渲染 summary 文字', () => {
    render(<SummarySection summary="案件摘要內容" />);
    expect(screen.getByText('案件摘要內容')).toBeInTheDocument();
  });

  it('summary 為 null 時不應渲染摘要文字', () => {
    render(<SummarySection summary={null} />);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('應渲染 Collapse 標題', () => {
    render(<SummarySection summary="test" />);
    expect(screen.getByText('summary.title')).toBeInTheDocument();
  });
});
