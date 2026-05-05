import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  AdminMediaProviderCatalogItem,
  AdminMediaProviderTestResult,
} from '@/types/admin';
import { t } from '@/utils/i18n';
import type { MediaProviderFormValues } from './types';

interface MediaProviderSettingsCardProps {
  formValues: MediaProviderFormValues;
  onFormChange: (values: Partial<MediaProviderFormValues>) => void;
  catalog: AdminMediaProviderCatalogItem[];
  selectedProvider?: AdminMediaProviderCatalogItem;
  selectedProviderKey: string;
  testResult: AdminMediaProviderTestResult | null;
  saveLoading: boolean;
  testLoading: boolean;
  onProviderChange: (providerKey: string) => void;
  onSave: () => void | Promise<void>;
  onTest: () => void | Promise<void>;
  getConfigValue: (providerKey: string) => Record<string, unknown> | undefined;
}

function renderCurrentProviderState(
  provider: AdminMediaProviderCatalogItem,
  getConfigValue: (providerKey: string) => Record<string, unknown> | undefined
) {
  const isConfigured = Boolean(getConfigValue(provider.providerKey)?.apiKey);
  return (
    <div className="space-y-1 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={provider.providerType === 'image' ? 'default' : 'secondary'}>
          {provider.providerType}
        </Badge>
        <span className="text-sm">{t('admin.settings.mediaProviders.defaultModel')}</span>
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
          {provider.defaultModel || '-'}
        </code>
        <span className="text-sm">
          {isConfigured
            ? t('admin.settings.mediaProviders.configured')
            : t('admin.settings.mediaProviders.notConfigured')}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{provider.description || ''}</p>
    </div>
  );
}

export default function MediaProviderSettingsCard({
  formValues,
  onFormChange,
  catalog,
  selectedProvider,
  selectedProviderKey,
  testResult,
  saveLoading,
  testLoading,
  onProviderChange,
  onSave,
  onTest,
  getConfigValue,
}: MediaProviderSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.settings.mediaProviders.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {t('admin.settings.mediaProviders.subtitle')}
        </p>

        <div className="space-y-2">
          <Label>{t('admin.settings.mediaProviders.provider')}</Label>
          <Select
            value={selectedProviderKey}
            onValueChange={onProviderChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('admin.settings.mediaProviders.selectProvider')} />
            </SelectTrigger>
            <SelectContent>
              {catalog.map((provider) => (
                <SelectItem key={provider.providerKey} value={provider.providerKey}>
                  {provider.displayName} ({provider.providerType})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProvider && (
          <>
            {renderCurrentProviderState(selectedProvider, getConfigValue)}

            <div className="space-y-2">
              <Label>
                {selectedProvider.secretLabel ||
                  t('admin.settings.mediaProviders.apiKey')}
              </Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={formValues.apiKey ?? ''}
                onChange={(e) => onFormChange({ apiKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.settings.mediaProviders.apiKeyHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('admin.settings.mediaProviders.baseUrl')}</Label>
              <Input
                placeholder={selectedProvider.defaultBaseUrl || ''}
                value={formValues.baseUrl ?? ''}
                onChange={(e) => onFormChange({ baseUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('admin.settings.mediaProviders.timeoutMs')}</Label>
              <Input
                type="number"
                min={500}
                max={120000}
                value={formValues.timeoutMs ?? ''}
                onChange={(e) => onFormChange({ timeoutMs: Number(e.target.value) || undefined })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('admin.settings.mediaProviders.model')}</Label>
              <Input
                placeholder={selectedProvider.defaultModel || ''}
                value={formValues.model ?? ''}
                onChange={(e) => onFormChange({ model: e.target.value })}
              />
            </div>

            {selectedProvider.providerType === 'video' && (
              <div className="space-y-2">
                <Label>{t('admin.settings.mediaProviders.sourceImage')}</Label>
                <Input
                  placeholder="https://your-domain.example/image.jpg"
                  value={formValues.sourceImageUrl ?? ''}
                  onChange={(e) => onFormChange({ sourceImageUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.settings.mediaProviders.sourceImageHelp')}
                </p>
              </div>
            )}

            {selectedProvider.providerType === 'image' ? (
              <div className="space-y-2">
                <Label>{t('admin.settings.mediaProviders.count')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={formValues.count ?? ''}
                  onChange={(e) => onFormChange({ count: Number(e.target.value) || undefined })}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t('admin.settings.mediaProviders.duration')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={formValues.durationSeconds ?? ''}
                  onChange={(e) => onFormChange({ durationSeconds: Number(e.target.value) || undefined })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('admin.settings.mediaProviders.prompt')}</Label>
              <Textarea
                rows={3}
                value={formValues.prompt ?? ''}
                onChange={(e) => onFormChange({ prompt: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.settings.mediaProviders.promptHelp')}
              </p>
            </div>

            <div className="flex gap-2">
              <Button disabled={saveLoading} onClick={onSave}>
                {saveLoading
                  ? `${t('admin.settings.mediaProviders.save')}...`
                  : t('admin.settings.mediaProviders.save')}
              </Button>
              <Button variant="outline" disabled={testLoading} onClick={onTest}>
                {testLoading
                  ? `${t('admin.settings.mediaProviders.test')}...`
                  : t('admin.settings.mediaProviders.test')}
              </Button>
            </div>
          </>
        )}

        {testResult && (
          <div className="space-y-3">
            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                testResult.success
                  ? 'border-green-500/50 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : 'border-destructive/50 bg-destructive/10 text-destructive'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <div>
                <p>{testResult.message}</p>
                <p className="text-xs mt-1">
                  {t('admin.settings.mediaProviders.latency')}: {testResult.latencyMs}ms
                </p>
              </div>
            </div>
            {testResult.detail !== undefined && (
              <pre
                className="rounded-md bg-muted p-3 text-xs max-h-[180px] overflow-auto"
                translate="no"
              >
                {JSON.stringify(testResult.detail, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
