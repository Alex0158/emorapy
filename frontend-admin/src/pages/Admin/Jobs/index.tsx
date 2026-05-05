import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminJobListItem } from '@/types/admin';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { adminApi } from '@/services/api/admin';
import { t } from '@/utils/i18n';

export default function AdminJobsPage() {
  const queryClient = useQueryClient();
  const { hasPermission: canExecuteJobs } = useAdminAccess(['ops:execute'], true);
  const jobsQuery = useQuery({
    queryKey: ['admin', 'jobs', 'list'],
    queryFn: adminApi.listJobs,
  });
  const triggerMutation = useMutation({
    mutationFn: (jobKey: string) => adminApi.triggerJob(jobKey),
    onSuccess: () => {
      toast.success(t('admin.jobs.triggerSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.jobs.triggerFailed'));
    },
  });

  const jobs = jobsQuery.data?.jobs || [];

  return (
    <div className="space-y-6 w-full">
      <div>
        <h3 className="text-xl font-semibold">{t('admin.jobs.heading')}</h3>
        <p className="text-sm text-muted-foreground">{t('admin.jobs.subtitle')}</p>
      </div>
      {jobsQuery.error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {t('admin.jobs.loadFailed')}
        </div>
      )}
      {!canExecuteJobs && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="size-4" />
          {t('admin.jobs.executeDenied')}
        </div>
      )}
      <Card>
        <CardContent className="pt-6">
          {jobsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.jobs.key')}</TableHead>
                  <TableHead>{t('admin.jobs.schedule')}</TableHead>
                  <TableHead>{t('admin.jobs.latestStatus')}</TableHead>
                  <TableHead>{t('admin.jobs.latestAt')}</TableHead>
                  <TableHead>{t('admin.jobs.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((row: AdminJobListItem) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.key}</TableCell>
                    <TableCell>{row.schedule}</TableCell>
                    <TableCell>{row.latestRun?.status || '-'}</TableCell>
                    <TableCell>{row.latestRun?.started_at || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canExecuteJobs || triggerMutation.isPending}
                        onClick={() => triggerMutation.mutate(row.key)}
                      >
                        {triggerMutation.isPending ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : null}
                        {t('admin.jobs.trigger')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
