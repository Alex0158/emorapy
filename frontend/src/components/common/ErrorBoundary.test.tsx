/**
 * ErrorBoundary 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const mockLoggerError = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Test error');
  return <span>Child content</span>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('無錯誤時應渲染 children', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('子組件拋錯時應顯示 ErrorFallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('發生錯誤')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('子組件拋錯時應調用 logger.error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(mockLoggerError).toHaveBeenCalledWith('Error caught by boundary', expect.any(Object));
  });

  it('應顯示返回首頁與重新載入按鈕', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /返回首頁/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重新載入/ })).toBeInTheDocument();
  });
});
