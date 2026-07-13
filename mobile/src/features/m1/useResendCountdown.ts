import { useCallback, useEffect, useRef, useState } from 'react';

export function useResendCountdown() {
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const deadlineRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    deadlineRef.current = null;
  }, []);

  const clear = useCallback(() => {
    stopTimer();
    if (mountedRef.current) setSecondsRemaining(0);
  }, [stopTimer]);

  const start = useCallback((seconds: number) => {
    if (!mountedRef.current) return;
    stopTimer();
    const initialSeconds = Math.max(0, Math.ceil(seconds));
    if (initialSeconds === 0) {
      setSecondsRemaining(0);
      return;
    }

    deadlineRef.current = Date.now() + initialSeconds * 1000;
    setSecondsRemaining(initialSeconds);
    timerRef.current = setInterval(() => {
      const deadline = deadlineRef.current;
      const remaining = deadline
        ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        : 0;
      setSecondsRemaining(remaining);
      if (remaining === 0) stopTimer();
    }, 1000);
  }, [stopTimer]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopTimer();
    };
  }, [stopTimer]);

  return { clear, secondsRemaining, start };
}
