/**
 * 慶祝動畫覆蓋層
 *
 * 在關鍵里程碑時提供正向反饋：
 * - 案例提交成功
 * - 執行打卡完成
 * - 訪談完成
 * - 和解方案接受
 *
 * 使用 Framer Motion 實現品牌色粒子動畫。
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  rotation: number;
}

interface CelebrationOverlayProps {
  show: boolean;
  onComplete?: () => void;
  duration?: number;
  particleCount?: number;
  className?: string;
}

// 品牌暖色粒子色板
const PARTICLE_COLORS = [
  'oklch(0.65 0.15 25)',   // primary coral
  'oklch(0.75 0.14 75)',   // secondary gold
  'oklch(0.68 0.08 170)',  // accent green
  'oklch(0.80 0.10 50)',   // warm peach
  'oklch(0.70 0.12 35)',   // soft orange
];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 8 + 4,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    delay: Math.random() * 0.3,
    rotation: Math.random() * 360,
  }));
}

export function CelebrationOverlay({
  show,
  onComplete,
  duration = 2000,
  particleCount = 24,
  className,
}: CelebrationOverlayProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (show) {
      setParticles(generateParticles(particleCount));
      const timer = setTimeout(() => {
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
    setParticles([]);
  }, [show, duration, particleCount, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={cn(
            'fixed inset-0 pointer-events-none z-50 overflow-hidden',
            className,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          aria-hidden="true"
        >
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                left: `${particle.x}%`,
                top: '50%',
              }}
              initial={{
                opacity: 1,
                scale: 0,
                y: 0,
                rotate: 0,
              }}
              animate={{
                opacity: [1, 1, 0],
                scale: [0, 1.2, 0.8],
                y: [0, -(Math.random() * 300 + 100)],
                x: [(Math.random() - 0.5) * 200],
                rotate: particle.rotation,
              }}
              transition={{
                duration: duration / 1000,
                delay: particle.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ))}

          {/* 中心光暈 */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full"
            style={{
              background: 'radial-gradient(circle, oklch(0.65 0.15 25 / 0.2) 0%, transparent 70%)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 3, 4], opacity: [0, 0.6, 0] }}
            transition={{ duration: duration / 1000, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook: 方便管理慶祝動畫的觸發狀態
 */
export function useCelebration() {
  const [celebrating, setCelebrating] = useState(false);

  const celebrate = useCallback(() => {
    setCelebrating(true);
  }, []);

  const onComplete = useCallback(() => {
    setCelebrating(false);
  }, []);

  return { celebrating, celebrate, onComplete };
}

export default CelebrationOverlay;
