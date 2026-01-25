/**
 * 動畫Hook
 */

import { useEffect, useRef, useState } from 'react';

/**
 * 淡入動畫Hook
 */
export const useFadeIn = (duration = 300, delay = 0) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (isVisible && elementRef.current) {
      elementRef.current.style.opacity = '0';
      elementRef.current.style.transition = `opacity ${duration}ms ease`;
      requestAnimationFrame(() => {
        if (elementRef.current) {
          elementRef.current.style.opacity = '1';
        }
      });
    }
  }, [isVisible, duration]);

  return { ref: elementRef, isVisible };
};

/**
 * 滑入動畫Hook
 */
export const useSlideIn = (
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  duration = 300,
  delay = 0
) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (isVisible && elementRef.current) {
      const directions = {
        up: { from: 'translateY(20px)', to: 'translateY(0)' },
        down: { from: 'translateY(-20px)', to: 'translateY(0)' },
        left: { from: 'translateX(20px)', to: 'translateX(0)' },
        right: { from: 'translateX(-20px)', to: 'translateX(0)' },
      };

      const { from, to } = directions[direction];
      const element = elementRef.current;

      element.style.transform = from;
      element.style.opacity = '0';
      element.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;

      requestAnimationFrame(() => {
        if (element) {
          element.style.transform = to;
          element.style.opacity = '1';
        }
      });
    }
  }, [isVisible, direction, duration]);

  return { ref: elementRef, isVisible };
};

/**
 * 交際動畫Hook（當元素進入視口時觸發動畫）
 */
export const useIntersectionAnimation = (
  options: IntersectionObserverInit = {}
) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.1,
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return { ref: elementRef, isVisible };
};

/**
 * 懸停動畫Hook
 */
export const useHoverAnimation = () => {
  const [isHovered, setIsHovered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return { ref: elementRef, isHovered };
};

