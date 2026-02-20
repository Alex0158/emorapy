/**
 * ErrorBoundary 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';

const mockLoggerError = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Test error');
  return <span>Child content</span>;
};

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('無錯誤時應渲染 children', () => {
    renderWithRouter(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('子組件拋錯時應顯示 ErrorFallback', () => {
    renderWithRouter(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/發生錯誤|Something Went Wrong|error/i)).toBeInTheDocument();
  });

  it('子組件拋錯時應調用 logger.error', () => {
    renderWithRouter(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(mockLoggerError).toHaveBeenCalledWith('Error caught by boundary', expect.any(Object));
  });

  it('應顯示操作按鈕', () => {
    renderWithRouter(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
