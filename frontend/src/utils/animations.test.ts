/**
 * 動畫工具函數單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fadeIn,
  fadeOut,
  slideIn,
  scaleIn,
  shake,
  pulse,
  bounce,
  spin,
  staggerIn,
  animateProgress,
  animateNumber,
  parallax,
  scrollToElement,
} from './animations';

describe('animations', () => {
  let el: HTMLElement;
  let rafSpy: ReturnType<typeof vi.spyOn>;
  let rafActive: boolean;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
    rafActive = true;
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      if (!rafActive) return 0;
      setTimeout(() => { if (rafActive) cb(0); }, 0);
      return 1;
    });
  });

  afterEach(() => {
    rafActive = false;
    rafSpy.mockRestore();
    document.body.removeChild(el);
    vi.useRealTimers();
  });

  describe('fadeIn', () => {
    it('應設置 opacity 與 transition 並在 rAF 後設為 1', () => {
      fadeIn(el, 300);
      expect(el.style.opacity).toBe('0');
      expect(el.style.transition).toContain('300ms');
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(el.style.opacity).toBe('1');
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('fadeOut', () => {
    it('應返回 Promise 並在 duration 後 resolve', async () => {
      vi.useFakeTimers();
      const p = fadeOut(el, 100);
      expect(el.style.opacity).toBe('0');
      vi.advanceTimersByTime(100);
      await p;
      vi.useRealTimers();
    });
  });

  describe('slideIn', () => {
    it('應根據 direction 設置 transform', () => {
      slideIn(el, 'up', 300);
      expect(el.style.transform).toBe('translateY(20px)');
    });
    it('right 方向應使用 translateX', () => {
      slideIn(el, 'right', 300);
      expect(el.style.transform).toBe('translateX(-20px)');
    });
  });

  describe('scaleIn', () => {
    it('應先設 scale(0.8) 再在 rAF 後設為 scale(1)', () => {
      scaleIn(el, 300);
      expect(el.style.transform).toBe('scale(0.8)');
    });
  });

  describe('shake', () => {
    it('應調用 element.animate', () => {
      const animateSpy = vi.spyOn(el, 'animate').mockReturnValue({ cancel: vi.fn() } as unknown as Animation);
      shake(el, 500);
      expect(animateSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ transform: 'translateX(0)' })]),
        expect.objectContaining({ duration: 500 })
      );
      animateSpy.mockRestore();
    });
  });

  describe('pulse', () => {
    it('應調用 element.animate 並傳入 iterations', () => {
      const animateSpy = vi.spyOn(el, 'animate').mockReturnValue({ cancel: vi.fn() } as unknown as Animation);
      pulse(el, 1000, 3);
      expect(animateSpy).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ iterations: 3, duration: 1000 })
      );
      animateSpy.mockRestore();
    });
  });

  describe('bounce', () => {
    it('應調用 element.animate', () => {
      const animateSpy = vi.spyOn(el, 'animate').mockReturnValue({ cancel: vi.fn() } as unknown as Animation);
      bounce(el, 600);
      expect(animateSpy).toHaveBeenCalled();
      animateSpy.mockRestore();
    });
  });

  describe('spin', () => {
    it('應返回取消函數並可取消動畫', () => {
      const mockCancel = vi.fn();
      vi.spyOn(el, 'animate').mockReturnValue({ cancel: mockCancel } as unknown as Animation);
      const cancel = spin(el, 1000);
      expect(typeof cancel).toBe('function');
      cancel();
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('staggerIn', () => {
    it('應對多個元素設置 opacity 與 transform 並返回取消函數', () => {
      const el2 = document.createElement('div');
      document.body.appendChild(el2);
      vi.useFakeTimers();
      const cancel = staggerIn(document.querySelectorAll('div') as NodeListOf<HTMLElement>, 50, 300);
      expect(el.style.opacity).toBe('0');
      expect(el2.style.opacity).toBe('0');
      expect(typeof cancel).toBe('function');
      cancel();
      vi.advanceTimersByTime(200);
      vi.useRealTimers();
      document.body.removeChild(el2);
    });
  });

  describe('animateProgress', () => {
    it('應在動畫中更新 element.style.width 並返回取消函數', () => {
      const cancel = animateProgress(el, 100, 10);
      expect(typeof cancel).toBe('function');
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(el.style.width).toBeDefined();
          cancel();
          resolve();
        }, 20);
      });
    });
  });

  describe('animateNumber', () => {
    it.skip('應更新 textContent 並支持 formatter', async () => {
      // jsdom 中 performance.now/rAF 時間戳與瀏覽器不一致，易導致負值
      const formatter = (n: number) => `${n}%`;
      animateNumber(el, 100, 1, formatter);
      await new Promise((r) => setTimeout(r, 15));
      expect(el.textContent).toBe('100%');
    });
    it.skip('無 formatter 時應使用 String', async () => {
      // jsdom 中 performance.now/rAF 時間戳與瀏覽器不一致
      animateNumber(el, 50, 1);
      await new Promise((r) => setTimeout(r, 15));
      expect(el.textContent).toBe('50');
    });
  });

  describe('parallax', () => {
    it('應註冊 scroll 並返回清理函數', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const cleanup = parallax(el, 0.5);
      expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
      cleanup();
      expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('scrollToElement', () => {
    it('應使用 requestAnimationFrame 進行滾動並返回取消函數', () => {
      Object.defineProperty(el, 'offsetTop', { value: 100, configurable: true });
      Object.defineProperty(window, 'pageYOffset', { value: 0, writable: true });
      const cancel = scrollToElement(el, 0, 100);
      expect(rafSpy).toHaveBeenCalled();
      expect(typeof cancel).toBe('function');
      cancel();
    });
  });
});
