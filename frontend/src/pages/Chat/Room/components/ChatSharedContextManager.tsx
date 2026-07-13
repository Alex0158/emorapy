import { Loader2, ShieldX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ContextAuthorization, ContextCapsuleListItem } from '@/types/chat';
import { t } from '@/utils/i18n';

interface ChatSharedContextManagerProps {
  capsules: ContextCapsuleListItem[];
  workingAuthorizationId: string | null;
  onRevokeAuthorization: (authorizationId: string) => void;
}

function isManagedAuthorization(
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
  workingAuthorizationId,
  onRevokeAuthorization,
}: ChatSharedContextManagerProps) {
  const now = Date.now();
  const managed = capsules
    .map((capsule) => ({
      capsule,
      authorizations: capsule.authorizations.filter((authorization) => (
        isManagedAuthorization(authorization, capsule, now)
      )),
    }))
    .filter((item) => item.authorizations.length > 0);

  if (managed.length === 0) return null;

  return (
    <section
      aria-labelledby="chat-shared-context-manager-heading"
      className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3"
    >
      <div className="flex items-start gap-2">
        <ShieldX className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
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
        {managed.map(({ capsule, authorizations }) => (
          <article key={capsule.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-sm leading-relaxed text-foreground/90">{capsule.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
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
                      disabled={Boolean(workingAuthorizationId)}
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
          </article>
        ))}
      </div>
    </section>
  );
}
