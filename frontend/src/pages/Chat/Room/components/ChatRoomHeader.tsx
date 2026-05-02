/**
 * Chat room header - title, status, role, room actions
 */

import { Button, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';
import type { ChatRoom, ChatRoomStatus } from '@/types/chat';

const { Title, Text } = Typography;

const ROOM_STATUS_COLOR: Partial<Record<ChatRoomStatus, string>> = {
  solo_active: 'blue',
  invite_pending: 'gold',
  invite_accepted: 'cyan',
  group_active: 'green',
  judgment_requested: 'orange',
  judgment_completed: 'success',
  judgment_failed: 'error',
  archived: 'default',
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
  roomId,
  room,
  myRole,
  isOwner,
  hasActiveRoleB,
  getRoleLabel,
  disableCreateInvite,
  disableRequestJudgment,
  creatingInvite,
  judging,
  leavingRoom,
  kickingB,
  canLeaveRoom,
  canKickB,
  onCreateInvite,
  onRequestJudgment,
  onLeaveRoomAction,
  onKickB,
  onNavigateBack,
}: ChatRoomHeaderProps) {
  const statusTag = room?.status ? (
    <Tag color={ROOM_STATUS_COLOR[room.status] || 'default'}>
      {t(`chat.status.${room.status}`)}
    </Tag>
  ) : null;

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('chat.roomLabel').replace('{roomId}', room?.id || roomId)}
        </Title>
        {statusTag}
      </Space>
      {myRole ? (
        <Text type="secondary">
          {t('chat.myRoleLabel')}
          {getRoleLabel(myRole)}
        </Text>
      ) : null}
      <Space wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={onNavigateBack}>
          {t('chat.leaveRoom')}
        </Button>
        <Button disabled={disableCreateInvite} loading={creatingInvite} onClick={onCreateInvite}>
          {t('chat.createInvite')}
        </Button>
        <Button type="primary" disabled={disableRequestJudgment} loading={judging} onClick={onRequestJudgment}>
          {t('chat.requestJudgment')}
        </Button>
        {canLeaveRoom ? (
          <Button loading={leavingRoom} onClick={onLeaveRoomAction}>
            {t('chat.leaveRoomAction')}
          </Button>
        ) : null}
        {canKickB ? (
          <Button danger loading={kickingB} onClick={onKickB}>
            {t('chat.kickB')}
          </Button>
        ) : null}
      </Space>
      {!isOwner ? (
        <Text type="secondary">{t('chat.hint.onlyOwnerActions')}</Text>
      ) : hasActiveRoleB ? (
        <Text type="secondary">{t('chat.hint.roleBAlreadyJoined')}</Text>
      ) : null}
    </Space>
  );
}
