import type { AIStreamPhase } from '@/types/aiStream';

interface AIPhaseTimelineProps {
  currentPhase?: AIStreamPhase | null;
  phaseHistory?: AIStreamPhase[];
  getLabel: (phase: AIStreamPhase) => string;
  className?: string;
  itemClassName?: string;
  activeItemClassName?: string;
  completedItemClassName?: string;
  pendingItemClassName?: string;
}

export default function AIPhaseTimeline({
  currentPhase,
  phaseHistory = [],
  getLabel,
  className,
  itemClassName,
  activeItemClassName,
  completedItemClassName,
  pendingItemClassName,
}: AIPhaseTimelineProps) {
  const phases = Array.from(new Set(phaseHistory.filter(Boolean)));
  if (currentPhase && !phases.includes(currentPhase)) {
    phases.push(currentPhase);
  }
  if (phases.length === 0) return null;

  return (
    <div className={className} data-ai-phase-timeline="true">
      {phases.map((phase) => {
        const isActive = phase === currentPhase;
        const isCompleted = !isActive && phaseHistory.includes(phase);
        const stateClassName = isActive
          ? activeItemClassName
          : isCompleted
            ? completedItemClassName
            : pendingItemClassName;
        return (
          <span
            key={phase}
            className={[itemClassName, stateClassName].filter(Boolean).join(' ')}
            data-ai-phase={phase}
            data-ai-phase-state={isActive ? 'active' : isCompleted ? 'completed' : 'pending'}
          >
            {getLabel(phase)}
          </span>
        );
      })}
    </div>
  );
}
