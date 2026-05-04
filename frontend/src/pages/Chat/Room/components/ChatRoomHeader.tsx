/**
 * Chat room header - title, status, role, room actions
 */

import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { t } from '@/utils/i18n';
import type { ChatRoom, ChatRoomStatus } from '@/types/chat';

const ROOM_STATUS_STYLE: Partial<Record<ChatRoomStatus, string>> = {
  solo_active: 'bg-primary/10 text-primary',
  invite_pending: 'bg-warning/10 text-warning',
  invite_accepted: 'bg-primary/10 text-primary',
  group_active: 'bg-success/10 text-success',
  judgment_requested: 'bg-warning/10 text-warning',
  judgment_completed: 'bg-success/10 text-success',
  judgment_failed: 'bg-destructive/10 text-destructive',
  archived: '',
};

interface ChatRoomHeaderProps {
  roomId: string;
  room: ChatRoom | null;
  myRole: string | null;
  isOwner: boolean;
  hasActiveRoleB: boolean;
  getRoleLabel: (role: string | null | undefined) => string;
  disableCreateInvite: boolean;
  disableRequestJudgment: boolean;
  creatingInvite: boolean;
  judging: boolean;
  leavingRoom: boolean;
  kickingB: boolean;
  canLeaveRoom: boolean;
  canKickB: boolean;
  onCreateInvite: () => void;
  onRequestJudgment: () => void;
  onLeaveRoomAction: () => void;
  onKickB: () => void;
  onNavigateBack: () => void;
}

export default function ChatRoomHeader({
  roomId, room, myRole, isOwner, hasActiveRoleB, getRoleLabel,
  disableCreateInvite, disableRequestJudgment, creatingInvite, judging,
  leavingRoom, kickingB, canLeaveRoom, canKickB,
  onCreateInvite, onRequestJudgment, onLeaveRoomAction, onKickB, onNavigateBack,
}: ChatRoomHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-foreground">{t('chat.roomLabel').replace('{roomId}', room?.id || roomId)}</h4>
        {room?.status && <Badge variant="secondary" className={`text-[10px] ${ROOM_STATUS_STYLE[room.status] || ''}`}>{t(`chat.status.${room.status}`)}</Badge>}
      </div>
      {myRole && <p className="text-xs text-muted-foreground">{t('chat.myRoleLabel')}{getRoleLabel(myRole)}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onNavigateBack}><ArrowLeft className="size-3.5" />{t('chat.leaveRoom')}</Button>
        <Button variant="outline" size="sm" disabled={disableCreateInvite} onClick={onCreateInvite}>{creatingInvite && <Loader2 className="size-3 animate-spin" />}{t('chat.createInvite')}</Button>
        <Button size="sm" disabled={disableRequestJudgment} onClick={onRequestJudgment}>{judging && <Loader2 className="size-3 animate-spin" />}{t('chat.requestJudgment')}</Button>
        {canLeaveRoom && <Button variant="ghost" size="sm" disabled={leavingRoom} onClick={onLeaveRoomAction}>{t('chat.leaveRoomAction')}</Button>}
        {canKickB && <Button variant="destructive" size="sm" disabled={kickingB} onClick={onKickB}>{t('chat.kickB')}</Button>}
      </div>
      {!isOwner ? <p className="text-xs text-muted-foreground">{t('chat.hint.onlyOwnerActions')}</p> : hasActiveRoleB ? <p className="text-xs text-muted-foreground">{t('chat.hint.roleBAlreadyJoined')}</p> : null}
    </div>
  );
}
