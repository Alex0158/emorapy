import { useEffect, useMemo, useState } from 'react';
import { Typography } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { BulbOutlined } from '@ant-design/icons';
import AIPhaseTimeline from '@/components/common/AIPhaseTimeline';
import AIThinkingIndicator from '@/components/common/AIThinkingIndicator';
import type { ContentItem } from '@/services/api/content';
import type { AIStreamPhase } from '@/types/aiStream';
import { t } from '@/utils/i18n';

const { Text } = Typography;

interface AIAnalyzingAnimationProps {
  tips?: ContentItem[];
  currentPhase?: AIStreamPhase | null;
  phaseHistory?: AIStreamPhase[];
}

export default function AIAnalyzingAnimation({
  tips,
  currentPhase,
  phaseHistory,
}: AIAnalyzingAnimationProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const safeTips = useMemo(() => (Array.isArray(tips) ? tips : []), [tips]);

  useEffect(() => {
    if (safeTips.length === 0) return;
    const timer = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % safeTips.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [safeTips]);

  const currentTip = safeTips.length > 0 ? safeTips[tipIndex] : null;

  return (
    <div className="ai-analyzing-container">
      <motion.div
        className="ai-analyzing-spinner"
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360],
          filter: ['hue-rotate(0deg)', 'hue-rotate(90deg)', 'hue-rotate(0deg)'],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
      <motion.h2
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {t('quickResult.analyzingTitle')}
      </motion.h2>
      <Text>{t('quickResult.analyzingSubtitle')}</Text>

      {currentPhase ? (
        <div className="ai-analyzing-tip-card">
          <div className="ai-analyzing-tip-header">
            <BulbOutlined />
            <Text strong>{t('quickResult.livePhaseBadge')}</Text>
          </div>
          <Text className="ai-analyzing-tip-content">{t(`quickResult.phase.${currentPhase}`)}</Text>
          <AIPhaseTimeline
            currentPhase={currentPhase}
            phaseHistory={phaseHistory ?? []}
            getLabel={(phase) => t(`quickResult.phase.${phase}`)}
            className="ai-analyzing-phase-timeline"
            itemClassName="ai-analyzing-phase-item"
            activeItemClassName="ai-analyzing-phase-item--active"
            completedItemClassName="ai-analyzing-phase-item--completed"
            pendingItemClassName="ai-analyzing-phase-item--pending"
          />
        </div>
      ) : null}

      {currentTip && (
        <AnimatePresence mode="wait">
          <motion.div
            key={tipIndex}
            className="ai-analyzing-tip-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <div className="ai-analyzing-tip-header">
              <BulbOutlined />
              <Text strong>{t('quickResult.thinkingBadge')}</Text>
            </div>
            <Text className="ai-analyzing-tip-content">
              <AIThinkingIndicator
                text={currentTip.content}
                className="ai-analyzing-thinking"
                dotsClassName="ai-analyzing-thinking-dots"
              />
            </Text>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
