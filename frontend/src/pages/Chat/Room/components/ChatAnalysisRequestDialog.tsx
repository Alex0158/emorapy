import { FileCheck2, Loader2, LockKeyhole, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ChatMessage, ContextCapsuleListItem } from '@/types/chat';
import { getLocale, t } from '@/utils/i18n';

interface ChatAnalysisRequestDialogProps {
  open: boolean;
  messages: ChatMessage[];
  capsules: ContextCapsuleListItem[];
  selectedMessageIds: string[];
  selectedCapsuleIds: string[];
  creating: boolean;
  getRoleLabel: (role: string | null | undefined) => string;
  onSelectedMessageIdsChange: (ids: string[]) => void;
  onSelectedCapsuleIdsChange: (ids: string[]) => void;
  onClose: () => void;
  onCreate: () => void;
}

function toggleId(current: string[], id: string, checked: boolean): string[] {
  return checked
    ? [...new Set([...current, id])]
    : current.filter((currentId) => currentId !== id);
}

export default function ChatAnalysisRequestDialog({
  open,
  messages,
  capsules,
  selectedMessageIds,
  selectedCapsuleIds,
  creating,
  getRoleLabel,
  onSelectedMessageIdsChange,
  onSelectedCapsuleIdsChange,
  onClose,
  onCreate,
}: ChatAnalysisRequestDialogProps) {
  const selectedCount = selectedMessageIds.length + selectedCapsuleIds.length;
  const locale = getLocale();

  return (
    <Dialog open={open} onOpenChange={(nextOpen: boolean) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-h-[88vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-border/70 bg-[linear-gradient(135deg,oklch(0.98_0.015_35),oklch(0.99_0.006_75))] px-6 py-5">
          <DialogHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileCheck2 className="size-4" aria-hidden="true" />
            </div>
            <DialogTitle>{t('chat.analysis.createTitle')}</DialogTitle>
            <DialogDescription className="max-w-xl leading-relaxed">
              {t('chat.analysis.createDescription')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-1">
          <section aria-labelledby="analysis-shared-message-heading" className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 id="analysis-shared-message-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquareText className="size-4 text-primary" aria-hidden="true" />
                  {t('chat.analysis.sharedMessagesTitle')}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t('chat.analysis.sharedMessagesDescription')}
                </p>
              </div>
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectedMessageIdsChange(
                    selectedMessageIds.length === messages.length ? [] : messages.map((message) => message.id),
                  )}
                >
                  {selectedMessageIds.length === messages.length
                    ? t('chat.analysis.clearMessages')
                    : t('chat.analysis.selectAllMessages')}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {messages.map((message) => (
                <label
                  key={message.id}
                  className="group flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-card px-3 py-3 transition-colors hover:border-primary/35 hover:bg-primary/[0.025]"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={selectedMessageIds.includes(message.id)}
                    onChange={(event) => onSelectedMessageIdsChange(toggleId(
                      selectedMessageIds,
                      message.id,
                      event.target.checked,
                    ))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-muted-foreground">
                      <span>{getRoleLabel(message.sender_participant?.role_in_room)}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(locale)}</time>
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {message.content}
                    </span>
                  </span>
                </label>
              ))}
              {messages.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                  {t('chat.analysis.noSharedMessages')}
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="analysis-capsule-heading" className="space-y-2 pb-4">
            <div>
              <h3 id="analysis-capsule-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
                {t('chat.analysis.capsulesTitle')}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('chat.analysis.capsulesDescription')}
              </p>
            </div>
            <div className="space-y-2">
              {capsules.map((capsule) => (
                <label
                  key={capsule.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-3 hover:border-primary/35"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={selectedCapsuleIds.includes(capsule.id)}
                    onChange={(event) => onSelectedCapsuleIdsChange(toggleId(
                      selectedCapsuleIds,
                      capsule.id,
                      event.target.checked,
                    ))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/80">
                      {t('chat.analysis.approvedPrivateSummary')}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {capsule.summary}
                    </span>
                  </span>
                </label>
              ))}
              {capsules.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-4 py-4 text-xs leading-relaxed text-muted-foreground">
                  {t('chat.analysis.noEligibleCapsules')}
                </p>
              )}
            </div>
          </section>
        </div>

        <DialogFooter className="border-t border-border/70 bg-muted/25 px-6 py-4 sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t('chat.analysis.selectedSourceCount', { count: selectedCount })}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={onClose} disabled={creating}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onCreate} disabled={creating || selectedCount === 0}>
              {creating && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t('chat.analysis.createAndApprove')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
