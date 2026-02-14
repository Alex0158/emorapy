/**
 * Loading 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loading from './Loading';

describe('Loading', () => {
  it('應渲染加載容器', () => {
    render(<Loading />);
    const container = document.querySelector('.loading-container');
    expect(container).toBeInTheDocument();
  });

  it('應顯示加載提示', () => {
    render(<Loading />);
    expect(screen.getByText('加載中...')).toBeInTheDocument();
  });
});
