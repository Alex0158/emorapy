import { LockKeyhole, SlidersHorizontal } from 'lucide-react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import type { PrivateContextUseMode } from '@/types/chat';
import type {
  RoomAdaptationStatus,
  SharedAdaptationConsentDecision,
} from '@/types/chat';
import { t } from '@/utils/i18n';
import type { ChatConversationLane } from '../hooks/useChatRoomUiState';

interface ChatContextBoundaryPanelProps {
  activeLane: ChatConversationLane;
  mode: PrivateContextUseMode;
  loading: boolean;
  saving: boolean;
  onModeChange: (mode: PrivateContextUseMode) => void;
  adaptationDecision: SharedAdaptationConsentDecision;
  roomAdaptation: RoomAdaptationStatus | null;
  unavailable: boolean;
  onRetry: () => void;
  onAdaptationDecisionChange: (
    decision: Exclude<SharedAdaptationConsentDecision, 'not_set'>,
  ) => void;
}

const preferenceOptions = [
  {
    value: 'private_only',
    titleKey: 'chat.contextPreference.privateOnly',
    descriptionKey: 'chat.contextPreference.privateOnlyDescription',
  },
  {
    value: 'shared_process_controls',
    titleKey: 'chat.contextPreference.processControls',
    descriptionKey: 'chat.contextPreference.processControlsDescription',
  },
] as const;

export default function ChatContextBoundaryPanel({
  activeLane,
  mode,
  loading,
  saving,
  onModeChange,
  adaptationDecision,
  roomAdaptation,
  unavailable,
  onRetry,
  onAdaptationDecisionChange,
}: ChatContextBoundaryPanelProps) {
  if (activeLane === 'shared') {
    return (
      <aside className="flex gap-3 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm">
        <SlidersHorizontal className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{t('chat.contextPreference.sharedBoundaryTitle')}</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            {t('chat.contextPreference.sharedBoundaryDescription')}
          </p>
          {roomAdaptation && roomAdaptation.active_participant_count >= 2 ? (
            <>
              <p className="mt-3 text-xs font-semibold text-foreground">
                {roomAdaptation.enabled
                  ? t('chat.contextPreference.adaptationActive')
                  : t('chat.contextPreference.universalBaseline')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('chat.contextPreference.adaptationProgress', {
                  accepted: roomAdaptation.accepted_participant_count,
                  total: roomAdaptation.active_participant_count,
                })}
              </p>
              <RadioGroupPrimitive.Root
                className="mt-3 grid gap-2 sm:grid-cols-2"
                value={adaptationDecision === 'not_set' ? undefined : adaptationDecision}
                onValueChange={(value: string) => onAdaptationDecisionChange(
                  value as Exclude<SharedAdaptationConsentDecision, 'not_set'>,
                )}
                disabled={loading || saving}
                aria-label={t('chat.contextPreference.adaptationConsentTitle')}
              >
                {(['accepted', 'declined'] as const).map((decision) => (
                  <RadioGroupPrimitive.Item
                    key={decision}
                    value={decision}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:cursor-wait disabled:opacity-60 ${
                      adaptationDecision === decision
                        ? 'border-primary/40 bg-background text-foreground'
                        : 'border-border/60 bg-transparent text-muted-foreground hover:bg-background/70'
                    }`}
                  >
                    <span className="font-semibold">
                      {t(decision === 'accepted'
                        ? 'chat.contextPreference.acceptAdaptation'
                        : 'chat.contextPreference.declineAdaptation')}
                    </span>
                  </RadioGroupPrimitive.Item>
                ))}
              </RadioGroupPrimitive.Root>
            </>
          ) : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
      <div className="flex gap-3">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {t('chat.contextPreference.title')}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('chat.contextPreference.description')}
          </p>
          {unavailable ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
              <p className="text-xs text-destructive" role="alert">
                {t('chat.contextPreference.loadError')}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={loading}>
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <RadioGroupPrimitive.Root
              className="mt-3 grid gap-2"
              value={mode}
              onValueChange={(value: string) => onModeChange(value as PrivateContextUseMode)}
              disabled={loading || saving}
              aria-label={t('chat.contextPreference.title')}
            >
              {preferenceOptions.map((option) => {
                const selected = option.value === mode;
                return (
                  <RadioGroupPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
                      selected
                        ? 'border-primary/40 bg-background text-foreground'
                        : 'border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-background/70'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{t(option.titleKey)}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed">{t(option.descriptionKey)}</span>
                  </RadioGroupPrimitive.Item>
                );
              })}
            </RadioGroupPrimitive.Root>
          )}
        </div>
      </div>
    </aside>
  );
}
