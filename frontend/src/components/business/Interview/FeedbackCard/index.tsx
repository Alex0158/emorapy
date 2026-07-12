/**
 * 訪談反饋卡片（遷移：Ant Card/Typography/Tag/Space/Button/Icons → shadcn + Tailwind + Lucide）
 */

import React from 'react';
import { ChevronRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FeedbackCard as FeedbackCardType, PsychDomain } from '@/types/interview';
import { getDomainLabel } from '@/types/interview';
import { t } from '@/utils/i18n';

interface FeedbackCardProps {
  feedback: FeedbackCardType;
  onViewProfile?: () => void;
  onBackToCase?: () => void;
  onBackToJudgment?: () => void;
  onGoHome?: () => void;
  trigger?: string;
}

const FeedbackCardComponent: React.FC<FeedbackCardProps> = ({
  feedback,
  onViewProfile,
  onBackToCase,
  onBackToJudgment,
  onGoHome,
  trigger,
}) => {
  const getPrimaryAction = () => {
    switch (trigger) {
      case 'post_judgment': return { text: t('feedback.backToJudgment'), onClick: onBackToJudgment ?? onGoHome };
      case 'pre_case': return { text: t('feedback.continueSubmit'), onClick: onBackToCase ?? onGoHome };
      default: return { text: t('feedback.backToHome'), onClick: onGoHome };
    }
  };

  const primaryAction = getPrimaryAction();

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h4 className="text-lg font-semibold text-foreground">{t('interview.result.doneTitle')}</h4>
        <p className="text-xs text-muted-foreground">{t('psychProfile.disclaimer')}</p>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground leading-relaxed">{feedback.summary}</p>

      {/* Explored Domains */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">{t('psychProfile.exploredDomains')}：</p>
        <div className="flex flex-wrap gap-1.5">
          {(feedback.domains_explored ?? []).map((d) => (
            <Badge key={d} variant="secondary" className="text-xs">{getDomainLabel(d as PsychDomain)}</Badge>
          ))}
        </div>
      </div>

      {/* Key Insights */}
      {(feedback.key_insights ?? []).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('psychProfile.keyInsights')}：</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
            {(feedback.key_insights ?? []).map((insight, i) => <li key={i}>{insight}</li>)}
          </ul>
        </div>
      )}

      {/* Encouragement */}
      <p className="text-sm italic text-muted-foreground">{feedback.encouragement}</p>

      {feedback.continuation_hint && (
        <p className="text-sm text-foreground">{feedback.continuation_hint}</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        {primaryAction.onClick && (
          <Button onClick={primaryAction.onClick}>
            {primaryAction.text}<ChevronRight className="size-4" />
          </Button>
        )}
        {onViewProfile && (
          <Button variant="ghost" onClick={onViewProfile}>
            <BookOpen className="size-4" />{t('feedback.viewMyStory')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default FeedbackCardComponent;
