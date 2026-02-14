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

  it('showOnce 且未看過時應顯示提示', () => {
    mockGet.mockReturnValue(null);
    render(
      <GuideTooltip content="首次提示" storageKey="g1" showOnce>
        <span>子</span>
      </GuideTooltip>
    );
    expect(screen.getByText('子')).toBeInTheDocument();
  });
});
