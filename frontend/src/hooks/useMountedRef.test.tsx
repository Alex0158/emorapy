import { StrictMode, useEffect, useState } from 'react';
import { render, screen, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMountedRef } from './useMountedRef';

function MountedFlag() {
  const mountedRef = useMountedRef();
  const [status, setStatus] = useState('not-mounted');

  useEffect(() => {
    setStatus(mountedRef.current ? 'mounted' : 'not-mounted');
  }, [mountedRef]);

  return <div>{status}</div>;
}

describe('useMountedRef', () => {
  it('在 StrictMode 下重新掛載後仍應保持 mounted=true', async () => {
    render(
      <StrictMode>
        <MountedFlag />
      </StrictMode>
    );

    expect(await screen.findByText('mounted')).toBeInTheDocument();
  });

  it('unmount 時 cleanup 應將 mountedRef.current 設為 false', () => {
    let capturedRef: ReturnType<typeof useMountedRef> | null = null;
    function Child() {
      const ref = useMountedRef();
      useEffect(() => {
        capturedRef = ref;
        return () => {
          capturedRef = ref;
        };
      }, [ref]);
      return <div>child</div>;
    }
    const { unmount } = render(<Child />);
    expect(capturedRef?.current).toBe(true);
    unmount();
    expect(capturedRef?.current).toBe(false);
  });

  it('非同步完成後若已 unmount，mountedRef.current 應為 false，供呼叫方避免 setState', async () => {
    let capturedRef: ReturnType<typeof useMountedRef> | null = null;
    const asyncResolved = vi.fn();
    function AsyncChild() {
      const ref = useMountedRef();
      useEffect(() => {
        capturedRef = ref;
        // 模擬 fetch 等不隨 unmount 取消的 async：timeout 不 clear，讓其在 unmount 後觸發
        const t = setTimeout(() => {
          asyncResolved(ref.current);
        }, 50);
        return () => {
          capturedRef = ref;
        };
      }, [ref]);
      return <div>async</div>;
    }
    const { unmount } = render(<AsyncChild />);
    expect(capturedRef?.current).toBe(true);
    unmount();
    await new Promise((r) => setTimeout(r, 100));
    expect(asyncResolved).toHaveBeenCalledWith(false);
  });

  it('應返回穩定 ref 實例（重渲染不變）', () => {
    const { result, rerender } = renderHook(() => useMountedRef());
    const ref1 = result.current;
    rerender();
    const ref2 = result.current;
    expect(ref1).toBe(ref2);
  });
});
