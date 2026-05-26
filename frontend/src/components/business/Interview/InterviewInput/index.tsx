/**
 * 訪談輸入組件
 *
 * 遷移: Ant Input.TextArea/Button/Space/Tag/Icons → 原生 textarea + shadcn Button + Lucide + Tailwind
 * 保留: 快捷標籤、字數限制、Enter 發送、Stop/Skip 控制
 */

import React, { useState, useRef } from 'react';
import { Send, Square, SkipForward, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t } from '@/utils/i18n';

const MAX_CHARS = 2000;

const QUICK_TAGS = [
  { labelKey: 'interview.quickTag.needCalmDown', icon: <Coffee className="size-3.5" /> },
  { labelKey: 'interview.quickTag.imAngry', icon: '😠' },
  { labelKey: 'interview.quickTag.notReadyToTalk', icon: '🛑' },
  { labelKey: 'interview.quickTag.iAgree', icon: '👍' },
];

interface InterviewInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  onSkip?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

const InterviewInput: React.FC<InterviewInputProps> = ({
  onSend,
  onStop,
  onSkip,
  disabled,
  isStreaming,
  placeholder,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const charCount = value.length;
  const isOverLimit = charCount > MAX_CHARS;

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming || isOverLimit) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  };

  const handleQuickTag = (tagLabel: string) => {
    if (disabled || isStreaming) return;
    onSend(tagLabel);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-3">
      {/* Quick Tags */}
      {!isStreaming && !disabled && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {QUICK_TAGS.map((tag, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickTag(t(tag.labelKey))}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10"
            >
              <span className="text-xs">{tag.icon}</span>
              <span>{t(tag.labelKey)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card/80 p-2 shadow-sm backdrop-blur-sm transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            aria-label={placeholder ?? t('interview.sendPlaceholder')}
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? t('interview.sendPlaceholder')}
            disabled={disabled || isStreaming}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50',
              'max-h-[120px] min-h-[36px]',
              isOverLimit && 'text-destructive',
            )}
            style={{ height: 'auto', overflowY: value.split('\n').length > 4 ? 'auto' : 'hidden' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          {charCount > MAX_CHARS * 0.8 && (
            <span className={cn(
              'absolute bottom-1 right-2 text-[10px]',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground',
            )}>
              {charCount}/{MAX_CHARS}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {isStreaming && onStop ? (
            <Button
              size="icon"
              variant="destructive"
              onClick={onStop}
              aria-label={t('interview.stop')}
              className="size-9 rounded-full"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!value.trim() || disabled || isOverLimit}
              aria-label={t('interview.send')}
              className="size-9 rounded-full"
            >
              <Send className="size-4" />
            </Button>
          )}
          {onSkip && !isStreaming && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onSkip}
              disabled={disabled}
              aria-label={t('interview.skip')}
              className="size-9 rounded-full text-muted-foreground"
            >
              <SkipForward className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewInput;
