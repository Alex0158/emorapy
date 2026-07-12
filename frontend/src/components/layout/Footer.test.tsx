/**
 * Footer 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';

describe('Footer', () => {
  it('應渲染精簡品牌版權', () => {
    render(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${year} Emorapy`))).toBeInTheDocument();
    expect(screen.queryByText(/先聽懂彼此，再慢慢把關係修回來/)).not.toBeInTheDocument();
  });
});
