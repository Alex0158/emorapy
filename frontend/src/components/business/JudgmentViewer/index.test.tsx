/**
 * JudgmentViewer 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import JudgmentViewer from './index';

vi.mock('@/utils/helpers', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

describe('JudgmentViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應渲染 content 與預設標題', () => {
    render(<JudgmentViewer content="判決正文" />);
    expect(screen.getByText('判決書')).toBeInTheDocument();
    expect(screen.getByText('判決正文')).toBeInTheDocument();
  });

  it('應支援自定義 title', () => {
    render(<JudgmentViewer content="x" title="我的判決" />);
    expect(screen.getByText('我的判決')).toBeInTheDocument();
  });

  it('showActions=false 時不顯示操作按鈕', () => {
    render(<JudgmentViewer content="x" showActions={false} />);
    expect(screen.queryByRole('button', { name: /複製|列印/ })).toBeNull();
  });
});
