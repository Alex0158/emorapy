import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { CelebrationOverlay, useCelebration } from './index';
import { renderHook } from '@testing-library/react';

describe('CelebrationOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('show=false 時不渲染任何內容', () => {
    const { container } = render(<CelebrationOverlay show={false} />);
    expect(container.firstElementChild).toBeNull();
  });

  it('show=true 時渲染粒子動畫容器', () => {
    const { container } = render(<CelebrationOverlay show={true} />);
    // 應有帶 pointer-events-none 的固定容器
    const overlay = container.querySelector('.pointer-events-none');
    expect(overlay).toBeInTheDocument();
  });

  it('設置 aria-hidden 保持無障礙', () => {
    const { container } = render(<CelebrationOverlay show={true} />);
    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).toBeInTheDocument();
  });

  it('duration 結束後調用 onComplete', () => {
    const onComplete = vi.fn();
    render(<CelebrationOverlay show={true} onComplete={onComplete} duration={1000} />);

    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('自定義 particleCount 產生對應數量粒子', () => {
    const { container } = render(
      <CelebrationOverlay show={true} particleCount={10} />,
    );
    // 粒子數量 = particleCount (rounded-full divs) + 1 central glow
    const particles = container.querySelectorAll('.rounded-full');
    // At least particleCount particles
    expect(particles.length).toBeGreaterThanOrEqual(10);
  });
});

describe('useCelebration hook', () => {
  it('初始狀態為 false', () => {
    const { result } = renderHook(() => useCelebration());
    expect(result.current.celebrating).toBe(false);
  });

  it('celebrate() 設置為 true', () => {
    const { result } = renderHook(() => useCelebration());
    act(() => {
      result.current.celebrate();
    });
    expect(result.current.celebrating).toBe(true);
  });

  it('onComplete() 設置為 false', () => {
    const { result } = renderHook(() => useCelebration());
    act(() => {
      result.current.celebrate();
    });
    act(() => {
      result.current.onComplete();
    });
    expect(result.current.celebrating).toBe(false);
  });
});
