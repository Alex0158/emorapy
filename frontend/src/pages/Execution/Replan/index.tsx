import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Radio,
  Space,
  Spin,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import AIErrorState from '@/components/common/AIErrorState';
import AIPhaseTimeline from '@/components/common/AIPhaseTimeline';
import AIRecoveryBadge from '@/components/common/AIRecoveryBadge';
import { getExecutionStatus, replanTrack, type ExecutionStatus } from '@/services/api/execution';
import type { AIStreamReadyEvent } from '@/services/aiStream';
import { getErrorMessage } from '@/utils/apiError';
import { useAIStreamSubscription } from '@/hooks/useAIStreamSubscription';
import type { AIStreamEvent, AIStreamPhase, AIStreamSnapshot } from '@/types/aiStream';

const { Title, Paragraph, Text } = Typography;

const reasonLabelMap = {
  needs_help: '我需要更低壓一點的版本',
  farther: '最近互動後反而變得更遠',
  high_stress: '這一步帶來太高壓力',
  manual: '我想主動重新調整',
} as const;

const modeLabelMap = {
  lower_pressure: '先降壓',
  slower_pace: '先放慢節奏',
  solo_first: '先由我自己開始',
} as const;

const phaseLabelMap: Record<string, string> = {
  collecting_context: '整理這一輪的上下文',
  analyzing_recent_pulse: '理解最近的距離感與壓力',
  drafting_adjustment: '正在重寫更貼近現在狀態的版本',
  finalizing_plan: '整理成新的下一步',
  persisted: '新版本已準備好',
};

interface ReplanStreamState {
  latestSnapshot: AIStreamSnapshot | null;
  phaseHistory: AIStreamPhase[];
  latestEvent: AIStreamEvent | null;
}

const initialStreamState: ReplanStreamState = {
  latestSnapshot: null,
  phaseHistory: [],
  latestEvent: null,
};

function pickReplanSnapshotFromReady(ready: AIStreamReadyEvent): AIStreamSnapshot | null {
  const snapshots = Array.isArray(ready.snapshots) ? ready.snapshots : [];
  const relevant = snapshots.filter((snapshot: AIStreamSnapshot) => snapshot.metadata?.task_type === 'repair_replan');
  return [...relevant].sort((a, b) => b.lastSeq - a.lastSeq)[0] ?? null;
}

function reduceReady(prev: ReplanStreamState, ready: AIStreamReadyEvent): ReplanStreamState {
  const snapshot = pickReplanSnapshotFromReady(ready);
  if (!snapshot) return prev;
  return {
    latestSnapshot: snapshot,
    latestEvent: prev.latestEvent,
    phaseHistory: snapshot.phase
      ? Array.from(new Set([...prev.phaseHistory, snapshot.phase]))
      : prev.phaseHistory,
  };
}

function reduceEvent(prev: ReplanStreamState, event: AIStreamEvent): ReplanStreamState {
  if (event.metadata?.task_type !== 'repair_replan') {
    return prev;
  }

  const phase = event.phase ?? prev.latestSnapshot?.phase ?? null;
  const latestSnapshot = {
    streamId: event.streamId,
    requestId: event.requestId,
    scopeType: event.scopeType,
    scopeId: event.scopeId,
    status:
      event.eventType === 'stream.persisted' ? 'persisted'
        : event.eventType === 'stream.failed' ? 'failed'
          : event.eventType === 'stream.cancelled' ? 'cancelled'
            : event.eventType === 'stream.completed' ? 'completed'
              : event.eventType === 'stream.delta' ? 'streaming'
                : prev.latestSnapshot?.status ?? 'started',
    lastSeq: event.seq,
    text: event.fullText ?? prev.latestSnapshot?.text ?? '',
    phase: phase ?? undefined,
    messageId: event.messageId ?? prev.latestSnapshot?.messageId,
    metadata: event.metadata ?? prev.latestSnapshot?.metadata,
    error: event.error ?? prev.latestSnapshot?.error,
    updatedAt: event.createdAt,
  } satisfies AIStreamSnapshot;

  return {
    latestSnapshot,
    latestEvent: event,
    phaseHistory: phase ? Array.from(new Set([...prev.phaseHistory, phase])) : prev.phaseHistory,
  };
}

const ExecutionReplan = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [waitingForAI, setWaitingForAI] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<{
    reason: keyof typeof reasonLabelMap;
    mode: keyof typeof modeLabelMap;
  }>({
    reason: 'manual',
    mode: 'lower_pressure',
  });

  useEffect(() => {
    if (!planId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await getExecutionStatus(planId);
        setExecution(data);
        const nextReason: keyof typeof reasonLabelMap =
          data.status_reason && data.status_reason in reasonLabelMap
            ? data.status_reason as keyof typeof reasonLabelMap
            : 'manual';
        const nextMode: keyof typeof modeLabelMap =
          data.replan_recommendation && data.replan_recommendation in modeLabelMap
            ? data.replan_recommendation as keyof typeof modeLabelMap
            : 'lower_pressure';
        setFormValues({
          reason: nextReason,
          mode: nextMode,
        });
        setWaitingForAI(data.journey_status === 'replanning' || Boolean(data.active_replan_stream_id));
      } catch (error: unknown) {
        message.error(getErrorMessage(error, 'message.getExecutionStatusFail'));
        setExecution(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [planId]);

  const {
    state: streamState,
    isRecovering,
  } = useAIStreamSubscription<ReplanStreamState>({
    scopeType: 'repair_track',
    scopeId: execution?.track_id ?? null,
    enabled: Boolean(execution?.track_id) && waitingForAI,
    initialState: initialStreamState,
    reduceReady,
    reduceEvent,
    hasRecoverableState: (state) => Boolean(state.latestSnapshot),
    shouldClearRecoveringOnEvent: (event) => event.metadata?.task_type === 'repair_replan',
    onConnectionError: () => {
      setStreamError(null);
    },
    onTerminalError: (error) => {
      setStreamError(error.message);
    },
    isTerminalError: (error) => Boolean(error.status && error.status >= 400 && error.status !== 429),
  });

  const nextPlanId = useMemo(() => {
    const fromStream = typeof streamState.latestSnapshot?.metadata?.plan_id === 'string'
      ? streamState.latestSnapshot?.metadata?.plan_id
      : null;
    return fromStream || execution?.superseded_plan_id || null;
  }, [execution?.superseded_plan_id, streamState.latestSnapshot?.metadata]);

  useEffect(() => {
    if (streamState.latestSnapshot?.status === 'persisted' && nextPlanId) {
      message.success('這一輪已經重新調整好了，先從更容易開始的版本繼續。');
      navigate(`/execution/${nextPlanId}/checkin`);
    }
  }, [navigate, nextPlanId, streamState.latestSnapshot?.status]);

  const handleSubmit = async () => {
    if (!execution?.track_id || submitting) return;
    setSubmitting(true);
    setStreamError(null);
    try {
      await replanTrack(execution.track_id, formValues);
      setWaitingForAI(true);
      message.success('已開始重新調整這一輪，正在把它改成更能承受的版本。');
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'message.operationFail'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="execution-checkin-page">
          <Spin size="large" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!execution) {
    return (
      <ProtectedRoute>
        <div className="execution-checkin-page">
          <AIErrorState
            title="目前無法讀取這一輪修復旅程"
            description="請稍後再試，或先回到修復進展看板。"
            actions={(
              <Button size="small" type="primary" onClick={() => navigate('/execution/dashboard')}>
                回到修復進展
              </Button>
            )}
          />
        </div>
      </ProtectedRoute>
    );
  }

  if (!execution.track_id && execution.superseded_plan_id) {
    return (
      <ProtectedRoute>
        <div className="execution-checkin-page">
          <Alert
            type="success"
            showIcon
            message="這一輪已經有更新版本"
            description="原本這個版本已經被新的調整版取代，你可以直接回到最新的一步。"
            action={(
              <Button size="small" type="primary" onClick={() => navigate(`/execution/${execution.superseded_plan_id}/checkin`)}>
                前往最新版本
              </Button>
            )}
          />
        </div>
      </ProtectedRoute>
    );
  }

  if (!execution.track_id) {
    return (
      <ProtectedRoute>
        <div className="execution-checkin-page">
          <Alert
            type="warning"
            showIcon
            message="目前沒有可重新調整的修復旅程"
            action={(
              <Button size="small" type="primary" onClick={() => navigate('/execution/dashboard')}>
                回到修復進展
              </Button>
            )}
          />
        </div>
      </ProtectedRoute>
    );
  }

  const waitingSnapshot = streamState.latestSnapshot;
  const waitingPhase = waitingSnapshot?.phase ?? null;
  const isWaitingState = waitingForAI || execution.journey_status === 'replanning';

  return (
    <ProtectedRoute>
      <SEO title="重新調整這一輪修復旅程" description="把這一輪調成更能承受的版本" />
      <div className="execution-checkin-page" role="main" aria-label="重新調整這一輪修復旅程">
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              返回
            </Button>
            <Title level={2}>重新調整這一輪</Title>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="down" delay={180}>
          <Card style={{ marginBottom: 24 }}>
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Text strong>{execution.plan_summary?.title || '這一輪修復旅程'}</Text>
              <Paragraph className="mb-0">
                這不是從頭來過，而是把這一輪調成更貼近你們現在狀態的版本。
              </Paragraph>
              {execution.current_step?.content ? (
                <Alert
                  type="info"
                  showIcon
                  title="目前最卡的地方"
                  description={execution.current_step.content}
                />
              ) : null}
              {isRecovering ? (
                <AIRecoveryBadge text="連線剛剛中斷了，正在恢復這一輪重調進度…" />
              ) : null}
            </Space>
          </Card>
        </AnimatedWrapper>

        {isWaitingState ? (
          <AnimatedWrapper animation="slide" direction="up" delay={220}>
            <Card>
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Title level={4}>正在重新調整這一輪</Title>
                  <Paragraph className="mb-0">
                    系統會保留原來版本的歷史，只把下一步調成更能承受的版本。你不需要一直盯著看，完成後會直接帶你回到新的下一步。
                  </Paragraph>
                </div>

                <AIPhaseTimeline
                  currentPhase={waitingPhase}
                  phaseHistory={streamState.phaseHistory}
                  getLabel={(phase) => phaseLabelMap[phase] || phase}
                />

                {waitingSnapshot?.text ? (
                  <Alert
                    type={waitingSnapshot.status === 'failed' ? 'error' : waitingSnapshot.status === 'persisted' ? 'success' : 'info'}
                    showIcon
                    title={waitingSnapshot.status === 'persisted' ? '新版本已經準備好' : '調整摘要'}
                    description={waitingSnapshot.text}
                  />
                ) : null}

                {waitingSnapshot?.status === 'failed' || streamError ? (
                  <AIErrorState
                    title="這一輪重新調整失敗了"
                    description={streamError || waitingSnapshot?.error?.message || '原本的版本還保留著，你可以稍後重試，或先回到原本的一小步。'}
                    actions={(
                      <Space wrap>
                          <Button
                            size="small"
                            type="primary"
                            loading={submitting}
                            onClick={() => void handleSubmit()}
                        >
                          重新試一次
                        </Button>
                        <Button size="small" onClick={() => navigate(`/execution/${execution.plan_id}/checkin`)}>
                          回到原本的一小步
                        </Button>
                      </Space>
                    )}
                  />
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    title="這一輪正在處理中"
                    description="如果現在先離開也沒關係，之後回來或從通知裡進來，都會接到目前進度。"
                  />
                )}
              </Space>
            </Card>
          </AnimatedWrapper>
        ) : (
          <AnimatedWrapper animation="slide" direction="up" delay={220}>
            <Card>
              <div>
                <div style={{ marginBottom: 24 }}>
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>
                    這一輪最主要卡在哪裡
                  </Text>
                  <Radio.Group
                    value={formValues.reason}
                    onChange={(event) => setFormValues((prev) => ({
                      ...prev,
                      reason: event.target.value as keyof typeof reasonLabelMap,
                    }))}
                  >
                    {Object.entries(reasonLabelMap).map(([value, label]) => (
                      <Radio key={value} value={value}>
                        {label}
                      </Radio>
                    ))}
                  </Radio.Group>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>
                    你希望我怎麼調整
                  </Text>
                  <Radio.Group
                    value={formValues.mode}
                    onChange={(event) => setFormValues((prev) => ({
                      ...prev,
                      mode: event.target.value as keyof typeof modeLabelMap,
                    }))}
                  >
                    {Object.entries(modeLabelMap).map(([value, label]) => (
                      <Radio key={value} value={value}>
                        {label}
                      </Radio>
                    ))}
                  </Radio.Group>
                </div>

                <Space wrap>
                  <Button type="primary" icon={<ReloadOutlined />} loading={submitting} onClick={() => void handleSubmit()}>
                    重新調整這一輪
                  </Button>
                  <Button onClick={() => navigate(`/execution/${execution.plan_id}/checkin`)}>
                    先回到今天的一小步
                  </Button>
                </Space>
              </div>
            </Card>
          </AnimatedWrapper>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ExecutionReplan;
