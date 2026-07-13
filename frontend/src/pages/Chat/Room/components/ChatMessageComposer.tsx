/**
 * Chat message input with a server-owned audience derived from the active lane.
 */

import { X, Info, Loader2, Send, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { t } from '@/utils/i18n';
import type { ChatMessage } from '@/types/chat';
import type { ChatConversationLane } from '../hooks/useChatRoomUiState';

interface ChatMessageComposerProps {
  lane: ChatConversationLane;
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  disableSend: boolean;
  sending: boolean;
  onSend: () => void;
}

export default function ChatMessageComposer({
  lane, messageInput, onMessageInputChange,
  replyTo, onClearReply, disableSend, sending, onSend,
}: ChatMessageComposerProps) {
  const isPrivate = lane === 'private';
  const AudienceIcon = isPrivate ? ShieldCheck : Users;
  const audienceKey = isPrivate ? 'chat.lane.privateAudience' : 'chat.lane.sharedAudience';
  const placeholderKey = isPrivate ? 'chat.lane.privatePlaceholder' : 'chat.lane.sharedPlaceholder';

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      {replyTo && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-light/30 p-2">
          <Info className="size-4 shrink-0 mt-0.5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{t('chat.replyingTo')}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
          </div>
          <button type="button" onClick={onClearReply} aria-label={t('chat.dismiss')} className="text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          aria-label={t(placeholderKey)}
          aria-describedby="chat-composer-audience"
          autoComplete="off"
          value={messageInput}
          maxLength={2000}
          disabled={disableSend}
          onChange={(e) => onMessageInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={t('chat.messagePlaceholder')}
          className="flex-1"
        />
        <Button disabled={disableSend} onClick={onSend} aria-label={t('chat.send')}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
      <div id="chat-composer-audience" className="flex items-center gap-2 text-xs leading-relaxed text-muted-foreground">
        <AudienceIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{t(audienceKey)}</span>
      </div>
    </div>
  );
}
