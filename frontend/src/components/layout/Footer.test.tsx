/**
 * Footer 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';

describe('Footer', () => {
  it('應渲染版權與標語', () => {
    render(<Footer />);
    expect(screen.getByText(/© 2024 熊媽媽法庭/)).toBeInTheDocument();
    expect(screen.getByText(/即使在法庭/)).toBeInTheDocument();
  });
});
