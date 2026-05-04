/**
 * 頁面轉場動畫包裝器
 *
 * 為路由級組件提供進入/退出動畫。
 * 替代現有的 AnimatedWrapper，更輕量且專注於頁面轉場。
 *
 * 使用方式：
 * <PageTransition>
 *   <YourPageContent />
 * </PageTransition>
 *
 * 或在 router LazyWrapper 中統一注入。
 */

import { type ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

type TransitionVariant = 'fade' | 'slideUp' | 'slideLeft' | 'scale';

interface PageTransitionProps {
  children: ReactNode;
  variant?: TransitionVariant;
  className?: string;
  /** 動畫持續時間（秒） */
  duration?: number;
}

const variants: Record<TransitionVariant, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -16 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
};

export function PageTransition({
  children,
  variant = 'slideUp',
  className,
  duration = 0.25,
}: PageTransitionProps) {
  const motionVariants = variants[variant];

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={motionVariants}
      transition={{
        duration,
        ease: [0.16, 1, 0.3, 1], // 品牌 easing
      }}
      className={cn('w-full', className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * 列表項交錯動畫容器
 *
 * 用於卡片網格、列表等需要交錯進入動畫的場景。
 */
export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.05,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      className={className}
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * 單個交錯動畫子元素
 */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
      }}
      transition={{
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
