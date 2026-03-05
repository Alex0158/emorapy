import type { ReactNode } from 'react';

interface AnimatedWrapperProps {
  children: ReactNode;
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  delay?: number;
  className?: string;
}

export default function AnimatedWrapper({
  children,
  animation = 'none',
  duration = 0,
  delay = 0,
  className = '',
}: AnimatedWrapperProps) {
  if (animation === 'none') {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={className}
      style={{
        transitionProperty: 'all',
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
