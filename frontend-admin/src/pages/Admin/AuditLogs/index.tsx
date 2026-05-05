import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi } from '@/services/api/admin';
import type { AdminAuditLogItem } from '@/types/admin';
import { t } from '@/utils/i18n';

export default function AdminAuditLogsPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState<Dayjs | null>(null);
  const [to, setTo] = useState<Dayjs | null>(null);
  const query = useQuery({
    queryKey: [
      'admin',
      'audit-logs',
      entityType,
      action,
      from?.toISOString(),
      to?.toISOString(),
    ],
    queryFn: () =>
      adminApi.listAuditLogs({
        entityType: entityType || undefined,
        action: action || undefined,
        from: from?.toISOString(),
        to: to?.toISOString(),
        limit: 100,
        offset: 0,
      }),
  });

  const downloadCsv = async () => {
    try {
      const blob = await adminApi.downloadAuditLogsCsv({
        entityType: entityType || undefined,
        action: action || undefined,
        from: from?.toISOString(),
        to: to?.toISOString(),
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-audit-logs-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('admin.audit.exportFailed'));
    }
  };

  const items = query.data?.items || [];

  return (
    <div className="space-y-6 w-full">
      <div>
        <h3 className="text-xl font-semibold">{t('admin.audit.heading')}</h3>
        <p className="text-sm text-muted-foreground">{t('admin.audit.subtitle')}</p>
      </div>
      {query.error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {t('admin.audit.loadFailed')}
        </div>
      )}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-48"
              placeholder={t('admin.audit.entityType')}
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            />
            <Input
              className="w-48"
              placeholder={t('admin.audit.action')}
              value={action}
              onChange={(event) => setAction(event.target.value)}
            />
            <Input
              className="w-48"
              type="datetime-local"
              placeholder={t('admin.audit.from')}
              value={from ? from.format('YYYY-MM-DDTHH:mm') : ''}
              onChange={(event) =>
                setFrom(event.target.value ? dayjs(event.target.value) : null)
              }
            />
            <Input
              className="w-48"
              type="datetime-local"
              placeholder={t('admin.audit.to')}
              value={to ? to.format('YYYY-MM-DDTHH:mm') : ''}
              onChange={(event) =>
                setTo(event.target.value ? dayjs(event.target.value) : null)
              }
            />
            <Button variant="outline" onClick={downloadCsv}>
              {t('admin.audit.exportCsv')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {query.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.audit.createdAt')}</TableHead>
                  <TableHead>{t('admin.audit.actor')}</TableHead>
                  <TableHead>{t('admin.audit.entityType')}</TableHead>
                  <TableHead>{t('admin.audit.action')}</TableHead>
                  <TableHead>{t('admin.audit.detail')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row: AdminAuditLogItem) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.created_at}</TableCell>
                    <TableCell>{row.actor_id}</TableCell>
                    <TableCell>{row.entity_type}</TableCell>
                    <TableCell>{row.action}</TableCell>
                    <TableCell>
                      <pre className="m-0 text-xs">{JSON.stringify(row.detail)}</pre>
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
