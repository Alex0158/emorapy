/**
 * GuideTooltip 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import GuideTooltip from './index';

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('@/utils/storage', () => ({
  localStore: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
  },
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));

describe('GuideTooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
  });

  it('應渲染 children', () => {
    render(
      <GuideTooltip content="提示" storageKey="guide-1">
        <button type="button">觸發</button>
      </GuideTooltip>
    );
    expect(screen.getByRole('button', { name: '觸發' })).toBeInTheDocument();
  });

  it('showOnce 且未看過時應查詢 storage 並顯示 Tooltip', () => {
    mockGet.mockReturnValue(null);
    render(
      <GuideTooltip content="首次提示" storageKey="g1" showOnce>
        <span>子</span>
      </GuideTooltip>
    );
    expect(mockGet).toHaveBeenCalledWith('g1');
    expect(screen.getByText('子')).toBeInTheDocument();
    expect(screen.getByText('首次提示')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'guideTooltip.close' })).toBeInTheDocument();
  });

  it('showOnce 且已看過時不應顯示 Tooltip', () => {
    mockGet.mockReturnValue(true);
    render(
      <GuideTooltip content="已讀提示" storageKey="g2" showOnce>
        <span>子</span>
      </GuideTooltip>
    );
    expect(mockGet).toHaveBeenCalledWith('g2');
    expect(screen.getByText('子')).toBeInTheDocument();
    expect(screen.queryByText('已讀提示')).not.toBeInTheDocument();
  });
});
