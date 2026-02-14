/**
 * KeyboardShortcuts 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import KeyboardShortcuts from './index';

describe('KeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <KeyboardShortcuts shortcuts={[{ key: 'Enter', description: '提交', action: vi.fn() }]} />
    );
    expect(container).toBeInTheDocument();
  });

  it('showHelp=false 時不渲染 Modal 內容', () => {
    render(<KeyboardShortcuts shortcuts={[]} showHelp={false} />);
    expect(screen.queryByText('鍵盤快捷鍵')).not.toBeInTheDocument();
  });
});
