import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import type {
  ContextSourceKind,
  ContextUsageReceipt,
} from '@emorapy/contracts/chat';

import { getLocale, t } from '@/src/i18n';
import { useIdentityQueryScope } from '@/src/providers/identityQueryScope';
import { FeatureRow, Panel, StatusPill } from '@/src/ui/components';
import { m3Api } from './api';
import { chatQueryKeys } from './chatQueryKeys';

type ChatContextUsageReceiptsProps = {
  enabled: boolean;
  roomId: string;
};

const sourceKinds: ContextSourceKind[] = [
  'chat_message',
  'context_capsule',
  'personal_memory',
  'joint_memory',
  'formal_evidence',
];

function formatReceiptTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('chatRoom.contextUsage.timeUnavailable');
  return new Intl.DateTimeFormat(getLocale() === 'en-US' ? 'en-US' : 'zh-Hant', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function formatSourceCounts(receipt: ContextUsageReceipt): string {
  const visibleCounts = sourceKinds.flatMap((kind) => {
    const count = receipt.source_type_counts[kind];
    if (count <= 0) return [];
    return [t(`chatRoom.contextUsage.source.${kind}`, { count })];
  });
  return visibleCounts.length > 0
    ? visibleCounts.join(' · ')
    : t('chatRoom.contextUsage.source.none');
}

export function ChatContextUsageReceipts({
  enabled,
  roomId,
}: ChatContextUsageReceiptsProps) {
  const identityScope = useIdentityQueryScope();
  const query = useQuery({
    queryKey: chatQueryKeys.contextUsageReceipts(identityScope.epoch, roomId),
    queryFn: () => m3Api.chat.listContextUsageReceipts(roomId),
    enabled: enabled
      && identityScope.privateDataEnabled
      && !identityScope.transitioning,
  });
  const receipts = query.data?.slice(0, 12) ?? [];

  return (
    <Panel title={t('chatRoom.contextUsage.panel')}>
      <FeatureRow
        title={t('chatRoom.contextUsage.title')}
        detail={t('chatRoom.contextUsage.detail')}
        tone="blue"
      />
      {query.isPending ? (
        <StatusPill label={t('chatRoom.contextUsage.loading')} tone="blue" />
      ) : null}
      {query.error ? (
        <FeatureRow
          title={t('chatRoom.contextUsage.error')}
          detail={t('chatRoom.contextUsage.error.detail')}
          tone="coral"
        />
      ) : null}
      {!query.isPending && !query.error && receipts.length === 0 ? (
        <FeatureRow
          title={t('chatRoom.contextUsage.empty')}
          detail={t('chatRoom.contextUsage.empty.detail')}
          tone="neutral"
        />
      ) : null}
      {receipts.map((receipt, index) => (
        <View key={`${receipt.created_at}:${index}`} testID={`chat.room.context-usage.receipt.${index}`}>
          <FeatureRow
            title={t(`chatRoom.contextUsage.category.${receipt.category}`)}
            detail={t('chatRoom.contextUsage.receiptDetail', {
              decision: t(`chatRoom.contextUsage.decision.${receipt.decision}`),
              purpose: t(`chatRoom.contextUsage.purpose.${receipt.purpose}`),
              time: formatReceiptTime(receipt.created_at),
            })}
            tone={receipt.decision === 'allowed' ? 'teal' : 'neutral'}
          />
          <FeatureRow
            title={t('chatRoom.contextUsage.sources')}
            detail={t('chatRoom.contextUsage.sourcesDetail', {
              authorizations: receipt.authorization_count,
              sources: formatSourceCounts(receipt),
            })}
            tone="blue"
          />
        </View>
      ))}
    </Panel>
  );
}
