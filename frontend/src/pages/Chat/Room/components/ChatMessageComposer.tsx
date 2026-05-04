/**
 * Chat message input and visibility selector
 */

import { X, Info, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/utils/i18n';
import type { ChatMessage } from '@/types/chat';

interface ChatMessageComposerProps {
  visibilityScope: 'all' | 'owner_only' | 'summary_only';
  onVisibilityScopeChange: (value: 'all' | 'owner_only' | 'summary_only') => void;
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  disableSend: boolean;
  sending: boolean;
  onSend: () => void;
}

export default function ChatMessageComposer({
  visibilityScope, onVisibilityScopeChange, messageInput, onMessageInputChange,
  replyTo, onClearReply, disableSend, sending, onSend,
}: ChatMessageComposerProps) {
  return (
    <div className="space-y-2">
      {replyTo && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-light/30 p-2">
          <Info className="size-4 shrink-0 mt-0.5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{t('chat.replyingTo')}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
          </div>
          <button onClick={onClearReply} className="text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
        </div>
      )}

      <div className="mb-2">
        <Select value={visibilityScope} onValueChange={(v: string) => onVisibilityScopeChange(v as 'all' | 'owner_only' | 'summary_only')}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('chat.visibility.all')}</SelectItem>
            <SelectItem value="summary_only">{t('chat.visibility.summary_only')}</SelectItem>
            <SelectItem value="owner_only">{t('chat.visibility.owner_only')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Input
          value={messageInput}
          maxLength={2000}
          onChange={(e) => onMessageInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={t('chat.messagePlaceholder')}
          className="flex-1"
        />
        <Button disabled={disableSend} onClick={onSend} aria-label={t('chat.send')}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
