import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import AIPhaseTimeline from '@/components/common/AIPhaseTimeline';
import AIThinkingIndicator from '@/components/common/AIThinkingIndicator';
import type { ContentItem } from '@/services/api/content';
import type { AIStreamPhase } from '@/types/aiStream';
import { t } from '@/utils/i18n';

interface AIAnalyzingAnimationProps {
  tips?: ContentItem[];
  currentPhase?: AIStreamPhase | null;
  phaseHistory?: AIStreamPhase[];
}

export default function AIAnalyzingAnimation({ tips, currentPhase, phaseHistory }: AIAnalyzingAnimationProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const safeTips = useMemo(() => (Array.isArray(tips) ? tips : []), [tips]);

  useEffect(() => {
    if (safeTips.length === 0) return;
    const timer = window.setInterval(() => { setTipIndex((prev) => (prev + 1) % safeTips.length); }, 8000);
    return () => window.clearInterval(timer);
  }, [safeTips]);

  const currentTip = safeTips.length > 0 ? safeTips[tipIndex] : null;

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      <motion.div
        className="h-16 w-16 rounded-full bg-gradient-conic from-primary via-secondary to-primary"
        animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
      <motion.h2
        className="text-xl font-bold text-foreground font-heading"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {t('quickResult.analyzingTitle')}
      </motion.h2>
      <p className="text-sm text-muted-foreground">{t('quickResult.analyzingSubtitle')}</p>

      {currentPhase && (
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('quickResult.livePhaseBadge')}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t(`quickResult.phase.${currentPhase}`)}</p>
          <AIPhaseTimeline
            currentPhase={currentPhase}
            phaseHistory={phaseHistory ?? []}
            getLabel={(phase) => t(`quickResult.phase.${phase}`)}
            className=""
            itemClassName=""
            activeItemClassName="text-primary font-semibold"
            completedItemClassName="text-success"
            pendingItemClassName="text-muted-foreground"
          />
        </div>
      )}

      {currentTip && (
        <AnimatePresence mode="wait">
          <motion.div
            key={tipIndex}
            className="w-full max-w-md rounded-xl border border-border bg-card p-4 space-y-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{t('quickResult.thinkingBadge')}</span>
            </div>
            <AIThinkingIndicator text={currentTip.content} className="" dotsClassName="animate-pulse" />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
