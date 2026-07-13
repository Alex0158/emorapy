import {
  Check,
  ChevronRight,
  Circle,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ChatAnalysisRequestListItem } from '@/types/chat';
import { getLocale, t } from '@/utils/i18n';
import {
  getExactApproval,
  hasAllExactApprovals,
  hasExactAnalysisSourcePreviews,
} from '../hooks/useChatAnalysisConsent';

interface ChatAnalysisConsentPanelProps {
  requests: ChatAnalysisRequestListItem[];
  myParticipantId: string | null;
  workingRequestId: string | null;
  loading: boolean;
  error: string;
  getParticipantLabel: (participantId: string) => string;
  onRefresh: () => void;
  onDecision: (request: ChatAnalysisRequestListItem, decision: 'approved' | 'declined') => void;
  onRevokeApproval: (request: ChatAnalysisRequestListItem) => void;
  onSubmitAndStart: (request: ChatAnalysisRequestListItem) => void;
}

const ACTIONABLE_STATUSES = new Set(['pending_approval', 'approved']);

export default function ChatAnalysisConsentPanel({
  requests,
  myParticipantId,
  workingRequestId,
  loading,
  error,
  getParticipantLabel,
  onRefresh,
  onDecision,
  onRevokeApproval,
  onSubmitAndStart,
}: ChatAnalysisConsentPanelProps) {
  const locale = getLocale();
  if (requests.length === 0 && !error) return null;

  return (
    <section
      aria-labelledby="chat-analysis-consent-heading"
      className="overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(145deg,oklch(0.99_0.01_35),oklch(0.975_0.018_55))] shadow-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-primary/10 px-4 py-3">
        <div>
          <h2 id="chat-analysis-consent-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {t('chat.analysis.consentPanelTitle')}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('chat.analysis.consentPanelDescription')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('chat.analysis.refresh')}
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 border-b border-destructive/15 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          <span>{error}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      <div className="max-h-[34rem] space-y-3 overflow-y-auto p-3">
        {requests.map((request) => {
          const requestExpired = new Date(request.expires_at).getTime() <= Date.now();
          const effectiveStatus = requestExpired ? 'expired' : request.status;
          const ownApproval = getExactApproval(request, myParticipantId);
          const allApproved = hasAllExactApprovals(request);
          const isRequester = request.requested_by_participant_id === myParticipantId;
          const working = workingRequestId === request.id;
          const sourceSetComplete = hasExactAnalysisSourcePreviews(request);
          const canDecide = Boolean(
            myParticipantId
            && request.required_participant_ids.includes(myParticipantId)
            && ACTIONABLE_STATUSES.has(request.status)
            && !requestExpired
            && !ownApproval,
          );
          const canStart = isRequester && !requestExpired && sourceSetComplete && allApproved && (
            ACTIONABLE_STATUSES.has(request.status) || request.status === 'submitted'
          );
          const canRevokeApproval = ownApproval?.decision === 'approved'
            && ['pending_approval', 'approved', 'submitted'].includes(request.status)
            && !requestExpired;

          return (
            <article key={request.id} className="rounded-xl border border-border/80 bg-background/90 p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {t('chat.analysis.requestedBy', {
                        role: getParticipantLabel(request.requested_by_participant_id),
                      })}
                    </p>
                    <Badge variant={['cancelled', 'expired'].includes(effectiveStatus) ? 'outline' : 'secondary'}>
                      {t(`chat.analysis.status.${effectiveStatus}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t('chat.analysis.expiresAt', {
                      time: new Date(request.expires_at).toLocaleString(locale),
                    })}
                    {' · '}
                    {t('chat.analysis.selectionFingerprint', {
                      hash: request.selection_hash.slice(0, 8),
                    })}
                  </p>
                </div>
                {ownApproval?.decision === 'approved' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    <Check className="size-3.5" aria-hidden="true" />
                    {t('chat.analysis.youApproved')}
                  </span>
                )}
                {ownApproval?.decision === 'declined' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                    <X className="size-3.5" aria-hidden="true" />
                    {t('chat.analysis.youDeclined')}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {request.source_previews.messages.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t('chat.analysis.sharedMessagesTitle')}
                    </p>
                    <div className="mt-2 space-y-2">
                      {request.source_previews.messages.map((message) => (
                        <div key={message.id} className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
                          <p className="text-[11px] font-medium text-muted-foreground">
                            {t(`chat.role.${message.sender_role}`)} · {new Date(message.created_at).toLocaleString(locale)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                            {message.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {request.source_previews.capsules.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/80">
                      {t('chat.analysis.approvedPrivateSummariesTitle')}
                    </p>
                    <div className="mt-2 space-y-2">
                      {request.source_previews.capsules.map((capsule) => (
                        <div key={capsule.id} className="rounded-lg border border-primary/15 bg-primary/[0.035] px-3 py-2.5">
                          <p className="text-[11px] font-medium text-primary/80">
                            {t(`chat.role.${capsule.owner_role}`)} · {t('chat.analysis.approvedPrivateSummary')}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                            {capsule.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!sourceSetComplete && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                    {t('chat.analysis.sourceChangedWarning')}
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-border/60 pt-3">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {request.required_participant_ids.map((participantId) => {
                    const approval = getExactApproval(request, participantId);
                    const approved = approval?.decision === 'approved';
                    const declined = approval?.decision === 'declined';
                    return (
                      <span key={participantId} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        {approved ? (
                          <Check className="size-3.5 text-emerald-700" aria-hidden="true" />
                        ) : declined ? (
                          <X className="size-3.5 text-destructive" aria-hidden="true" />
                        ) : (
                          <Circle className="size-3.5" aria-hidden="true" />
                        )}
                        {getParticipantLabel(participantId)}：
                        {approved
                          ? t('chat.analysis.approvalApproved')
                          : declined
                            ? t('chat.analysis.approvalDeclined')
                            : t('chat.analysis.approvalPending')}
                      </span>
                    );
                  })}
                </div>

                {(canDecide || canStart || canRevokeApproval) && (
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {canRevokeApproval && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onRevokeApproval(request)}
                        disabled={working}
                      >
                        {working && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                        {t('chat.analysis.revokeMyApproval')}
                      </Button>
                    )}
                    {canDecide && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onDecision(request, 'declined')}
                          disabled={working}
                        >
                          {t('chat.analysis.declineExactSelection')}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => onDecision(request, 'approved')}
                          disabled={working || !sourceSetComplete}
                        >
                          {working && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                          {t('chat.analysis.approveExactSelection')}
                        </Button>
                      </>
                    )}
                    {canStart && (
                      <Button
                        type="button"
                        onClick={() => onSubmitAndStart(request)}
                        disabled={working}
                      >
                        {working ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : request.status === 'submitted' ? (
                          <RefreshCw className="size-4" aria-hidden="true" />
                        ) : (
                          <FileCheck2 className="size-4" aria-hidden="true" />
                        )}
                        {request.status === 'submitted'
                          ? t('chat.analysis.retryStart')
                          : t('chat.analysis.submitAndStart')}
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
