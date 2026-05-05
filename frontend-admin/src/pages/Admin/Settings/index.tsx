import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminMe } from '@/hooks/useAdminMe';
import { adminApi } from '@/services/api/admin';
import type {
  AdminAdminUserItem,
  AdminMediaProviderCatalogItem,
  AdminMediaProviderTestInput,
  AdminMediaProviderTestResult,
} from '@/types/admin';
import { t } from '@/utils/i18n';
import JsonConfigCard from './JsonConfigCard';
import MediaProviderSettingsCard from './MediaProviderSettingsCard';
import type { AdminUserFormValues, MediaProviderFormValues } from './types';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [editingAdmin, setEditingAdmin] = useState<AdminAdminUserItem | null>(null);
  const [pendingAdminActionKey, setPendingAdminActionKey] = useState('');

  // Admin edit dialog form state
  const [editFormName, setEditFormName] = useState('');
  const [editFormRoleKey, setEditFormRoleKey] = useState<'super_admin' | 'ops' | 'marketing' | 'support'>('ops');
  const [editFormIsActive, setEditFormIsActive] = useState(true);
  const [editFormPassword, setEditFormPassword] = useState('');

  // Create admin form state
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRoleKey, setCreateRoleKey] = useState<'super_admin' | 'ops' | 'marketing' | 'support'>('ops');

  // JSON config state
  const [alertRulesValue, setAlertRulesValue] = useState('');
  const [featureFlagsValue, setFeatureFlagsValue] = useState('');

  // Media provider form state
  const [mediaProviderFormValues, setMediaProviderFormValues] = useState<MediaProviderFormValues>({});
  const [selectedMediaProviderKey, setSelectedMediaProviderKey] = useState('');
  const [mediaProviderTestResult, setMediaProviderTestResult] =
    useState<AdminMediaProviderTestResult | null>(null);

  const adminUsersQuery = useQuery({
    queryKey: ['admin', 'admin-users'],
    queryFn: () => adminApi.listAdminUsers({ limit: 100, offset: 0 }),
  });
  const configsQuery = useQuery({
    queryKey: ['admin', 'configs', 'settings'],
    queryFn: () => adminApi.listConfigs({ limit: 100, offset: 0 }),
  });
  const mediaProvidersQuery = useQuery({
    queryKey: ['admin', 'media-providers'],
    queryFn: () => adminApi.listMediaProviders(),
  });
  const adminMeQuery = useAdminMe(true);
  const currentAdminId = adminMeQuery.data?.admin.id || '';

  const mediaProviderCatalog: AdminMediaProviderCatalogItem[] =
    mediaProvidersQuery.data?.items || [];
  const selectedMediaProvider = useMemo(
    () => mediaProviderCatalog.find((provider) => provider.providerKey === selectedMediaProviderKey),
    [mediaProviderCatalog, selectedMediaProviderKey]
  );

  useEffect(() => {
    if (!selectedMediaProviderKey && mediaProviderCatalog.length > 0) {
      setSelectedMediaProviderKey(mediaProviderCatalog[0].providerKey);
      return;
    }
    if (selectedMediaProviderKey && !mediaProviderCatalog.some((provider) => provider.providerKey === selectedMediaProviderKey)) {
      setSelectedMediaProviderKey(mediaProviderCatalog[0]?.providerKey || '');
    }
  }, [mediaProviderCatalog, selectedMediaProviderKey]);

  const mediaConfigItems = useMemo(
    () => configsQuery.data?.items || [],
    [configsQuery.data]
  );

  const getMediaProviderConfigValue = useCallback((providerKey: string): Record<string, unknown> | undefined => {
    const configItem = mediaConfigItems.find((item) => item.key === `media.provider.${providerKey}`);
    if (!configItem || typeof configItem.value !== 'object' || configItem.value === null || Array.isArray(configItem.value)) {
      return undefined;
    }
    return configItem.value as Record<string, unknown>;
  }, [mediaConfigItems]);

  useEffect(() => {
    if (!selectedMediaProvider?.providerType) return;
    const providerConfig = getMediaProviderConfigValue(selectedMediaProvider.providerKey) || {};
    setMediaProviderFormValues({
      providerKey: selectedMediaProvider.providerKey,
      apiKey: '',
      baseUrl:
        (typeof providerConfig.baseUrl === 'string' && providerConfig.baseUrl)
        || (typeof providerConfig.base_url === 'string' && providerConfig.base_url)
        || selectedMediaProvider.defaultBaseUrl
        || undefined,
      timeoutMs:
        typeof providerConfig.timeoutMs === 'number'
          ? providerConfig.timeoutMs
          : typeof providerConfig.timeout_ms === 'number'
            ? providerConfig.timeout_ms
            : 12000,
      model:
        typeof providerConfig.model === 'string' && providerConfig.model
          ? providerConfig.model
          : selectedMediaProvider.defaultModel,
      sourceImageUrl:
        typeof providerConfig.sourceImageUrl === 'string'
          ? providerConfig.sourceImageUrl
          : '',
      count:
        selectedMediaProvider.providerType === 'image'
          ? typeof providerConfig.count === 'number' && providerConfig.count > 0
            ? providerConfig.count
            : 1
          : undefined,
      durationSeconds:
        selectedMediaProvider.providerType === 'video'
          ? typeof providerConfig.durationSeconds === 'number' && providerConfig.durationSeconds > 0
            ? providerConfig.durationSeconds
            : 5
          : undefined,
      prompt:
        selectedMediaProvider.providerType === 'image'
          ? 'A calm neutral composition'
          : 'A cinematic short clip',
    });
  }, [selectedMediaProvider, getMediaProviderConfigValue]);

  useEffect(() => {
    const items = configsQuery.data?.items || [];
    const alertRuleConfig = items.find((item) => item.key === 'admin.alert.rules');
    const featureFlagsConfig = items.find((item) => item.key === 'feature.flags');
    setAlertRulesValue(JSON.stringify(alertRuleConfig?.value || [], null, 2));
    setFeatureFlagsValue(JSON.stringify(featureFlagsConfig?.value || {}, null, 2));
  }, [configsQuery.data]);

  const createAdminUserMutation = useMutation({
    mutationFn: (values: AdminUserFormValues) => adminApi.createAdminUser(values),
    onSuccess: () => {
      toast.success(t('admin.settings.adminUsers.createSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'admin-users'] });
      setCreateEmail('');
      setCreateName('');
      setCreatePassword('');
      setCreateRoleKey('ops');
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.settings.adminUsers.createFailed'));
    },
  });

  const updateAdminUserMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      name?: string;
      roleKey?: 'super_admin' | 'ops' | 'marketing' | 'support';
      isActive?: boolean;
      password?: string;
    }) =>
      adminApi.updateAdminUser(payload.id, {
        name: payload.name,
        roleKey: payload.roleKey,
        isActive: payload.isActive,
        password: payload.password,
      }),
    onSuccess: () => {
      toast.success(t('admin.settings.adminUsers.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'admin-users'] });
      setEditingAdmin(null);
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.settings.adminUsers.updateFailed'));
    },
  });
  const deleteAdminUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteAdminUser(id),
    onSuccess: () => {
      toast.success(t('admin.settings.adminUsers.deleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'admin-users'] });
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.settings.adminUsers.deleteFailed'));
    },
  });

  const alertRulesMutation = useMutation({
    mutationFn: (rules: unknown[]) => adminApi.upsertAlertRules(rules),
    onSuccess: () => toast.success(t('admin.settings.alerts.saveSuccess')),
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.settings.alerts.saveFailed'));
    },
  });
  const featureFlagsMutation = useMutation({
    mutationFn: (flags: Record<string, unknown>) => adminApi.setFeatureFlags(flags),
    onSuccess: () => toast.success(t('admin.settings.flags.saveSuccess')),
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.settings.flags.saveFailed'));
    },
  });

  const mediaProviderSaveMutation = useMutation({
    mutationFn: ({
      providerKey,
      value,
    }: {
      providerKey: string;
      value: Record<string, unknown>;
    }) => adminApi.upsertConfig({
      key: `media.provider.${providerKey}`,
      value,
      isRuntime: true,
      isSensitive: true,
    }),
    onSuccess: () => {
      toast.success(t('admin.settings.mediaProviders.saveSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'configs', 'settings'] });
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.settings.mediaProviders.saveFailed'));
    },
  });

  const mediaProviderTestMutation = useMutation({
    mutationFn: ({
      providerKey,
      payload,
    }: {
      providerKey: string;
      payload: AdminMediaProviderTestInput;
    }) => adminApi.testMediaProvider(providerKey, payload),
    onSuccess: (result) => {
      setMediaProviderTestResult(result);
      toast.success(t('admin.settings.mediaProviders.testSuccess'));
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      setMediaProviderTestResult(null);
      if (err?.code === 'FORBIDDEN') {
        toast.error(t('admin.ops.accessDenied'));
        return;
      }
      toast.error(t('admin.settings.mediaProviders.testFailed'));
    },
  });

  const handleSaveMediaProvider = () => {
    if (!selectedMediaProvider) return;
    const values = mediaProviderFormValues;
    const currentConfig = getMediaProviderConfigValue(selectedMediaProvider.providerKey) || {};
    const updatedConfig: Record<string, unknown> = { ...currentConfig };
    if (typeof values.apiKey === 'string' && values.apiKey.trim()) {
      updatedConfig.apiKey = values.apiKey.trim();
    }
    if (typeof values.baseUrl === 'string' && values.baseUrl.trim()) {
      updatedConfig.baseUrl = values.baseUrl.trim();
    }
    if (typeof values.timeoutMs === 'number' && Number.isFinite(values.timeoutMs)) {
      updatedConfig.timeoutMs = values.timeoutMs;
    }
    if (typeof values.model === 'string' && values.model.trim()) {
      updatedConfig.model = values.model.trim();
    }
    if (
      selectedMediaProvider.providerType === 'video'
      && typeof values.sourceImageUrl === 'string'
      && values.sourceImageUrl.trim()
    ) {
      updatedConfig.sourceImageUrl = values.sourceImageUrl.trim();
    }
    if (!updatedConfig.apiKey && !currentConfig.apiKey) {
      toast.error(t('admin.settings.mediaProviders.apiKeyRequired'));
      return;
    }

    mediaProviderSaveMutation.mutate({
      providerKey: selectedMediaProvider.providerKey,
      value: updatedConfig,
    });
  };

  const handleTestMediaProvider = () => {
    if (!selectedMediaProvider) return;
    const values = mediaProviderFormValues;
    const payload: AdminMediaProviderTestInput = {
      apiKey:
        typeof values.apiKey === 'string' && values.apiKey.trim()
          ? values.apiKey.trim()
          : undefined,
      baseUrl:
        typeof values.baseUrl === 'string' && values.baseUrl.trim()
          ? values.baseUrl.trim()
          : undefined,
      timeoutMs:
        typeof values.timeoutMs === 'number' && Number.isFinite(values.timeoutMs)
          ? values.timeoutMs
          : undefined,
      model:
        typeof values.model === 'string' && values.model.trim()
          ? values.model.trim()
          : undefined,
      prompt:
        typeof values.prompt === 'string' && values.prompt.trim()
          ? values.prompt.trim()
          : undefined,
    };

    if (selectedMediaProvider.providerType === 'image') {
      if (typeof values.count === 'number' && Number.isFinite(values.count)) {
        payload.count = Math.max(1, Math.floor(values.count));
      }
    } else if (selectedMediaProvider.providerType === 'video') {
      if (typeof values.durationSeconds === 'number' && Number.isFinite(values.durationSeconds)) {
        payload.durationSeconds = Math.max(1, Math.floor(values.durationSeconds));
      }
      if (typeof values.sourceImageUrl === 'string' && values.sourceImageUrl.trim()) {
        payload.sourceImageUrl = values.sourceImageUrl.trim();
      }
    }

    mediaProviderTestMutation.mutate({
      providerKey: selectedMediaProvider.providerKey,
      payload,
    });
  };

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.trim()) {
      toast.error(t('admin.settings.adminUsers.emailRequired'));
      return;
    }
    if (!createName.trim()) return;
    if (!createPassword || createPassword.length < 10) {
      toast.error(t('admin.settings.adminUsers.passwordMinLength'));
      return;
    }
    createAdminUserMutation.mutate({
      email: createEmail.trim(),
      name: createName.trim(),
      password: createPassword,
      roleKey: createRoleKey,
    });
  };

  const handleEditSave = () => {
    if (!editingAdmin) return;
    if (!editFormName.trim()) {
      toast.error(t('admin.settings.adminUsers.nameRequired'));
      return;
    }
    if (editFormPassword.trim() && editFormPassword.length < 10) {
      toast.error(t('admin.settings.adminUsers.passwordMinLength'));
      return;
    }
    updateAdminUserMutation.mutate({
      id: editingAdmin.id,
      name: editFormName,
      roleKey: editFormRoleKey,
      isActive: editFormIsActive,
      password: editFormPassword?.trim() ? editFormPassword : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold">
          {t('admin.settings.heading')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('admin.settings.subtitle')}</p>
      </div>

      {(adminUsersQuery.error || configsQuery.error) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <span>{t('admin.settings.loadFailed')}</span>
        </div>
      )}

      <MediaProviderSettingsCard
        formValues={mediaProviderFormValues}
        onFormChange={(partial) =>
          setMediaProviderFormValues((prev) => ({ ...prev, ...partial }))
        }
        catalog={mediaProviderCatalog}
        selectedProvider={selectedMediaProvider}
        selectedProviderKey={selectedMediaProviderKey}
        testResult={mediaProviderTestResult}
        saveLoading={mediaProviderSaveMutation.isPending}
        testLoading={mediaProviderTestMutation.isPending}
        onProviderChange={(value) => {
          setSelectedMediaProviderKey(value);
          setMediaProviderTestResult(null);
        }}
        onSave={handleSaveMediaProvider}
        onTest={handleTestMediaProvider}
        getConfigValue={getMediaProviderConfigValue}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.settings.adminUsers.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateAdmin} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>{t('admin.settings.adminUsers.email')}</Label>
              <Input
                type="email"
                placeholder={t('admin.settings.adminUsers.email')}
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('admin.settings.adminUsers.name')}</Label>
              <Input
                placeholder={t('admin.settings.adminUsers.name')}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('admin.settings.adminUsers.password')}</Label>
              <Input
                type="password"
                placeholder={t('admin.settings.adminUsers.password')}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                minLength={10}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('admin.settings.adminUsers.role')}</Label>
              <Select
                value={createRoleKey}
                onValueChange={(v: string) => setCreateRoleKey(v as typeof createRoleKey)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">super_admin</SelectItem>
                  <SelectItem value="ops">ops</SelectItem>
                  <SelectItem value="marketing">marketing</SelectItem>
                  <SelectItem value="support">support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={createAdminUserMutation.isPending}
            >
              {createAdminUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('admin.settings.adminUsers.create')}
            </Button>
          </form>

          {adminUsersQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.settings.adminUsers.email')}</TableHead>
                  <TableHead>{t('admin.settings.adminUsers.name')}</TableHead>
                  <TableHead>{t('admin.settings.adminUsers.role')}</TableHead>
                  <TableHead>{t('admin.settings.adminUsers.active')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(adminUsersQuery.data?.items || []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.role.key}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button type="button" className="inline-flex items-center">
                              <Switch
                                checked={row.is_active}
                                disabled={pendingAdminActionKey === `${row.id}:toggle`}
                              />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {row.is_active
                                  ? t('admin.settings.adminUsers.confirmDeactivate')
                                  : t('admin.settings.adminUsers.confirmActivate')}
                              </AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  setPendingAdminActionKey(`${row.id}:toggle`);
                                  updateAdminUserMutation.mutate(
                                    { id: row.id, isActive: !row.is_active },
                                    { onSettled: () => setPendingAdminActionKey('') }
                                  );
                                }}
                              >
                                {t('common.confirm')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingAdmin(row);
                            setEditFormName(row.name);
                            setEditFormRoleKey(row.role.key as typeof editFormRoleKey);
                            setEditFormIsActive(row.is_active);
                            setEditFormPassword('');
                          }}
                        >
                          {t('admin.settings.adminUsers.edit')}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={row.id === currentAdminId || pendingAdminActionKey === `${row.id}:delete`}
                            >
                              {pendingAdminActionKey === `${row.id}:delete` && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              )}
                              {t('admin.settings.adminUsers.delete')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t('admin.settings.adminUsers.confirmDelete')}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('admin.settings.adminUsers.deleteAuditHint')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  setPendingAdminActionKey(`${row.id}:delete`);
                                  deleteAdminUserMutation.mutate(row.id, {
                                    onSettled: () => setPendingAdminActionKey(''),
                                  });
                                }}
                              >
                                {t('common.confirm')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <JsonConfigCard
        title={t('admin.settings.alerts.title')}
        subtitle={t('admin.settings.alerts.subtitle')}
        fieldName="rules"
        requiredMessage={t('admin.settings.alerts.rulesJsonArrayRequired')}
        placeholder='[{"key":"jobs.failure_rate","threshold":0.2}]'
        loading={alertRulesMutation.isPending}
        valueKind="array"
        saveLabel={t('admin.settings.alerts.save')}
        onSave={(value) => alertRulesMutation.mutate(value as unknown[])}
        initialValue={alertRulesValue}
      />

      <JsonConfigCard
        title={t('admin.settings.flags.title')}
        subtitle={t('admin.settings.flags.subtitle')}
        fieldName="flags"
        requiredMessage={t('admin.settings.flags.flagsJsonObjectRequired')}
        placeholder='{"adminOpsBeta": true}'
        loading={featureFlagsMutation.isPending}
        valueKind="object"
        saveLabel={t('admin.settings.flags.save')}
        onSave={(value) => featureFlagsMutation.mutate(value as Record<string, unknown>)}
        initialValue={featureFlagsValue}
      />

      <Dialog open={editingAdmin !== null} onOpenChange={(open: boolean) => { if (!open) setEditingAdmin(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.settings.adminUsers.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('admin.settings.adminUsers.nameLabel')}</Label>
              <Input
                value={editFormName}
                onChange={(e) => setEditFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.settings.adminUsers.roleLabel')}</Label>
              <Select
                value={editFormRoleKey}
                onValueChange={(v: string) => setEditFormRoleKey(v as typeof editFormRoleKey)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">super_admin</SelectItem>
                  <SelectItem value="ops">ops</SelectItem>
                  <SelectItem value="marketing">marketing</SelectItem>
                  <SelectItem value="support">support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label>{t('admin.settings.adminUsers.activeLabel')}</Label>
              <Switch
                checked={editFormIsActive}
                onCheckedChange={setEditFormIsActive}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.settings.adminUsers.resetPasswordLabel')}</Label>
              <Input
                type="password"
                value={editFormPassword}
                onChange={(e) => setEditFormPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAdmin(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updateAdminUserMutation.isPending}
            >
              {updateAdminUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
