/**
 * 調解員頭像組件（遷移：LESS → Tailwind + cn()）
 */

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { t } from '@/utils/i18n';

export type MediatorAvatarAppearance = 'neutral' | 'support' | 'balance' | 'bear';

export interface MediatorAvatarProps {
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
  appearance?: MediatorAvatarAppearance;
  className?: string;
  style?: CSSProperties;
}

const sizeMap = { small: 32, medium: 120, large: 200 };

const appearanceStyles = {
  neutral: 'bg-gradient-to-br from-[#fff8f3] to-[#ffeede] border-[rgba(255,140,66,0.18)] shadow-[0_8px_20px_rgba(255,140,66,0.16)]',
  support: 'bg-gradient-to-br from-[#fff7ef] to-[#ffe2c7] border-[rgba(255,140,66,0.18)] shadow-[0_8px_20px_rgba(255,140,66,0.16)]',
  balance: 'bg-gradient-to-br from-[#f5f8ff] to-[#e8efff] border-[rgba(24,144,255,0.2)] shadow-[0_8px_20px_rgba(24,144,255,0.1)]',
} as const;

const iconMap = { neutral: '🤝', support: '✨', balance: '⚖️' } as const;

const MediatorAvatar = ({ size = 'medium', animated = true, appearance = 'neutral', className = '', style }: MediatorAvatarProps) => {
  const normalizedAppearance = appearance === 'bear' ? 'support' : appearance;
  const emojiSize = sizeMap[size];

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center select-none rounded-full border text-center leading-none',
        appearanceStyles[normalizedAppearance],
        animated && 'animate-[gentle-bounce_2s_ease-in-out_infinite]',
        className,
      )}
      style={{ width: emojiSize, height: emojiSize, fontSize: emojiSize * 0.52, ...style }}
      role="img"
      aria-label={({ neutral: t('mediatorAvatar.aria.neutral'), support: t('mediatorAvatar.aria.support'), balance: t('mediatorAvatar.aria.balance') })[normalizedAppearance]}
      data-testid="mediator-avatar"
    >
      <span aria-hidden="true">{iconMap[normalizedAppearance]}</span>

      <style>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default MediatorAvatar;
