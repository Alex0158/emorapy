import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Empty,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { BellOutlined, ClockCircleOutlined, DeleteOutlined, RightOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { useNotificationStore } from '@/store/notificationStore';
import type { NotificationFeedState, NotificationItem } from '@/services/api/notifications';

const { Title, Paragraph, Text } = Typography;

const stateOptions: Array<{ label: string; value: NotificationFeedState }> = [
  { label: '待處理', value: 'actionable' },
  { label: '未讀', value: 'unread' },
  { label: '全部', value: 'all' },
  { label: '稍後提醒我', value: 'snoozed' },
  { label: '已封存', value: 'archived' },
];

function sectionTitle(notification: NotificationItem, activeState: NotificationFeedState): string {
  if (activeState === 'snoozed' || notification.snoozed_until) {
    return '稍後提醒我';
  }
  if (!notification.actionable || notification.acted_at || notification.dismissed_at) {
    return '已完成與較早通知';
  }
  if (notification.journey_context?.presentation_bucket === 'partner_waiting') {
    return '等對方 / 等時間';
  }
  if (notification.priority === 'now' || notification.render_payload.priority === 'now') {
    return '現在要處理';
  }
  return '等對方 / 等時間';
}

const NotificationsPage = () => {
  const navigate = useNavigate();
  const {
    items,
    unreadCount,
    activeState,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    dismiss,
    snooze,
    act,
    clearError,
  } = useNotificationStore();

  useEffect(() => {
    void fetchNotifications(activeState);
    void fetchUnreadCount();
  }, [activeState, fetchNotifications, fetchUnreadCount]);

  const sections = useMemo(() => {
    return items.reduce<Record<string, NotificationItem[]>>((acc, item) => {
      const key = sectionTitle(item, activeState);
      acc[key] = [...(acc[key] || []), item];
      return acc;
    }, {});
  }, [activeState, items]);

  const handleOpen = async (notification: NotificationItem) => {
    if (notification.unread) {
      await markRead(notification.id);
    }
    const path = notification.journey_context?.entry_path || notification.render_payload.path;
    if (path) {
      navigate(path);
    }
  };

  const handleAct = async (notification: NotificationItem) => {
    const target = await act(notification.id, notification.action_key ?? undefined);
    const path = target?.path || notification.journey_context?.primary_cta.path || notification.render_payload.path;
    if (path) {
      navigate(path);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    await dismiss(notificationId);
    message.success('已封存這則通知');
  };

  const handleSnooze = async (notificationId: string) => {
    await snooze(notificationId, 24);
    message.success('已稍後提醒你這則通知');
  };

  return (
    <ProtectedRoute>
      <SEO title="通知中心" description="查看修復旅程、邀請與重調相關通知" />
      <div className="case-list-page" role="main" aria-label="通知中心">
        <AnimatedWrapper animation="fade" delay={80}>
          <div className="page-header">
            <Title level={2} style={{ marginBottom: 8 }}>
              <Space>
                <BellOutlined />
                <span>通知中心</span>
              </Space>
            </Title>
            <Paragraph type="secondary">
              這裡會把 repair journey 的邀請、等待回應、重新調整與恢復入口集中起來，讓你不用自己回頭找流程。
            </Paragraph>
            <Space wrap>
              <Segmented
                options={stateOptions}
                value={activeState}
                onChange={(value) => void fetchNotifications(value as NotificationFeedState)}
              />
              <Button onClick={() => void fetchNotifications(activeState)}>刷新</Button>
              <Button onClick={() => void markAllRead()} disabled={unreadCount <= 0}>
                全部標為已讀
              </Button>
              <Tag color={unreadCount > 0 ? 'processing' : 'default'}>未讀 {unreadCount}</Tag>
            </Space>
          </div>
        </AnimatedWrapper>

        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={(
              <Button size="small" type="primary" onClick={() => { clearError(); void fetchNotifications(activeState); }}>
                重試
              </Button>
            )}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spin size="large" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <Empty
              description={activeState === 'archived'
                ? '目前沒有已封存的通知'
                : activeState === 'snoozed'
                  ? '目前沒有稍後提醒的通知'
                  : '目前沒有需要你處理的通知'}
            />
          </Card>
        ) : (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            {Object.entries(sections).map(([title, sectionItems]) => (
              <AnimatedWrapper key={title} animation="slide" direction="up" delay={120}>
                <Card title={title}>
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    {sectionItems.map((notification) => (
                      <Card key={notification.id} size="small">
                        <div
                          role="button"
                          tabIndex={0}
                          style={{ width: '100%', cursor: (notification.journey_context?.entry_path || notification.render_payload.path) ? 'pointer' : 'default' }}
                          onClick={() => void handleOpen(notification)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              void handleOpen(notification);
                            }
                          }}
                        >
                          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                            <Space wrap>
                              <Text strong>{notification.render_payload.title}</Text>
                              {notification.unread ? <Tag color="processing">未讀</Tag> : null}
                              {notification.acted_at ? <Tag color="success">已處理</Tag> : null}
                              {notification.dismissed_at ? <Tag>已封存</Tag> : null}
                              {notification.snoozed_until ? <Tag color="gold">稍後提醒</Tag> : null}
                            </Space>
                            <Paragraph style={{ marginBottom: 0 }}>{notification.render_payload.body}</Paragraph>
                            <Space wrap>
                              <Text type="secondary">{new Date(notification.created_at).toLocaleString()}</Text>
                              {notification.render_payload.journey_status ? (
                                <Tag color="blue">{notification.render_payload.journey_status}</Tag>
                              ) : null}
                              {notification.render_payload.partner_state ? (
                                <Tag>{notification.render_payload.partner_state}</Tag>
                              ) : null}
                              {(notification.priority || notification.render_payload.priority) ? (
                                <Tag color={(notification.priority || notification.render_payload.priority) === 'now' ? 'red' : 'default'}>
                                  {(notification.priority || notification.render_payload.priority) === 'now' ? '現在處理' : '可稍後處理'}
                                </Tag>
                              ) : null}
                              {notification.render_payload.path ? (
                                <Text type="secondary">
                                  進入對應頁面 <RightOutlined />
                                </Text>
                              ) : null}
                            </Space>
                          </Space>
                        </div>
                        <Space wrap style={{ marginTop: 12 }}>
                          {notification.actionable && (notification.journey_context?.primary_cta.label || notification.render_payload.cta_label) ? (
                            <Button key="act" type="primary" size="small" onClick={() => void handleAct(notification)}>
                              {notification.journey_context?.primary_cta.label || notification.render_payload.cta_label}
                            </Button>
                          ) : null}
                          {notification.actionable && !notification.snoozed_until ? (
                            <Button key="snooze" size="small" icon={<ClockCircleOutlined />} onClick={() => void handleSnooze(notification.id)}>
                              稍後提醒我
                            </Button>
                          ) : null}
                          {notification.dismissed_at || notification.actionable ? null : (
                            <Button key="dismiss" size="small" icon={<DeleteOutlined />} onClick={() => void handleDismiss(notification.id)}>
                              封存
                            </Button>
                          )}
                        </Space>
                      </Card>
                    ))}
                  </Space>
                </Card>
              </AnimatedWrapper>
            ))}

            {hasMore ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Button loading={isLoadingMore} onClick={() => void fetchNotifications(activeState, { append: true })}>
                  載入更多
                </Button>
              </div>
            ) : null}
          </Space>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default NotificationsPage;
