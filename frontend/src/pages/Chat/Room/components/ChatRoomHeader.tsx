/**
 * Chat room header - title, status, role, room actions
 */

import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/utils/i18n';
import type { ChatRoom } from '@/types/chat';

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
    <header className="space-y-3 border-b border-border pb-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t('chat.title')}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{t('chat.roomLabel').replace('{roomId}', room?.id || roomId)}</p>
        </div>
        {room?.status && <span className="text-xs text-muted-foreground">{t(`chat.status.${room.status}`)}</span>}
      </div>
      {myRole && <p className="text-xs text-muted-foreground">{t('chat.myRoleLabel')}{getRoleLabel(myRole)}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onNavigateBack}><ArrowLeft className="size-3.5" />{t('chat.leaveRoom')}</Button>
        <Button variant="outline" size="sm" disabled={disableCreateInvite} onClick={onCreateInvite}>{creatingInvite && <Loader2 className="size-3 animate-spin" />}{t('chat.createInvite')}</Button>
        <Button size="sm" disabled={disableRequestJudgment} onClick={onRequestJudgment}>{judging && <Loader2 className="size-3 animate-spin" />}{t('chat.requestJudgment')}</Button>
      </div>
      {!isOwner ? <p className="text-xs text-muted-foreground">{t('chat.hint.onlyOwnerActions')}</p> : hasActiveRoleB ? <p className="text-xs text-muted-foreground">{t('chat.hint.roleBAlreadyJoined')}</p> : null}
      {(canLeaveRoom || canKickB) && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-2">
          {canLeaveRoom && <Button variant="ghost" size="sm" disabled={leavingRoom} onClick={onLeaveRoomAction}>{t('chat.leaveRoomAction')}</Button>}
          {canKickB && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={kickingB} onClick={onKickB}>{t('chat.kickB')}</Button>}
        </div>
      )}
    </header>
  );
}
