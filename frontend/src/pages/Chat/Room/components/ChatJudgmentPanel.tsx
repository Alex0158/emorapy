/**
 * Judgment preview modal - select messages and request judgment
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getLocale, t } from '@/utils/i18n';
import type { ChatMessage, ChatRoom } from '@/types/chat';

export interface JudgmentPreviewInfo {
  includedMessages: ChatMessage[];
  excludedByVisibility: number;
  excludedByJoinTime: number;
  joinAt: Date | null;
  applyJoinTimeFilter: boolean;
}

interface ChatJudgmentPanelProps {
  open: boolean;
  previewInfo: JudgmentPreviewInfo;
  selectedForJudgment: string[];
  onSelectedChange: (ids: string[]) => void;
  judging: boolean;
  getRoleLabel: (role: string | null | undefined) => string;
  onCancel: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

export function getJudgmentPreviewInfo(room: ChatRoom | null, messages: ChatMessage[]): JudgmentPreviewInfo {
  if (!room) return { includedMessages: [], excludedByVisibility: 0, excludedByJoinTime: 0, joinAt: null, applyJoinTimeFilter: false };
  const participants = Array.isArray((room as unknown as { participants?: unknown }).participants) ? room.participants : [];
  const roleB = participants.find((p) => p.role_in_room === 'roleB' && p.is_active);
  const joinAt = roleB?.joined_at ? new Date(roleB.joined_at) : null;
  const applyJoinTimeFilter = !!joinAt && (room.history_visibility_mode === 'share_from_join_time' || room.history_visibility_mode === 'share_summary_only');
  let excludedByVisibility = 0;
  let excludedByJoinTime = 0;
  const includedMessages: ChatMessage[] = [];
  messages.forEach((m) => {
    if (m.message_type !== 'user_text') return;
    if (m.visibility_scope !== 'all') { excludedByVisibility += 1; return; }
    if (applyJoinTimeFilter && joinAt && new Date(m.created_at) < joinAt) { excludedByJoinTime += 1; return; }
    includedMessages.push(m);
  });
  return { includedMessages, excludedByVisibility, excludedByJoinTime, joinAt, applyJoinTimeFilter };
}

export default function ChatJudgmentPanel({ open, previewInfo, selectedForJudgment, onSelectedChange, judging, getRoleLabel, onCancel, onConfirm }: ChatJudgmentPanelProps) {
  const hasConfirmedRef = useRef(false);
  useEffect(() => { if (!open) hasConfirmedRef.current = false; }, [open]);

  const { includedMessages, excludedByVisibility, joinAt, applyJoinTimeFilter, excludedByJoinTime } = previewInfo;
  const previewList = includedMessages;
  const locale = getLocale();

  const handleConfirm = () => {
    if (hasConfirmedRef.current) return;
    const allowedIds = new Set(previewList.map((m) => m.id));
    const finalSelected = selectedForJudgment.filter((id) => allowedIds.has(id));
    if (finalSelected.length === 0) {
      toast.warning(t('chat.preview.mustSelectOne'));
      if (previewList.length > 0) onSelectedChange(previewList.map((m) => m.id));
      return;
    }
    hasConfirmedRef.current = true;
    onCancel();
    onConfirm(finalSelected);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{t('chat.preview.title')}</DialogTitle></DialogHeader>

        <div className="flex items-start gap-2 rounded-lg bg-primary-light/30 p-3 mb-3">
          <Info className="size-4 mt-0.5 text-primary shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>{t('chat.preview.ruleVisibility')}{excludedByVisibility > 0 ? t('chat.preview.excludedCount', { count: excludedByVisibility }) : ''}</p>
            {joinAt && applyJoinTimeFilter && (
              <p>{t('chat.preview.ruleJoinTime')}{t('chat.preview.joinFilterMeta', { role: t('chat.role.roleB'), time: joinAt.toLocaleString(locale), count: excludedByJoinTime })}</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-60 space-y-1 py-2">
          {previewList.map((m) => (
            <label key={m.id} className="flex items-start gap-2 rounded p-1.5 hover:bg-accent cursor-pointer">
              <input type="checkbox" checked={selectedForJudgment.includes(m.id)} onChange={(e) => onSelectedChange(e.target.checked ? [...selectedForJudgment, m.id] : selectedForJudgment.filter((id) => id !== m.id))} className="mt-1 accent-primary" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-foreground">{new Date(m.created_at).toLocaleString(locale)}</p>
                <p className="text-xs text-muted-foreground truncate">{getRoleLabel(m.sender_participant?.role_in_room)}: {m.content}</p>
              </div>
            </label>
          ))}
          {previewList.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t('chat.preview.none')}</p>}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Button variant="ghost" size="sm" onClick={() => onSelectedChange(previewList.map((m) => m.id))} disabled={previewList.length === 0}>{t('chat.preview.selectAll')}</Button>
            <Button variant="ghost" size="sm" onClick={() => onSelectedChange([])} disabled={previewList.length === 0}>{t('chat.preview.clearAll')}</Button>
            <span className="text-xs text-muted-foreground">{t('chat.preview.selectedCount')} {selectedForJudgment.length}/{previewList.length}</span>
          </div>
          <Button variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={judging}>{judging && <Loader2 className="size-3 animate-spin" />}{t('common.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
