import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResultHeader from './ResultHeader';

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({
  default: () => <div data-testid="mediator-avatar" />,
}));

describe('ResultHeader', () => {
  it('應渲染標題和副標題', () => {
    render(<ResultHeader />);
    expect(screen.getByText('result.title')).toBeInTheDocument();
    expect(screen.getByText('result.subtitle')).toBeInTheDocument();
  });

  it('應渲染 MediatorAvatar', () => {
    render(<ResultHeader />);
    expect(screen.getByTestId('mediator-avatar')).toBeInTheDocument();
  });
});
