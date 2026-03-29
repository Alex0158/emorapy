/**
 * 管理員運維 - Cron 任務統計看板
 */

import { Alert, Button, Card, Col, Empty, Input, InputNumber, Row, Segmented, Space, Statistic, Table, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useAdminJobStats } from '@/hooks/useAdminJobStats';
import { useAdminTokenEditor } from '@/hooks/useAdminTokenEditor';
import { getRateDenominatorLabel, shouldShowSampledHint } from '@/services/api/admin';
import type { AdminJobStatsPerJob, AdminJobStatsQuery } from '@/types/admin';
import {
  DEFAULT_ADMIN_JOB_STATS_QUERY,
  updateAdminJobStatsDays,
  updateAdminJobStatsIncludeRunning,
  updateAdminJobStatsMaxRows,
} from '@/utils/adminJobStatsQuery';
import { deriveAdminOpsJobsAccessState, deriveAdminOpsJobsDataState } from '@/utils/adminOpsJobsViewState';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

const OpsJobsStatsPage = () => {
  const { tokenInput, setTokenInput, tokenState, saveToken, clearToken } = useAdminTokenEditor();
  const [query, setQuery] = useState<Required<AdminJobStatsQuery>>(
    () => DEFAULT_ADMIN_JOB_STATS_QUERY
  );

  const { tokenReady } = tokenState;
  const { adminMeQuery, hasPermission: hasOpsReadPermission } = useAdminAccess(['ops:read'], tokenReady);
  const accessViewState = deriveAdminOpsJobsAccessState({
    tokenState,
    adminMeLoading: adminMeQuery.isLoading,
    adminMeError: adminMeQuery.error,
    hasOpsReadPermission,
  });
  const canLoadStats = accessViewState.canLoadStats;
  const statsQuery = useAdminJobStats(query, canLoadStats);
  const rateBaseLabel = (() => {
    const fallback = t('admin.ops.rateBase.totalRuns');
    if (!statsQuery.data) return fallback;
    const baseCode = getRateDenominatorLabel(statsQuery.data.rateBase);
    const translated = t(`admin.ops.rateBase.${baseCode}`);
    return translated === `admin.ops.rateBase.${baseCode}` ? baseCode : translated;
  })();
  const sampled = statsQuery.data ? shouldShowSampledHint(statsQuery.data) : false;
  const dataViewState = deriveAdminOpsJobsDataState({
    canLoadStats,
    statsError: statsQuery.error,
    sampled,
  });

  const perJobColumns = useMemo(
    () => [
      {
        title: t('admin.ops.jobKey'),
        dataIndex: 'jobKey',
        key: 'jobKey',
      },
      {
        title: t('admin.ops.totalRuns'),
        dataIndex: 'totalRuns',
        key: 'totalRuns',
      },
      {
        title: t('admin.ops.successRate'),
        dataIndex: 'successRate',
        key: 'successRate',
        render: (value: number) => `${(value * 100).toFixed(2)}%`,
      },
      {
        title: t('admin.ops.failureRate'),
        dataIndex: 'failureRate',
        key: 'failureRate',
        render: (value: number) => `${(value * 100).toFixed(2)}%`,
      },
      {
        title: t('admin.ops.avgDurationMs'),
        dataIndex: 'avgDurationMs',
        key: 'avgDurationMs',
      },
    ],
    []
  );

  const handleSaveToken = () => {
    const result = saveToken();
    if (result === 'required') {
      message.warning(t('admin.ops.tokenRequired'));
      return;
    }
    if (result === 'invalid') {
      message.error(t('admin.ops.invalidTokenFormat'));
      return;
    }
    if (result === 'storage_failed') {
      message.error(t('admin.ops.tokenSaveFailed'));
      return;
    }

    message.success(t('admin.ops.tokenSaved'));
  };

  const handleClearToken = () => {
    const result = clearToken();
    if (result === 'storage_failed') {
      message.error(t('admin.ops.tokenClearFailed'));
      return;
    }
    message.success(t('admin.ops.tokenCleared'));
  };

  const handleRetryStats = () => {
    if (!canLoadStats) return;
    void statsQuery.refetch();
  };

  const totals = statsQuery.data?.totals;

  return (
    <>
      <SEO title={t('admin.ops.title')} description={t('admin.ops.subtitle')} />
      <div className="admin-page" role="main" aria-label={t('admin.ops.pageLabel')}>
        <div className="admin-page__header">
          <Title level={3} className="admin-page__header-title">{t('admin.ops.heading')}</Title>
          <Text type="secondary" className="admin-page__header-subtitle">{t('admin.ops.subtitle')}</Text>
        </div>

        <AnimatedWrapper animation="slide" direction="up" delay={150}>
          <Card className="admin-page__table-card">
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Text strong>{t('admin.ops.tokenLabel')}</Text>
              <Space wrap>
                <Input.Password
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder={t('admin.ops.tokenPlaceholder')}
                  style={{ minWidth: 320 }}
                />
                <Button type="primary" onClick={handleSaveToken}>
                  {t('admin.ops.saveToken')}
                </Button>
                <Button onClick={handleClearToken}>{t('admin.ops.clearToken')}</Button>
              </Space>
              {tokenState.showInlineInvalid ? (
                <Alert showIcon type="error" title={t('admin.ops.invalidTokenFormat')} />
              ) : (
                tokenState.showInlineNotApplied && (
                  <Alert
                    showIcon
                    type="info"
                    title={t('admin.ops.tokenNotApplied')}
                  />
                )
              )}
              <Space wrap>
                <Text>{t('admin.ops.days')}</Text>
                <InputNumber
                  min={1}
                  max={90}
                  value={query.days}
                  onChange={(value) =>
                    setQuery((prev) => updateAdminJobStatsDays(prev, value))
                  }
                />
                <Text>{t('admin.ops.maxRows')}</Text>
                <InputNumber
                  min={100}
                  max={20000}
                  step={100}
                  value={query.maxRows}
                  onChange={(value) =>
                    setQuery((prev) => updateAdminJobStatsMaxRows(prev, value))
                  }
                />
                <Segmented
                  options={[
                    { label: t('admin.ops.rateModeTotal'), value: true },
                    { label: t('admin.ops.rateModeCompleted'), value: false },
                  ]}
                  value={query.includeRunning}
                  onChange={(value) =>
                    setQuery((prev) =>
                      updateAdminJobStatsIncludeRunning(prev, value)
                    )
                  }
                />
                <Button disabled={!canLoadStats || statsQuery.isFetching} onClick={handleRetryStats}>
                  {t('common.retry')}
                </Button>
              </Space>
            </Space>
          </Card>
        </AnimatedWrapper>

        {accessViewState.showPageTokenInvalid ? (
          <AnimatedWrapper animation="slide" direction="up" delay={170}>
            <Alert style={{ marginTop: 16 }} showIcon type="error" title={t('admin.ops.invalidTokenFormat')} />
          </AnimatedWrapper>
        ) : accessViewState.showPageTokenRequired && (
          <AnimatedWrapper animation="slide" direction="up" delay={170}>
            <Alert style={{ marginTop: 16 }} showIcon type="warning" title={t('admin.ops.tokenRequired')} />
          </AnimatedWrapper>
        )}

        {accessViewState.showVerifyingAccess && (
          <AnimatedWrapper animation="slide" direction="up" delay={175}>
            <Alert style={{ marginTop: 16 }} showIcon type="info" title={t('admin.ops.verifyingAccess')} />
          </AnimatedWrapper>
        )}

        {accessViewState.showIdentityFailed && (
          <AnimatedWrapper animation="slide" direction="up" delay={178}>
            <Alert style={{ marginTop: 16 }} showIcon type="error" title={t('admin.ops.identityFailed')} />
          </AnimatedWrapper>
        )}
        {accessViewState.showNetworkError && (
          <AnimatedWrapper animation="slide" direction="up" delay={178}>
            <Alert style={{ marginTop: 16 }} showIcon type="error" title={t('common.networkError')} />
          </AnimatedWrapper>
        )}

        {accessViewState.showAccessDenied && (
          <AnimatedWrapper animation="slide" direction="up" delay={179}>
            <Alert style={{ marginTop: 16 }} showIcon type="warning" title={t('admin.ops.accessDenied')} />
          </AnimatedWrapper>
        )}

        {dataViewState.showLoadFailed && (
          <AnimatedWrapper animation="slide" direction="up" delay={180}>
            <Alert
              style={{ marginTop: 16 }}
              showIcon
              type="error"
              title={t('admin.ops.loadFailed')}
              action={
                <Button
                  size="small"
                  loading={statsQuery.isFetching}
                  onClick={handleRetryStats}
                  data-testid="admin-ops-load-retry"
                >
                  {t('common.retry')}
                </Button>
              }
            />
          </AnimatedWrapper>
        )}

        {dataViewState.showSampledHint && (
          <AnimatedWrapper animation="slide" direction="up" delay={190}>
            <Alert
              style={{ marginTop: 16 }}
              showIcon
              type="info"
              title={t('admin.ops.sampledHint').replace('{rows}', String(statsQuery.data?.statsMeta.returnedRows ?? 0))}
            />
          </AnimatedWrapper>
        )}

        {totals && canLoadStats && (
          <AnimatedWrapper animation="slide" direction="up" delay={200}>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                {t('admin.ops.rateBaseLabel').replace('{base}', rateBaseLabel)}
              </Text>
              <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Card>
                    <Statistic title={t('admin.ops.totalRuns')} value={totals.totalRuns} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Card>
                    <Statistic title={t('admin.ops.successRuns')} value={totals.successRuns} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Card>
                    <Statistic title={t('admin.ops.failedRuns')} value={totals.failedRuns} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                  <Card>
                    <Statistic title={t('admin.ops.avgDurationMs')} value={totals.avgDurationMs} />
                  </Card>
                </Col>
              </Row>
            </div>
          </AnimatedWrapper>
        )}

        {canLoadStats && statsQuery.data && (
          <AnimatedWrapper animation="slide" direction="up" delay={220}>
            <Card style={{ marginTop: 16 }}>
              {statsQuery.data.perJob.length === 0 ? (
                <Empty description={t('common.noData')} />
              ) : (
                <Table<AdminJobStatsPerJob>
                  rowKey={(row) => row.jobKey}
                  dataSource={statsQuery.data.perJob}
                  columns={perJobColumns}
                  pagination={{ pageSize: 10 }}
                />
              )}
            </Card>
          </AnimatedWrapper>
        )}
      </div>
    </>
  );
};

export default OpsJobsStatsPage;

