import { PauseCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatRoomSafetyState } from '@/types/chat';
import { t } from '@/utils/i18n';

interface ChatSharedSafetyPauseNoticeProps {
  loading: boolean;
  onSwitchToPrivate: () => void;
  status: ChatRoomSafetyState | null;
  unavailable: boolean;
}

export default function ChatSharedSafetyPauseNotice({
  loading,
  onSwitchToPrivate,
  status,
  unavailable,
}: ChatSharedSafetyPauseNoticeProps) {
  const titleKey = status === 'paused'
    ? 'chat.safetyPause.title'
    : unavailable
      ? 'chat.safetyPause.unavailableTitle'
      : 'chat.safetyPause.checkingTitle';
  const descriptionKey = status === 'paused'
    ? 'chat.safetyPause.description'
    : unavailable
      ? 'chat.safetyPause.unavailableDescription'
      : 'chat.safetyPause.checkingDescription';
  return (
    <section
      aria-labelledby="chat-shared-safety-pause-title"
      className="mb-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-amber-950 shadow-sm"
      data-testid="chat-shared-safety-pause"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100">
          <PauseCircle className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="chat-shared-safety-pause-title" className="text-sm font-semibold">
            {t(titleKey)}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-amber-950/75">
            {t(descriptionKey)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-amber-300 bg-background/85 text-foreground hover:bg-background"
            disabled={loading}
            onClick={onSwitchToPrivate}
          >
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {t('chat.safetyPause.privateAction')}
          </Button>
        </div>
      </div>
    </section>
  );
}
