import type { CSSProperties } from 'react';
import { t } from '@/utils/i18n';
import './MediatorAvatar.less';

export type MediatorAvatarAppearance = 'neutral' | 'support' | 'balance' | 'bear';

export interface MediatorAvatarProps {
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
  appearance?: MediatorAvatarAppearance;
  className?: string;
  style?: CSSProperties;
}

const MediatorAvatar = ({
  size = 'medium',
  animated = true,
  appearance = 'neutral',
  className = '',
  style,
}: MediatorAvatarProps) => {
  // Keep legacy "bear" input compatible during migration.
  const normalizedAppearance = appearance === 'bear' ? 'support' : appearance;

  const sizeMap = {
    small: 32,
    medium: 120,
    large: 200,
  };

  const emojiSize = sizeMap[size];
  const iconMap = {
    neutral: '🤝',
    support: '✨',
    balance: '⚖️',
  } as const;
  const ariaMap = {
    neutral: t('mediatorAvatar.aria.neutral'),
    support: t('mediatorAvatar.aria.support'),
    balance: t('mediatorAvatar.aria.balance'),
  };

  return (
    <div
      className={`mediator-avatar ${size} ${animated ? 'animated' : ''} appearance-${normalizedAppearance} ${className}`}
      style={{ fontSize: `${emojiSize}px`, ...style }}
      role="img"
      aria-label={ariaMap[normalizedAppearance]}
    >
      <span className="mediator-avatar__icon" aria-hidden="true">
        {iconMap[normalizedAppearance]}
      </span>
    </div>
  );
};

export default MediatorAvatar;
