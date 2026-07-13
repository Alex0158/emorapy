import { History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  ContextUsageReceipt,
  ContextUsageReceiptCategory,
  ContextUsageSourceTypeCounts,
} from '@/types/chat';
import { getLocale, t } from '@/utils/i18n';

interface ChatContextUsageReceiptsProps {
  error: boolean;
  loading: boolean;
  receipts: ContextUsageReceipt[];
  onRefresh: () => void;
}

const categoryKeys: Record<ContextUsageReceiptCategory, string> = {
  capsule_lifecycle: 'chat.receipt.category.capsuleLifecycle',
  authorization: 'chat.receipt.category.authorization',
  analysis_request: 'chat.receipt.category.analysisRequest',
  analysis_consent: 'chat.receipt.category.analysisConsent',
  adaptation_consent: 'chat.receipt.category.adaptationConsent',
  private_support_use: 'chat.receipt.category.privateSupport',
  shared_mediation_use: 'chat.receipt.category.sharedMediation',
  adaptation_use: 'chat.receipt.category.adaptationUse',
  adaptation_readiness: 'chat.receipt.category.adaptationReadiness',
};

const sourceKeys: Record<keyof ContextUsageSourceTypeCounts, string> = {
  chat_message: 'chat.receipt.source.chatMessage',
  context_capsule: 'chat.receipt.source.contextCapsule',
  personal_memory: 'chat.receipt.source.personalMemory',
  joint_memory: 'chat.receipt.source.jointMemory',
  formal_evidence: 'chat.receipt.source.formalEvidence',
};

function describeSources(receipt: ContextUsageReceipt): string {
  const parts = (Object.entries(receipt.source_type_counts) as Array<[
    keyof ContextUsageSourceTypeCounts,
    number,
  ]>)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => t(sourceKeys[kind], { count }));
  if (receipt.authorization_count > 0) {
    parts.push(t('chat.receipt.authorizationCount', { count: receipt.authorization_count }));
  }
  return parts.length > 0 ? parts.join(' · ') : t('chat.receipt.noSourceDetails');
}

function formatReceiptTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('chat.receipt.timeUnavailable');
  return new Intl.DateTimeFormat(getLocale() === 'en-US' ? 'en-US' : 'zh-Hant', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function ChatContextUsageReceipts({
  error,
  loading,
  receipts,
  onRefresh,
}: ChatContextUsageReceiptsProps) {
  return (
    <details className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-foreground">
        <History className="size-4 text-primary" aria-hidden="true" />
        <span>{t('chat.receipt.title')}</span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {t('chat.receipt.description')}
      </p>
      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
        ) : receipts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t(error ? 'chat.receipt.loadError' : 'chat.receipt.empty')}
          </p>
        ) : receipts.slice(0, 8).map((receipt, index) => (
          <article
            key={`${receipt.created_at}:${receipt.category}:${index}`}
            className="rounded-lg border border-border/55 bg-muted/20 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">{t(categoryKeys[receipt.category])}</p>
              <span className="text-[11px] text-muted-foreground">
                {formatReceiptTime(receipt.created_at)}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t(receipt.scope === 'actor'
                ? 'chat.receipt.scopeActor'
                : 'chat.receipt.scopeRoom')}
              {' · '}
              {t(receipt.decision === 'allowed'
                ? 'chat.receipt.allowed'
                : 'chat.receipt.denied')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {describeSources(receipt)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              {t('chat.receipt.policyVersion', { version: receipt.policy_version })}
            </p>
          </article>
        ))}
      </div>
      <Button type="button" size="sm" variant="ghost" className="mt-2" disabled={loading} onClick={onRefresh}>
        <RefreshCw className="size-3.5" aria-hidden="true" />
        {t('chat.receipt.refresh')}
      </Button>
    </details>
  );
}
