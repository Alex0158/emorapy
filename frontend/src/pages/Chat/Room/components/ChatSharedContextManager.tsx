import { useState } from 'react';
import { FilePenLine, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ContextAuthorization, ContextCapsuleListItem } from '@/types/chat';
import { t } from '@/utils/i18n';
import type { ChatCapsuleGrantPurpose } from '../hooks/useChatCapsuleLifecycle';

interface ChatSharedContextManagerProps {
  capsules: ContextCapsuleListItem[];
  formalActionsBlocked: boolean;
  workingActionKey: string | null;
  workingAuthorizationId: string | null;
  onDiscard: (capsule: ContextCapsuleListItem) => void;
  onGrant: (capsule: ContextCapsuleListItem, purpose: ChatCapsuleGrantPurpose) => void;
  onRevokeAuthorization: (authorizationId: string) => void;
  onRevise: (capsule: ContextCapsuleListItem, summary: string) => void;
}

function isActiveAuthorization(
  authorization: ContextAuthorization,
  capsule: ContextCapsuleListItem,
  now: number,
): boolean {
  return (
    capsule.status === 'approved'
    && capsule.revoked_at == null
    && capsule.expires_at != null
    && new Date(capsule.expires_at).getTime() > now
    && authorization.revoked_at == null
    && authorization.expires_at != null
    && new Date(authorization.expires_at).getTime() > now
    && authorization.capsule_id === capsule.id
    && authorization.subject_participant_id === capsule.owner_participant_id
    && authorization.target_type === 'chat_room'
    && authorization.target_id === capsule.room_id
    && authorization.capsule_content_hash === capsule.content_hash
    && authorization.policy_version === capsule.policy_version
    && (
      (
        authorization.purpose === 'shared_mediation'
        && authorization.audience === 'room_participants'
      )
      || (
        authorization.purpose === 'formal_analysis_evidence'
        && authorization.audience === 'analysis_participants'
      )
    )
  );
}

export default function ChatSharedContextManager({
  capsules,
  formalActionsBlocked,
  workingActionKey,
  workingAuthorizationId,
  onDiscard,
  onGrant,
  onRevokeAuthorization,
  onRevise,
}: ChatSharedContextManagerProps) {
  const [editingCapsuleId, setEditingCapsuleId] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState('');
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);
  const now = Date.now();
  const manageable = capsules
    .filter((capsule) => (
      (capsule.status === 'draft' || capsule.status === 'approved')
      && capsule.revoked_at == null
      && capsule.expires_at != null
      && new Date(capsule.expires_at).getTime() > now
    ))
    .map((capsule) => ({
      capsule,
      authorizations: capsule.authorizations.filter((authorization) => (
        isActiveAuthorization(authorization, capsule, now)
      )),
    }));

  if (manageable.length === 0) return null;

  const busy = Boolean(workingActionKey || workingAuthorizationId);

  return (
    <section
      aria-labelledby="chat-shared-context-manager-heading"
      className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h3 id="chat-shared-context-manager-heading" className="text-xs font-semibold text-foreground">
            {t('chat.capsule.manageTitle')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('chat.capsule.manageDescription')}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {manageable.map(({ capsule, authorizations }) => {
          const hasSharedGrant = authorizations.some((authorization) => (
            authorization.purpose === 'shared_mediation'
          ));
          const hasFormalGrant = authorizations.some((authorization) => (
            authorization.purpose === 'formal_analysis_evidence'
          ));
          const editing = editingCapsuleId === capsule.id;
          const confirmingDiscard = confirmDiscardId === capsule.id;
          return (
          <article key={capsule.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={capsule.status === 'draft' ? 'outline' : 'secondary'}>
                {t(capsule.status === 'draft'
                  ? 'chat.capsule.statusDraft'
                  : 'chat.capsule.statusApproved')}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t('chat.capsule.version', { version: capsule.version })}
              </span>
            </div>
            {editing ? (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-semibold text-foreground" htmlFor={`capsule-summary-${capsule.id}`}>
                  {t('chat.capsule.summaryLabel')}
                </label>
                <textarea
                  id={`capsule-summary-${capsule.id}`}
                  aria-label={t('chat.capsule.summaryLabel')}
                  autoComplete="off"
                  value={editedSummary}
                  maxLength={2000}
                  onChange={(event) => setEditedSummary(event.target.value)}
                  className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !editedSummary.trim() || editedSummary.trim() === capsule.summary}
                    onClick={() => onRevise(capsule, editedSummary)}
                  >
                    {workingActionKey === `revise:${capsule.id}` && (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    )}
                    {t('chat.capsule.saveRevision')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditingCapsuleId(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{capsule.summary}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!hasSharedGrant && (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => onGrant(capsule, 'shared_mediation')}
                >
                  {workingActionKey === `grant:shared_mediation:${capsule.id}` && (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  )}
                  {t(capsule.status === 'draft'
                    ? 'chat.capsule.approveShared'
                    : 'chat.capsule.reauthorizeShared')}
                </Button>
              )}
              {!hasFormalGrant && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || formalActionsBlocked}
                  onClick={() => onGrant(capsule, 'formal_analysis_evidence')}
                >
                  {workingActionKey === `grant:formal_analysis_evidence:${capsule.id}` && (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  )}
                  {t('chat.capsule.approveFormal')}
                </Button>
              )}
              {authorizations.map((authorization) => {
                const working = workingAuthorizationId === authorization.id;
                const formal = authorization.purpose === 'formal_analysis_evidence';
                return (
                  <div key={authorization.id} className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {t(formal
                        ? 'chat.capsule.authorizationFormal'
                        : 'chat.capsule.authorizationShared')}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onRevokeAuthorization(authorization.id)}
                    >
                      {working && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                      {t(formal
                        ? 'chat.capsule.revokeFormal'
                        : 'chat.capsule.revokeShared')}
                    </Button>
                  </div>
                );
              })}
            </div>
            {!editing && !confirmingDiscard && (
              <div className="mt-2 flex flex-wrap gap-2 border-t border-border/50 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setEditingCapsuleId(capsule.id);
                    setEditedSummary(capsule.summary);
                    setConfirmDiscardId(null);
                  }}
                >
                  <FilePenLine className="size-3.5" aria-hidden="true" />
                  {t('chat.capsule.edit')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmDiscardId(capsule.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t('chat.capsule.discard')}
                </Button>
              </div>
            )}
            {confirmingDiscard && (
              <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                <p className="text-xs leading-relaxed text-foreground">
                  {t('chat.capsule.discardDescription')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => onDiscard(capsule)}
                  >
                    {workingActionKey === `discard:${capsule.id}` && (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    )}
                    {t('chat.capsule.confirmDiscard')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDiscardId(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </article>
          );
        })}
      </div>
    </section>
  );
}
