import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { adminApi } from '@/services/api/admin';
import type { AdminAppUserItem } from '@/types/admin';
import { t } from '@/utils/i18n';

function isUserCurrentlyLocked(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false;
  const lockedUntilTime = new Date(lockedUntil).getTime();
  if (Number.isNaN(lockedUntilTime)) return false;
  return lockedUntilTime > Date.now();
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { hasPermission: canWriteUsers } = useAdminAccess(['users:write'], true);
  const [q, setQ] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pendingActionKey, setPendingActionKey] = useState<string>('');
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', q],
    queryFn: () => adminApi.listUsers({ q, limit: 50, offset: 0 }),
  });
  const detailQuery = useQuery({
    queryKey: ['admin', 'users', 'detail', selectedUserId],
    queryFn: () => adminApi.getUserDetail(selectedUserId),
    enabled: selectedUserId.length > 0,
  });
  const hasUserDetail =
    detailQuery.data?.user !== null && detailQuery.data?.user !== undefined;

  const statusMutation = useMutation({
    mutationFn: (payload: {
      userId: string;
      action: 'lock' | 'unlock' | 'deactivate' | 'activate';
      lockMinutes?: number;
    }) =>
      adminApi.updateUserStatus(payload.userId, {
        action: payload.action,
        lockMinutes: payload.lockMinutes,
      }),
    onSuccess: () => {
      toast.success(t('admin.users.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.users.updateFailed'));
    },
  });

  const handleStatusAction = (
    row: AdminAppUserItem,
    action: 'lock' | 'unlock' | 'deactivate' | 'activate',
    lockMinutes?: number
  ) => {
    const actionKey = `${row.id}:${action}`;
    setPendingActionKey(actionKey);
    statusMutation.mutate(
      {
        userId: row.id,
        action,
        lockMinutes,
      },
      {
        onSettled: () => {
          setPendingActionKey('');
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h3 className="text-xl font-semibold">{t('admin.users.heading')}</h3>
        <p className="text-sm text-muted-foreground">{t('admin.users.subtitle')}</p>
      </div>

      {usersQuery.error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {t('admin.users.loadFailed')}
        </div>
      )}

      {!canWriteUsers && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4" />
          {t('admin.users.writeDenied')}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Input
            aria-label={t('admin.users.search')}
            autoComplete="off"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t('admin.users.search')}
          />

          {usersQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.users.email')}</TableHead>
                  <TableHead>{t('admin.users.nickname')}</TableHead>
                  <TableHead>{t('admin.users.active')}</TableHead>
                  <TableHead>{t('admin.users.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usersQuery.data?.items || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  (usersQuery.data?.items || []).map((row) => {
                    const isLocked = isUserCurrentlyLocked(row.locked_until ?? null);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.nickname}</TableCell>
                        <TableCell>
                          {row.is_active ? t('admin.users.activeYes') : t('admin.users.activeNo')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUserId(row.id)}
                            >
                              {t('admin.users.detail')}
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    !canWriteUsers ||
                                    pendingActionKey === `${row.id}:${isLocked ? 'unlock' : 'lock'}`
                                  }
                                >
                                  {pendingActionKey === `${row.id}:${isLocked ? 'unlock' : 'lock'}` && (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  )}
                                  {isLocked ? t('admin.users.unlock') : t('admin.users.lock30m')}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {isLocked
                                      ? t('admin.users.confirmUnlock')
                                      : t('admin.users.confirmLock30m')}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('admin.users.auditHint')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleStatusAction(row, isLocked ? 'unlock' : 'lock', 30)
                                    }
                                  >
                                    {t('common.confirm')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    !canWriteUsers ||
                                    pendingActionKey ===
                                      `${row.id}:${row.is_active ? 'deactivate' : 'activate'}`
                                  }
                                >
                                  {pendingActionKey ===
                                    `${row.id}:${row.is_active ? 'deactivate' : 'activate'}` && (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  )}
                                  {row.is_active
                                    ? t('admin.users.deactivate')
                                    : t('admin.users.activate')}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {row.is_active
                                      ? t('admin.users.confirmDeactivate')
                                      : t('admin.users.confirmActivate')}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('admin.users.auditHint')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleStatusAction(
                                        row,
                                        row.is_active ? 'deactivate' : 'activate'
                                      )
                                    }
                                  >
                                    {t('common.confirm')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={selectedUserId.length > 0} onOpenChange={(open: boolean) => { if (!open) setSelectedUserId(''); }}>
        <SheetContent side="right" className="w-[540px] sm:max-w-[540px]">
          <SheetHeader>
            <SheetTitle>{t('admin.users.detail')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {detailQuery.isLoading && (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            )}
            {detailQuery.error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {t('admin.users.detailLoadFailed')}
              </div>
            )}
            {!detailQuery.isLoading && !detailQuery.error && !hasUserDetail && (
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            )}
            {!detailQuery.isLoading && !detailQuery.error && hasUserDetail && (
              <pre className="text-sm whitespace-pre-wrap break-all">
                {JSON.stringify(detailQuery.data?.user, null, 2)}
              </pre>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
