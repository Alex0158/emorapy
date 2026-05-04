/**
 * 動畫包裝組件（遷移：LESS → inline transition styles）
 */

import React, { type ReactNode } from 'react';
import { useFadeIn, useSlideIn, useIntersectionAnimation } from '@/hooks/useAnimation';
import { cn } from '@/lib/utils';

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
  } else if (animation === 'slide') {
    animationRef = slideIn.ref;
    isVisible = slideIn.isVisible;
  } else {
    animationRef = fadeIn.ref;
    isVisible = fadeIn.isVisible;
  }

  if (animation === 'none') {
    return <div className={className}>{children}</div>;
  }

  const getTransform = () => {
    if (isVisible) return 'none';
    if (animation === 'scale') return 'scale(0.95)';
    if (direction === 'up') return 'translateY(20px)';
    if (direction === 'down') return 'translateY(-20px)';
    if (direction === 'left') return 'translateX(20px)';
    if (direction === 'right') return 'translateX(-20px)';
    return 'none';
  };

  return (
    <div
      ref={animationRef as React.RefObject<HTMLDivElement>}
      className={cn(className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transition: `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

export default AnimatedWrapper;
