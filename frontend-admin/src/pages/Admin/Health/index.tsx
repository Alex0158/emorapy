import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { adminApi } from '@/services/api/admin';
import { t } from '@/utils/i18n';

export default function AdminHealthPage() {
  const healthQuery = useQuery({
    queryKey: ['admin', 'health', 'detailed'],
    queryFn: adminApi.getHealthDetailed,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-foreground">{t('admin.health.heading')}</h3>
        <p className="text-sm text-muted-foreground">{t('admin.health.subtitle')}</p>
      </div>

      {healthQuery.error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-sm text-foreground">{t('admin.health.loadFailed')}</p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {healthQuery.isLoading || !healthQuery.data ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableBody>
                <TableRow><TableCell className="font-medium w-48">{t('admin.health.status')}</TableCell><TableCell>{healthQuery.data.status}</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">{t('admin.health.timestamp')}</TableCell><TableCell>{healthQuery.data.timestamp}</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">{t('admin.health.cronStarted')}</TableCell><TableCell>{healthQuery.data.cronStarted ? 'Y' : 'N'}</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">{t('admin.health.activeJobCount')}</TableCell><TableCell>{healthQuery.data.activeJobCount}</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">{t('admin.health.adminCount')}</TableCell><TableCell>{healthQuery.data.adminCount}</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">{t('admin.health.userCount')}</TableCell><TableCell>{healthQuery.data.userCount}</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">{t('admin.health.env')}</TableCell><TableCell><pre className="m-0 text-xs whitespace-pre-wrap">{JSON.stringify(healthQuery.data.env, null, 2)}</pre></TableCell></TableRow>
                <TableRow><TableCell className="font-medium">{t('admin.health.performance')}</TableCell><TableCell><pre className="m-0 text-xs whitespace-pre-wrap">{JSON.stringify(healthQuery.data.performance, null, 2)}</pre></TableCell></TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
