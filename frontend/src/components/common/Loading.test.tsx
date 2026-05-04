/**
 * Loading 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loading from './Loading';

describe('Loading', () => {
  it('應渲染加載動畫', () => {
    render(<Loading />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('應顯示加載提示', () => {
    render(<Loading />);
    expect(screen.getByText('加載中...')).toBeInTheDocument();
  });
});
