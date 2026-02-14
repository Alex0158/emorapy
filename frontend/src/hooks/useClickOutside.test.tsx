/**
 * useClickOutside Hook 單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useClickOutside } from './useClickOutside';

describe('useClickOutside', () => {
  it('應返回 ref 對象', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useClickOutside(handler));
    expect(result.current).toHaveProperty('current');
    expect(result.current.current).toBeNull();
  });

  it('點擊 ref 內部不應觸發 handler', async () => {
    const handler = vi.fn();
    const Inner = () => {
      const ref = useClickOutside(handler);
      return <div ref={ref} data-testid="inner">Inside</div>;
    };
    render(<Inner />);
    const inner = screen.getByTestId('inner');
    await userEvent.click(inner);
    expect(handler).not.toHaveBeenCalled();
  });

  it('點擊 ref 外部應觸發 handler', () => {
    const handler = vi.fn();
    const Inner = () => {
      const ref = useClickOutside(handler);
      return (
        <div>
          <div ref={ref} data-testid="inner">Inside</div>
          <button type="button" data-testid="outside">Outside</button>
        </div>
      );
    };
    render(<Inner />);
    const outside = screen.getByTestId('outside');
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).toHaveBeenCalled();
  });

  it('mousedown 在外部應觸發 handler', () => {
    const handler = vi.fn();
    const Inner = () => {
      const ref = useClickOutside(handler);
      return <div ref={ref} data-testid="inner">Inside</div>;
    };
    render(
      <div>
        <Inner />
        <span data-testid="other">Other</span>
      </div>
    );
    const other = screen.getByTestId('other');
    other.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).toHaveBeenCalled();
  });

  it('touchstart 在外部應觸發 handler', () => {
    const handler = vi.fn();
    const Inner = () => {
      const ref = useClickOutside(handler);
      return <div ref={ref} data-testid="inner">Inside</div>;
    };
    render(
      <div>
        <Inner />
        <span data-testid="other">Other</span>
      </div>
    );
    const other = screen.getByTestId('other');
    other.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    expect(handler).toHaveBeenCalled();
  });
});
