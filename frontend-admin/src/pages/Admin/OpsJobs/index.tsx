import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useAdminJobStats } from '@/hooks/useAdminJobStats';
import { useAdminTokenEditor } from '@/hooks/useAdminTokenEditor';
import {
  getRateDenominatorLabel,
  shouldShowSampledHint,
} from '@/services/api/admin';
import type { AdminJobStatsPerJob, AdminJobStatsQuery } from '@/types/admin';
import {
  DEFAULT_ADMIN_JOB_STATS_QUERY,
  updateAdminJobStatsDays,
  updateAdminJobStatsIncludeRunning,
  updateAdminJobStatsMaxRows,
} from '@/utils/adminJobStatsQuery';
import {
  deriveAdminOpsJobsAccessState,
  deriveAdminOpsJobsDataState,
} from '@/utils/adminOpsJobsViewState';
import { t } from '@/utils/i18n';

const OpsJobsStatsPage = () => {
  const { tokenInput, setTokenInput, tokenState, saveToken, clearToken } =
    useAdminTokenEditor();
  const [query, setQuery] = useState<Required<AdminJobStatsQuery>>(
    () => DEFAULT_ADMIN_JOB_STATS_QUERY
  );

  const { tokenReady } = tokenState;
  const { adminMeQuery, hasPermission: hasOpsReadPermission } = useAdminAccess(
    ['ops:read'],
    tokenReady
  );
  const accessViewState = deriveAdminOpsJobsAccessState({
    tokenState,
    adminMeLoading: adminMeQuery.isLoading,
    adminMeError: adminMeQuery.error,
    hasOpsReadPermission,
  });
  const canLoadStats = accessViewState.canLoadStats;
  const statsQuery = useAdminJobStats(query, canLoadStats);
  const rateBaseLabel = statsQuery.data
    ? getRateDenominatorLabel(statsQuery.data.rateBase)
    : 'totalRuns';
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
        dataIndex: 'jobKey' as const,
      },
      {
        title: t('admin.ops.totalRuns'),
        dataIndex: 'totalRuns' as const,
      },
      {
        title: t('admin.ops.successRate'),
        dataIndex: 'successRate' as const,
        render: (value: number) => `${(value * 100).toFixed(2)}%`,
      },
      {
        title: t('admin.ops.failureRate'),
        dataIndex: 'failureRate' as const,
        render: (value: number) => `${(value * 100).toFixed(2)}%`,
      },
      {
        title: t('admin.ops.avgDurationMs'),
        dataIndex: 'avgDurationMs' as const,
      },
    ],
    []
  );

  const handleSaveToken = () => {
    const result = saveToken();
    if (result === 'required') {
      toast.warning(t('admin.ops.tokenRequired'));
      return;
    }
    if (result === 'invalid') {
      toast.error(t('admin.ops.invalidTokenFormat'));
      return;
    }
    if (result === 'storage_failed') {
      toast.error(t('admin.ops.tokenSaveFailed'));
      return;
    }

    toast.success(t('admin.ops.tokenSaved'));
  };

  const handleClearToken = () => {
    const result = clearToken();
    if (result === 'storage_failed') {
      toast.error(t('admin.ops.tokenClearFailed'));
      return;
    }
    toast.success(t('admin.ops.tokenCleared'));
  };

  const handleRetryStats = () => {
    if (!canLoadStats) return;
    void statsQuery.refetch();
  };

  const totals = statsQuery.data?.totals;

  // Pagination state for the per-job table
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const perJobData = statsQuery.data?.perJob ?? [];
  const totalPages = Math.ceil(perJobData.length / pageSize);
  const paginatedData = perJobData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <>
      <SEO title={t('admin.ops.title')} description={t('admin.ops.subtitle')} />
      <main
        className="execution-dashboard-page"
        aria-label={t('admin.ops.pageLabel')}
      >
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header">
            <h2 className="text-2xl font-bold">{t('admin.ops.heading')}</h2>
            <p className="text-muted-foreground">{t('admin.ops.subtitle')}</p>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={150}>
          <Card className="mt-4">
            <CardContent className="pt-6 space-y-4">
              <p className="font-semibold">{t('admin.ops.tokenLabel')}</p>
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  type="password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder={t('admin.ops.tokenPlaceholder')}
                  className="min-w-[320px] w-auto"
                />
                <Button onClick={handleSaveToken}>
                  {t('admin.ops.saveToken')}
                </Button>
                <Button variant="outline" onClick={handleClearToken}>
                  {t('admin.ops.clearToken')}
                </Button>
              </div>
              {tokenState.showInlineInvalid ? (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{t('admin.ops.invalidTokenFormat')}</span>
                </div>
              ) : (
                tokenState.showInlineNotApplied && (
                  <div className="flex items-center gap-2 text-blue-600 text-sm">
                    <Info className="h-4 w-4" />
                    <span>{t('admin.ops.tokenNotApplied')}</span>
                  </div>
                )
              )}
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-sm">{t('admin.ops.days')}</span>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={query.days}
                  onChange={(e) =>
                    setQuery((prev) => updateAdminJobStatsDays(prev, Number(e.target.value) || null))
                  }
                  className="w-20"
                />
                <span className="text-sm">{t('admin.ops.maxRows')}</span>
                <Input
                  type="number"
                  min={100}
                  max={20000}
                  step={100}
                  value={query.maxRows}
                  onChange={(e) =>
                    setQuery((prev) => updateAdminJobStatsMaxRows(prev, Number(e.target.value) || null))
                  }
                  className="w-24"
                />
                <Tabs
                  value={query.includeRunning ? 'total' : 'completed'}
                  onValueChange={(value: string) =>
                    setQuery((prev) =>
                      updateAdminJobStatsIncludeRunning(prev, value === 'total')
                    )
                  }
                >
                  <TabsList>
                    <TabsTrigger value="total">
                      {t('admin.ops.rateModeTotal')}
                    </TabsTrigger>
                    <TabsTrigger value="completed">
                      {t('admin.ops.rateModeCompleted')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  variant="outline"
                  disabled={!canLoadStats || statsQuery.isFetching}
                  onClick={handleRetryStats}
                >
                  {t('common.retry')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedWrapper>

        {accessViewState.showPageTokenInvalid ? (
          <AnimatedWrapper animation="slide" direction="up" delay={170}>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{t('admin.ops.invalidTokenFormat')}</span>
            </div>
          </AnimatedWrapper>
        ) : (
          accessViewState.showPageTokenRequired && (
            <AnimatedWrapper animation="slide" direction="up" delay={170}>
              <div className="mt-4 flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{t('admin.ops.tokenRequired')}</span>
              </div>
            </AnimatedWrapper>
          )
        )}

        {accessViewState.showVerifyingAccess && (
          <AnimatedWrapper animation="slide" direction="up" delay={175}>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-blue-500/50 bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span>{t('admin.ops.verifyingAccess')}</span>
            </div>
          </AnimatedWrapper>
        )}

        {accessViewState.showIdentityFailed && (
          <AnimatedWrapper animation="slide" direction="up" delay={178}>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{t('admin.ops.identityFailed')}</span>
            </div>
          </AnimatedWrapper>
        )}
        {accessViewState.showNetworkError && (
          <AnimatedWrapper animation="slide" direction="up" delay={178}>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{t('common.networkError')}</span>
            </div>
          </AnimatedWrapper>
        )}

        {accessViewState.showAccessDenied && (
          <AnimatedWrapper animation="slide" direction="up" delay={179}>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('admin.ops.accessDenied')}</span>
            </div>
          </AnimatedWrapper>
        )}

        {dataViewState.showLoadFailed && (
          <AnimatedWrapper animation="slide" direction="up" delay={180}>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{t('admin.ops.loadFailed')}</span>
            </div>
          </AnimatedWrapper>
        )}

        {dataViewState.showSampledHint && (
          <AnimatedWrapper animation="slide" direction="up" delay={190}>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-blue-500/50 bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                {t('admin.ops.sampledHint').replace(
                  '{rows}',
                  String(statsQuery.data?.statsMeta.returnedRows ?? 0)
                )}
              </span>
            </div>
          </AnimatedWrapper>
        )}

        {totals && canLoadStats && (
          <AnimatedWrapper animation="slide" direction="up" delay={200}>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                {t('admin.ops.rateBaseLabel').replace('{base}', rateBaseLabel)}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">{t('admin.ops.totalRuns')}</p>
                    <p className="text-2xl font-bold">{totals.totalRuns}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">{t('admin.ops.successRuns')}</p>
                    <p className="text-2xl font-bold">{totals.successRuns}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">{t('admin.ops.failedRuns')}</p>
                    <p className="text-2xl font-bold">{totals.failedRuns}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">{t('admin.ops.avgDurationMs')}</p>
                    <p className="text-2xl font-bold">{totals.avgDurationMs}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </AnimatedWrapper>
        )}

        {canLoadStats && statsQuery.data && (
          <AnimatedWrapper animation="slide" direction="up" delay={220}>
            <Card className="mt-4">
              <CardContent className="pt-6">
                {perJobData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <p>{t('common.noData')}</p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {perJobColumns.map((col) => (
                            <TableHead key={col.dataIndex}>{col.title}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedData.map((row: AdminJobStatsPerJob) => (
                          <TableRow key={row.jobKey}>
                            {perJobColumns.map((col) => (
                              <TableCell key={col.dataIndex}>
                                {col.render
                                  ? col.render(row[col.dataIndex] as number)
                                  : String(row[col.dataIndex] ?? '')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          &laquo;
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        >
                          &raquo;
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </AnimatedWrapper>
        )}
      </main>
    </>
  );
};

export default OpsJobsStatsPage;
