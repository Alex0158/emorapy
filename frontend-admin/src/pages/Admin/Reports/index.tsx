import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi } from '@/services/api/admin';
import { t } from '@/utils/i18n';

export default function AdminReportsPage() {
  const [metricsInput, setMetricsInput] = useState('dau,mau,judgment_failed');
  const [aiStreamDays, setAIStreamDays] = useState(7);
  const [aiStreamSource, setAIStreamSource] = useState<'live' | 'archive' | 'all'>('all');
  const [aiStreamStatus, setAIStreamStatus] = useState<string | undefined>(undefined);
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const overviewQuery = useQuery({
    queryKey: ['admin', 'reports', 'overview'],
    queryFn: adminApi.getReportOverview,
  });
  const funnelQuery = useQuery({
    queryKey: ['admin', 'reports', 'funnel'],
    queryFn: adminApi.getReportFunnel,
  });
  const customMutation = useMutation({
    mutationFn: (metrics: string[]) => adminApi.getCustomReport(metrics),
  });
  const costQuery = useQuery({
    queryKey: ['admin', 'reports', 'costs'],
    queryFn: adminApi.getReportCosts,
  });
  const aiStreamOverviewQuery = useQuery({
    queryKey: ['admin', 'reports', 'ai-streams', aiStreamDays],
    queryFn: () => adminApi.getReportAIStreams({ days: aiStreamDays, limit: 10 }),
  });
  const aiStreamSessionsQuery = useQuery({
    queryKey: ['admin', 'reports', 'ai-streams', 'sessions', aiStreamDays, aiStreamSource, aiStreamStatus],
    queryFn: () => adminApi.listReportAIStreamSessions({
      days: aiStreamDays,
      source: aiStreamSource,
      status: aiStreamStatus,
      limit: 20,
      offset: 0,
    }),
  });
  const aiStreamDetailQuery = useQuery({
    queryKey: ['admin', 'reports', 'ai-streams', 'detail', selectedStreamId, aiStreamSource],
    queryFn: () => adminApi.getReportAIStreamDetail(selectedStreamId, {
      source: aiStreamSource,
      eventLimit: 100,
    }),
    enabled: Boolean(selectedStreamId),
  });

  const runCustomReport = () => {
    const metrics = metricsInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    customMutation.mutate(metrics);
  };

  const exportOverviewCsv = async () => {
    try {
      const blob = await adminApi.downloadReportOverviewCsv();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-overview-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('admin.reports.loadFailed'));
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h3 className="text-xl font-semibold">{t('admin.reports.heading')}</h3>
        <p className="text-sm text-muted-foreground">{t('admin.reports.subtitle')}</p>
      </div>
      {(overviewQuery.error || funnelQuery.error || costQuery.error || aiStreamOverviewQuery.error || aiStreamSessionsQuery.error || aiStreamDetailQuery.error) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {t('admin.reports.loadFailed')}
        </div>
      )}

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.reports.overview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.users')}</p>
              <p className="text-2xl font-bold">{overviewQuery.data?.totals.users || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.cases')}</p>
              <p className="text-2xl font-bold">{overviewQuery.data?.totals.cases || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.judgments')}</p>
              <p className="text-2xl font-bold">{overviewQuery.data?.totals.judgments || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.pairingRate')}</p>
              <p className="text-2xl font-bold">{(overviewQuery.data?.conversion.pairingRate || 0).toFixed(4)}</p>
            </div>
          </div>
          <Button variant="outline" className="mt-3" onClick={exportOverviewCsv}>
            {t('admin.reports.exportCsv')}
          </Button>
        </CardContent>
      </Card>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.reports.funnel')}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="m-0 text-xs">{JSON.stringify(funnelQuery.data?.stages || [], null, 2)}</pre>
        </CardContent>
      </Card>

      {/* Custom Report */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.reports.custom')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="admin-custom-metrics" className="text-sm font-medium text-foreground">
              {t('admin.reports.customMetricsLabel')}
            </label>
            <Input
              id="admin-custom-metrics"
              value={metricsInput}
              onChange={(event) => setMetricsInput(event.target.value)}
              placeholder={t('admin.reports.metricsPlaceholder')}
              autoComplete="off"
            />
          </div>
          <Button variant="outline" onClick={runCustomReport} disabled={customMutation.isPending}>
            {customMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('admin.reports.runCustom')}
          </Button>
          <pre className="m-0 text-xs">{JSON.stringify(customMutation.data?.metrics || {}, null, 2)}</pre>
        </CardContent>
      </Card>

      {/* Costs */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.reports.costs')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {costQuery.data?.partial && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{t('admin.reports.costsPartial')}</p>
                <p className="text-xs">{(costQuery.data.reasons || []).join('; ') || '-'}</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.redisMemoryMb')}</p>
              <p className="text-2xl font-bold">{(costQuery.data?.summary.redisMemoryMb || 0).toFixed(2)} MB</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.railwayEgress24h')}</p>
              <p className="text-2xl font-bold">{(costQuery.data?.summary.railwayEgressGb24h || 0).toFixed(3)} GB</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.openaiCost24h')}</p>
              <p className="text-2xl font-bold">${(costQuery.data?.summary.openaiCostUsd24h || 0).toFixed(4)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.openaiCost7d')}</p>
              <p className="text-2xl font-bold">${(costQuery.data?.summary.openaiCostUsd7d || 0).toFixed(4)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{`Redis: ${costQuery.data?.redis.status || 'unknown'}`}</Badge>
            <Badge variant="secondary">{`Railway: ${costQuery.data?.railway.status || 'unknown'}`}</Badge>
            <Badge variant="secondary">{`OpenAI: ${costQuery.data?.openai.status || 'unknown'}`}</Badge>
          </div>
          <pre className="m-0 text-xs">
            {JSON.stringify(
              {
                railwayDailyEgressGb: costQuery.data?.railway.dailyEgressGb || [],
                openaiDailyCostUsd: costQuery.data?.openai.dailyCostUsd || [],
                openaiTokens24h: {
                  input: costQuery.data?.summary.openaiInputTokens24h || 0,
                  output: costQuery.data?.summary.openaiOutputTokens24h || 0,
                },
              },
              null,
              2
            )}
          </pre>
        </CardContent>
      </Card>

      {/* AI Streams */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.reports.aiStreams')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1">
              <Label htmlFor="admin-ai-stream-days" className="text-sm text-muted-foreground">
                {t('admin.reports.aiStreamsWindowDays')}
              </Label>
              <Input
                id="admin-ai-stream-days"
                type="number"
                min={1}
                max={90}
                autoComplete="off"
                className="w-20"
                value={aiStreamDays}
                onChange={(event) => setAIStreamDays(Number(event.target.value) || 7)}
              />
            </div>
            <Select value={aiStreamSource} onValueChange={(value: string) => setAIStreamSource(value as 'live' | 'archive' | 'all')}>
              <SelectTrigger className="w-[180px]" aria-label={t('admin.reports.aiStreamsSourceFilter')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.reports.aiStreamsSourceAll')}</SelectItem>
                <SelectItem value="live">{t('admin.reports.aiStreamsSourceLive')}</SelectItem>
                <SelectItem value="archive">{t('admin.reports.aiStreamsSourceArchive')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={aiStreamStatus || '__all__'}
              onValueChange={(value: string) => setAIStreamStatus(value === '__all__' ? undefined : value)}
            >
              <SelectTrigger className="w-[180px]" aria-label={t('admin.reports.aiStreamsStatusFilter')}>
                <SelectValue placeholder={t('admin.reports.aiStreamsStatusFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('admin.reports.aiStreamsStatusFilter')}</SelectItem>
                {['created', 'queued', 'started', 'streaming', 'completed', 'persisted', 'failed', 'cancelled'].map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.aiStreamsTotalSessions')}</p>
              <p className="text-2xl font-bold">{aiStreamOverviewQuery.data?.totals.totalSessions || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.aiStreamsRecentSessions')}</p>
              <p className="text-2xl font-bold">{aiStreamOverviewQuery.data?.totals.recentSessions || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.aiStreamsRecentEvents')}</p>
              <p className="text-2xl font-bold">{aiStreamOverviewQuery.data?.totals.recentEvents || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.aiStreamsActiveSessions')}</p>
              <p className="text-2xl font-bold">{aiStreamOverviewQuery.data?.totals.activeSessions || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.aiStreamsArchivedSessions')}</p>
              <p className="text-2xl font-bold">{aiStreamOverviewQuery.data?.totals.archivedSessions || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.reports.aiStreamsArchivedEvents')}</p>
              <p className="text-2xl font-bold">{aiStreamOverviewQuery.data?.totals.archivedEvents || 0}</p>
            </div>
          </div>

          {/* Retention Policy */}
          <div>
            <h4 className="text-sm font-semibold mb-2">{t('admin.reports.aiStreamsRetention')}</h4>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('admin.reports.aiStreamsBackendMode')}</span>
                <span>{aiStreamOverviewQuery.data?.retentionPolicy.backendMode || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('admin.reports.aiStreamsArchiveEnabled')}</span>
                <span>{String(aiStreamOverviewQuery.data?.retentionPolicy.archiveEnabled ?? false)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('admin.reports.aiStreamsSessionRetention')}</span>
                <span>{aiStreamOverviewQuery.data?.retentionPolicy.sessionRetentionDays || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('admin.reports.aiStreamsEventRetention')}</span>
                <span>{aiStreamOverviewQuery.data?.retentionPolicy.eventRetentionDays || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('admin.reports.aiStreamsArchiveBatchSize')}</span>
                <span>{aiStreamOverviewQuery.data?.retentionPolicy.archiveBatchSize || 0}</span>
              </div>
            </div>
          </div>

          {/* Tags by status/scope/backend */}
          <div className="flex flex-wrap gap-2">
            {(aiStreamOverviewQuery.data?.byStatus || []).map((item) => (
              <Badge key={`status-${item.status}`} variant="secondary">{`${item.status}: ${item.count}`}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(aiStreamOverviewQuery.data?.byScopeType || []).map((item) => (
              <Badge key={`scope-${item.scopeType}`} variant="secondary">{`${item.scopeType}: ${item.count}`}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(aiStreamOverviewQuery.data?.byBackendMode || []).map((item) => (
              <Badge key={`backend-${item.backendMode}`} variant="secondary">{`${item.backendMode}: ${item.count}`}</Badge>
            ))}
          </div>

          {/* Sessions Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.reports.aiStreamsColStream')}</TableHead>
                <TableHead>{t('admin.reports.aiStreamsColScope')}</TableHead>
                <TableHead>{t('admin.reports.aiStreamsColStatus')}</TableHead>
                <TableHead>{t('admin.reports.aiStreamsColSource')}</TableHead>
                <TableHead>{t('admin.reports.aiStreamsColSeq')}</TableHead>
                <TableHead>{t('admin.reports.aiStreamsColUpdatedAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(aiStreamSessionsQuery.data?.items || []).map((record) => (
                <TableRow
                  key={record.streamId}
                  className="cursor-pointer"
                  onClick={() => setSelectedStreamId(record.streamId)}
                >
                  <TableCell>
                    <button
                      className="text-primary underline-offset-4 hover:underline text-sm"
                      aria-label={`${t('admin.reports.aiStreamsColStream')} ${record.streamId}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedStreamId(record.streamId); }}
                    >
                      {record.streamId}
                    </button>
                  </TableCell>
                  <TableCell>{`${record.scopeType}:${record.scopeId}`}</TableCell>
                  <TableCell><Badge variant="outline">{record.status}</Badge></TableCell>
                  <TableCell>{record.source}</TableCell>
                  <TableCell>{record.lastSeq}</TableCell>
                  <TableCell>{dayjs(record.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator />

          {/* Stream Detail */}
          {selectedStreamId ? (
            <div className="space-y-4">
              <h5 className="text-base font-semibold">{t('admin.reports.aiStreamsDetail')}</h5>
              {aiStreamDetailQuery.data ? (
                <>
                  <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.reports.aiStreamsColStream')}</span>
                      <span>{aiStreamDetailQuery.data.session.streamId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.reports.aiStreamsColSource')}</span>
                      <span>{aiStreamDetailQuery.data.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.reports.aiStreamsColScope')}</span>
                      <span>{`${aiStreamDetailQuery.data.session.scopeType}:${aiStreamDetailQuery.data.session.scopeId}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.reports.aiStreamsColStatus')}</span>
                      <span>{aiStreamDetailQuery.data.session.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.reports.aiStreamsColSeq')}</span>
                      <span>{aiStreamDetailQuery.data.session.lastSeq}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.reports.aiStreamsBackendMode')}</span>
                      <span>{aiStreamDetailQuery.data.session.backendMode || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.reports.aiStreamsMessageId')}</span>
                      <span>{aiStreamDetailQuery.data.session.messageId || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.reports.aiStreamsUpdatedAt')}</span>
                      <span>{dayjs(aiStreamDetailQuery.data.session.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                    </div>
                  </div>
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">{t('admin.reports.aiStreamsTextSnapshot')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="m-0 whitespace-pre-wrap text-xs">{aiStreamDetailQuery.data.session.text || '-'}</pre>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">{t('admin.reports.aiStreamsEvents')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="m-0 max-h-[360px] overflow-auto text-xs">
                        {JSON.stringify(aiStreamDetailQuery.data.events, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t('admin.reports.aiStreamsPickStream')}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('admin.reports.aiStreamsPickStream')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
