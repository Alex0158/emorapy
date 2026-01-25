/**
 * 動畫工具函數 - 增強版
 */

/**
 * 淡入動畫
 */
export const fadeIn = (element: HTMLElement, duration = 300): void => {
  element.style.opacity = '0';
  element.style.transition = `opacity ${duration}ms ease`;

  requestAnimationFrame(() => {
    element.style.opacity = '1';
  });
};

/**
 * 淡出動畫
 */
export const fadeOut = (element: HTMLElement, duration = 300): Promise<void> => {
  return new Promise((resolve) => {
    element.style.transition = `opacity ${duration}ms ease`;
    element.style.opacity = '0';

    setTimeout(() => {
      resolve();
    }, duration);
  });
};

/**
 * 滑入動畫
 */
export const slideIn = (
  element: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  duration = 300
): void => {
  const directions = {
    up: { from: 'translateY(20px)', to: 'translateY(0)' },
    down: { from: 'translateY(-20px)', to: 'translateY(0)' },
    left: { from: 'translateX(20px)', to: 'translateX(0)' },
    right: { from: 'translateX(-20px)', to: 'translateX(0)' },
  };

  const { from, to } = directions[direction];

  element.style.transform = from;
  element.style.opacity = '0';
  element.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;

  requestAnimationFrame(() => {
    element.style.transform = to;
    element.style.opacity = '1';
  });
};

/**
 * 縮放動畫
 */
export const scaleIn = (element: HTMLElement, duration = 300): void => {
  element.style.transform = 'scale(0.8)';
  element.style.opacity = '0';
  element.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;

  requestAnimationFrame(() => {
    element.style.transform = 'scale(1)';
    element.style.opacity = '1';
  });
};

/**
 * 震動動畫（用於錯誤提示）
 */
export const shake = (element: HTMLElement, duration = 500): void => {
  const keyframes = [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-10px)' },
    { transform: 'translateX(10px)' },
    { transform: 'translateX(-10px)' },
    { transform: 'translateX(10px)' },
    { transform: 'translateX(0)' },
  ];

  element.animate(keyframes, {
    duration,
    easing: 'ease-in-out',
  });
};

/**
 * 脈衝動畫（用於吸引注意力）
 */
export const pulse = (element: HTMLElement, duration = 1000, iterations = 3): void => {
  const keyframes = [
    { transform: 'scale(1)', opacity: '1' },
    { transform: 'scale(1.05)', opacity: '0.9' },
    { transform: 'scale(1)', opacity: '1' },
  ];

  element.animate(keyframes, {
    duration,
    iterations,
    easing: 'ease-in-out',
  });
};

/**
 * 彈跳動畫（用於成功提示）
 */
export const bounce = (element: HTMLElement, duration = 600): void => {
  const keyframes = [
    { transform: 'translateY(0)', offset: 0 },
    { transform: 'translateY(-20px)', offset: 0.5 },
    { transform: 'translateY(0)', offset: 1 },
  ];

  element.animate(keyframes, {
    duration,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  });
};

/**
 * 旋轉動畫（用於加載狀態）
 */
export const spin = (element: HTMLElement, duration = 1000): (() => void) => {
  const keyframes = [
    { transform: 'rotate(0deg)' },
    { transform: 'rotate(360deg)' },
  ];

  const animation = element.animate(keyframes, {
    duration,
    iterations: Infinity,
    easing: 'linear',
  });

  return () => animation.cancel();
};

/**
 * 漸進式顯示（Stagger動畫，用於列表）
 */
export const staggerIn = (
  elements: NodeListOf<HTMLElement> | HTMLElement[],
  delay = 100,
  duration = 300
): void => {
  Array.from(elements).forEach((element, index) => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;

    setTimeout(() => {
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
      });
    }, index * delay);
  });
};

/**
 * 進度條動畫（從0到目標值）
 */
export const animateProgress = (
  element: HTMLElement,
  targetValue: number,
  duration = 1000
): void => {
  const startValue = 0;
  const startTime = performance.now();

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 使用ease-out緩動函數
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = startValue + (targetValue - startValue) * eased;

    element.style.width = `${currentValue}%`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      element.style.width = `${targetValue}%`;
    }
  };

  requestAnimationFrame(animate);
};

/**
 * 數字滾動動畫
 */
export const animateNumber = (
  element: HTMLElement,
  targetValue: number,
  duration = 1000,
  formatter?: (value: number) => string
): void => {
  const startValue = 0;
  const startTime = performance.now();

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 使用ease-out緩動函數
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.floor(startValue + (targetValue - startValue) * eased);

    element.textContent = formatter ? formatter(currentValue) : String(currentValue);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      element.textContent = formatter ? formatter(targetValue) : String(targetValue);
    }
  };

  requestAnimationFrame(animate);
};

/**
 * 視差滾動效果
 */
export const parallax = (element: HTMLElement, speed = 0.5): (() => void) => {
  const handleScroll = () => {
    const scrolled = window.pageYOffset;
    const rate = scrolled * speed;
    element.style.transform = `translateY(${rate}px)`;
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', handleScroll);
  };
};

/**
 * 滾動到元素（平滑滾動）
 */
export const scrollToElement = (
  element: HTMLElement,
  offset = 0,
  duration = 500
): void => {
  const startPosition = window.pageYOffset;
  const targetPosition = element.offsetTop - offset;
  const distance = targetPosition - startPosition;
  const startTime = performance.now();

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 使用ease-in-out緩動函數
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    window.scrollTo(0, startPosition + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};
