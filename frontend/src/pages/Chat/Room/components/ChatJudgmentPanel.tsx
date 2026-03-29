/**
 * Judgment preview modal - select messages and request judgment
 */

import { useEffect, useRef } from 'react';
import { Alert, Button, Modal, Space, Typography, message } from 'antd';
import { t } from '@/utils/i18n';
import type { ChatMessage, ChatRoom } from '@/types/chat';

const { Text, Paragraph } = Typography;

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
  if (!room) {
    return {
      includedMessages: [],
      excludedByVisibility: 0,
      excludedByJoinTime: 0,
      joinAt: null,
      applyJoinTimeFilter: false,
    };
  }

  const participants = Array.isArray((room as unknown as { participants?: unknown }).participants)
    ? room.participants
    : [];
  const roleB = participants.find((p) => p.role_in_room === 'roleB' && p.is_active);
  const joinAt = roleB?.joined_at ? new Date(roleB.joined_at) : null;
  const applyJoinTimeFilter =
    !!joinAt &&
    (room.history_visibility_mode === 'share_from_join_time' ||
      room.history_visibility_mode === 'share_summary_only');

  let excludedByVisibility = 0;
  let excludedByJoinTime = 0;
  const includedMessages: ChatMessage[] = [];

  messages.forEach((m) => {
    if (m.visibility_scope !== 'all') {
      excludedByVisibility += 1;
      return;
    }
    if (applyJoinTimeFilter && joinAt && new Date(m.created_at) < joinAt) {
      excludedByJoinTime += 1;
      return;
    }
    includedMessages.push(m);
  });

  return { includedMessages, excludedByVisibility, excludedByJoinTime, joinAt, applyJoinTimeFilter };
}

export default function ChatJudgmentPanel({
  open,
  previewInfo,
  selectedForJudgment,
  onSelectedChange,
  judging,
  getRoleLabel,
  onCancel,
  onConfirm,
}: ChatJudgmentPanelProps) {
  const hasConfirmedRef = useRef(false);
  useEffect(() => {
    if (!open) hasConfirmedRef.current = false;
  }, [open]);

  const { includedMessages, excludedByVisibility, joinAt, applyJoinTimeFilter, excludedByJoinTime } = previewInfo;
  const previewList = includedMessages;
  const previewMessage =
    previewList.length === 0
      ? t('chat.preview.none')
      : previewList
          .map(
            (m) =>
              `${new Date(m.created_at).toLocaleString()} | ${getRoleLabel(m.sender_participant?.role_in_room)}: ${m.content}`
          )
          .join('\n');

  const handleConfirm = () => {
    if (hasConfirmedRef.current) return;
    const allowedIds = new Set(previewList.map((m) => m.id));
    const finalSelected = selectedForJudgment.filter((id) => allowedIds.has(id));
    if (finalSelected.length === 0) {
      message.warning(t('chat.preview.mustSelectOne'));
      if (previewList.length > 0) {
        onSelectedChange(previewList.map((m) => m.id));
      }
      return;
    }
    hasConfirmedRef.current = true;
    onCancel();
    onConfirm(finalSelected);
  };

  return (
    <Modal
      open={open}
      title={t('chat.preview.title')}
      onCancel={onCancel}
      footer={[
        <Space key="footer" wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button
            key="selectAll"
            size="small"
            onClick={() => onSelectedChange(previewList.map((m) => m.id))}
            disabled={previewList.length === 0}
          >
            {t('chat.preview.selectAll')}
          </Button>
          <Button
            key="clearAll"
            size="small"
            onClick={() => onSelectedChange([])}
            disabled={previewList.length === 0}
          >
            {t('chat.preview.clearAll')}
          </Button>
          <Text key="count" type="secondary">
            {t('chat.preview.selectedCount')} {selectedForJudgment.length}/{previewList.length}
          </Text>
          <Button key="cancel" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button key="ok" type="primary" loading={judging} onClick={handleConfirm}>
            {t('common.confirm')}
          </Button>
        </Space>,
      ]}
    >
      <Alert
        type="info"
        showIcon
        title={t('chat.preview.ruleTitle')}
        description={
          <>
            <div>
              {t('chat.preview.ruleVisibility')}
              {excludedByVisibility > 0 ? t('chat.preview.excludedCount', { count: excludedByVisibility }) : ''}
            </div>
            {joinAt && applyJoinTimeFilter ? (
              <div>
                {t('chat.preview.ruleJoinTime')}
                {t('chat.preview.joinFilterMeta', {
                  role: t('chat.role.roleB'),
                  time: joinAt.toLocaleString(),
                  count: excludedByJoinTime,
                })}
              </div>
            ) : null}
          </>
        }
      />
      <div style={{ maxHeight: 240, overflowY: 'auto', padding: '8px 0' }}>
        {previewList.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' }}>
            <input
              type="checkbox"
              checked={selectedForJudgment.includes(m.id)}
              onChange={(e) => {
                onSelectedChange(
                  e.target.checked
                    ? (selectedForJudgment.includes(m.id) ? selectedForJudgment : [...selectedForJudgment, m.id])
                    : selectedForJudgment.filter((id) => id !== m.id)
                );
              }}
            />
            <div>
              <Text strong>{new Date(m.created_at).toLocaleString()}</Text>
              <Paragraph style={{ margin: 0 }}>
                {getRoleLabel(m.sender_participant?.role_in_room)}: {m.content}
              </Paragraph>
            </div>
          </div>
        ))}
        {previewList.length === 0 ? <Paragraph>{previewMessage}</Paragraph> : null}
      </div>
    </Modal>
  );
}
