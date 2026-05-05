import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { adminApi } from '@/services/api/admin';
import type { AdminConfigItem } from '@/types/admin';
import { t } from '@/utils/i18n';

interface ConfigFormValues {
  key: string;
  value: string;
  description?: string;
  isRuntime?: boolean;
  isSensitive?: boolean;
}

export default function AdminConfigsPage() {
  const queryClient = useQueryClient();
  const { hasPermission: canWriteConfigs } = useAdminAccess(['config:write'], true);

  const [formValues, setFormValues] = useState<ConfigFormValues>({
    key: '',
    value: '{}',
    description: '',
    isRuntime: true,
    isSensitive: false,
  });

  const listQuery = useQuery({
    queryKey: ['admin', 'configs'],
    queryFn: () => adminApi.listConfigs({ limit: 100, offset: 0 }),
  });
  const runtimeQuery = useQuery({
    queryKey: ['admin', 'runtime', 'interview'],
    queryFn: adminApi.getInterviewRuntimeConfig,
  });
  const upsertMutation = useMutation({
    mutationFn: (values: ConfigFormValues) =>
      adminApi.upsertConfig({
        key: values.key,
        value: JSON.parse(values.value),
        description: values.description,
        isRuntime: values.isRuntime,
        isSensitive: values.isSensitive,
      }),
    onSuccess: () => {
      toast.success(t('admin.configs.saveSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'runtime', 'interview'],
      });
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.configs.saveFailed'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.key || !formValues.value) return;
    upsertMutation.mutate(formValues);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h3 className="text-xl font-semibold">{t('admin.configs.heading')}</h3>
        <p className="text-sm text-muted-foreground">{t('admin.configs.subtitle')}</p>
      </div>

      {(listQuery.error || runtimeQuery.error) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {t('admin.configs.loadFailed')}
        </div>
      )}

      {!canWriteConfigs && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4" />
          {t('admin.configs.writeDenied')}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.configs.runtime')}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm whitespace-pre-wrap break-all">
            {JSON.stringify(runtimeQuery.data?.runtime || {}, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.configs.upsert')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="config-key">{t('admin.configs.key')}</Label>
              <Input
                id="config-key"
                value={formValues.key}
                onChange={(e) => setFormValues((prev) => ({ ...prev, key: e.target.value }))}
                disabled={!canWriteConfigs}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="config-value">{t('admin.configs.valueJson')}</Label>
              <Textarea
                id="config-value"
                rows={4}
                value={formValues.value}
                onChange={(e) => setFormValues((prev) => ({ ...prev, value: e.target.value }))}
                disabled={!canWriteConfigs}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="config-description">{t('admin.configs.description')}</Label>
              <Input
                id="config-description"
                value={formValues.description}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, description: e.target.value }))
                }
                disabled={!canWriteConfigs}
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="config-isRuntime"
                  checked={formValues.isRuntime}
                  onCheckedChange={(checked: boolean) =>
                    setFormValues((prev) => ({ ...prev, isRuntime: checked }))
                  }
                  disabled={!canWriteConfigs}
                />
                <Label htmlFor="config-isRuntime">{t('admin.configs.isRuntime')}</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="config-isSensitive"
                  checked={formValues.isSensitive}
                  onCheckedChange={(checked: boolean) =>
                    setFormValues((prev) => ({ ...prev, isSensitive: checked }))
                  }
                  disabled={!canWriteConfigs}
                />
                <Label htmlFor="config-isSensitive">{t('admin.configs.isSensitive')}</Label>
              </div>
            </div>

            <Button type="submit" disabled={!canWriteConfigs || upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.configs.save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.configs.list')}</CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.configs.key')}</TableHead>
                  <TableHead>{t('admin.configs.value')}</TableHead>
                  <TableHead>{t('admin.configs.updatedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(listQuery.data?.items || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  (listQuery.data?.items || []).map((row: AdminConfigItem) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.key}</TableCell>
                      <TableCell>
                        <pre className="text-sm m-0">{JSON.stringify(row.value)}</pre>
                      </TableCell>
                      <TableCell>{row.updated_at}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
