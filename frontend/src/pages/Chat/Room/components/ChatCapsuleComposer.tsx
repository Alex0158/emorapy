import { useMemo, useState } from 'react';
import { FileHeart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ChatMessage } from '@/types/chat';
import {
  createChatContextCapsule,
} from '@/services/api/chat';
import { t } from '@/utils/i18n';

interface ChatCapsuleComposerProps {
  roomId: string;
  privateChannelId: string;
  messages: ChatMessage[];
  onSaved?: () => void;
}

export default function ChatCapsuleComposer({
  roomId,
  privateChannelId,
  messages,
  onSaved,
}: ChatCapsuleComposerProps) {
  const eligibleMessages = useMemo(() => messages.filter((message) => (
    message.channel_id === privateChannelId
    && !message.safety_flag
    && ['user_text', 'ai_reflection', 'ai_mediation', 'ai_summary'].includes(message.message_type)
  )), [messages, privateChannelId]);
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);

  const openComposer = () => {
    const suggestedSources = eligibleMessages.slice(-2);
    const suggestedSummary = [...suggestedSources]
      .reverse()
      .find(message => message.message_type !== 'user_text')?.content
      ?? suggestedSources.at(-1)?.content
      ?? '';
    setSelectedIds(suggestedSources.map(message => message.id));
    setSummary(suggestedSummary.slice(0, 1000));
    setOpen(true);
  };

  const save = async () => {
    const normalizedSummary = summary.trim();
    if (!normalizedSummary || selectedIds.length === 0 || saving) return;
    setSaving(true);
    try {
      await createChatContextCapsule(roomId, {
        source_channel_id: privateChannelId,
        source_message_ids: selectedIds,
        summary: normalizedSummary,
      });
      toast.success(t('chat.capsule.draftSaved'));
      setOpen(false);
      onSaved?.();
    } catch {
      toast.error(t('chat.capsule.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (eligibleMessages.length === 0) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-t border-border/60 px-1 pt-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('chat.capsule.helper')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={openComposer}>
          <FileHeart className="size-4" aria-hidden="true" />
          {t('chat.capsule.open')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(nextOpen: boolean) => { if (!saving) setOpen(nextOpen); }}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('chat.capsule.title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('chat.capsule.description')}
          </p>
          <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border/70 p-2">
            {eligibleMessages.map((message) => (
              <label key={message.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted/60">
                <input
                  type="checkbox"
                  className="mt-1 accent-primary"
                  checked={selectedIds.includes(message.id)}
                  onChange={(event) => setSelectedIds((current) => (
                    event.target.checked
                      ? [...current, message.id]
                      : current.filter(id => id !== message.id)
                  ))}
                />
                <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {message.content}
                </span>
              </label>
            ))}
          </div>
          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>{t('chat.capsule.summaryLabel')}</span>
            <textarea
              value={summary}
              maxLength={2000}
              autoComplete="off"
              onChange={(event) => setSummary(event.target.value)}
              className="min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => { void save(); }}
              disabled={saving || selectedIds.length === 0 || summary.trim().length === 0}
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t('chat.capsule.saveDraft')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
