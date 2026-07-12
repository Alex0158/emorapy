import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResultHeader from './ResultHeader';

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));

describe('ResultHeader', () => {
  it('應渲染標題和副標題', () => {
    render(<ResultHeader />);
    expect(screen.getByText('result.title')).toBeInTheDocument();
    expect(screen.getByText('result.subtitle')).toBeInTheDocument();
  });

  it('應渲染克制的結果 eyebrow 而非角色化 avatar', () => {
    render(<ResultHeader />);
    expect(screen.getByText('result.eyebrow')).toBeInTheDocument();
    expect(screen.queryByTestId('mediator-avatar')).not.toBeInTheDocument();
  });
});
