/**
 * 動畫包裝組件
 */

import React, { type ReactNode } from 'react';
import { useFadeIn, useSlideIn, useIntersectionAnimation } from '@/hooks/useAnimation';
import './AnimatedWrapper.less';

interface AnimatedWrapperProps {
  children: ReactNode;
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  delay?: number;
  trigger?: 'mount' | 'intersection';
  className?: string;
}

const AnimatedWrapper: React.FC<AnimatedWrapperProps> = ({
  children,
  animation = 'fade',
  direction = 'up',
  duration = 300,
  delay = 0,
  trigger = 'mount',
  className = '',
}) => {
  const fadeIn = useFadeIn(duration, delay);
  const slideIn = useSlideIn(direction, duration, delay);
  const intersection = useIntersectionAnimation();

  let animationRef;
  let isVisible = false;

  if (trigger === 'intersection') {
    animationRef = intersection.ref;
    isVisible = intersection.isVisible;
  } else if (animation === 'fade') {
    animationRef = fadeIn.ref;
    isVisible = fadeIn.isVisible;
  } else if (animation === 'slide') {
    animationRef = slideIn.ref;
    isVisible = slideIn.isVisible;
  }

  const getAnimationClass = () => {
    if (animation === 'none' || !isVisible) return '';
    return `animated-wrapper animated-wrapper--${animation} animated-wrapper--${direction}`;
  };

  return (
    <div
      ref={animationRef as React.RefObject<HTMLDivElement>}
      className={`animated-wrapper ${getAnimationClass()} ${className}`}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

export default AnimatedWrapper;

