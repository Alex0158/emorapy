import { useEffect, useState } from 'react';
import { Eye, LockKeyhole, Scale } from 'lucide-react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SharedAdaptationConsentDecision } from '@/types/chat';
import { t } from '@/utils/i18n';

type TrustDecision = Exclude<SharedAdaptationConsentDecision, 'not_set'>;

interface ChatTrustCheckpointProps {
  open: boolean;
  saving: boolean;
  onDecision: (decision: TrustDecision) => void;
}

const boundaryItems = [
  { icon: Eye, titleKey: 'chat.trust.sharedTitle', detailKey: 'chat.trust.sharedDetail' },
  { icon: LockKeyhole, titleKey: 'chat.trust.privateTitle', detailKey: 'chat.trust.privateDetail' },
  { icon: Scale, titleKey: 'chat.trust.formalTitle', detailKey: 'chat.trust.formalDetail' },
] as const;

export default function ChatTrustCheckpoint({
  open,
  saving,
  onDecision,
}: ChatTrustCheckpointProps) {
  const [decision, setDecision] = useState<TrustDecision | null>(null);

  useEffect(() => {
    if (open) setDecision(null);
  }, [open]);

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl"
        onEscapeKeyDown={(event: Event) => event.preventDefault()}
        onInteractOutside={(event: Event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('chat.trust.title')}</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {t('chat.trust.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {boundaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.titleKey} className="flex gap-3 rounded-lg border border-border/65 p-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{t(item.titleKey)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t(item.detailKey)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">
            {t('chat.trust.choiceTitle')}
          </p>
          <RadioGroupPrimitive.Root
            value={decision ?? ''}
            onValueChange={(value: string) => setDecision(value as TrustDecision)}
            className="grid gap-2"
            aria-label={t('chat.trust.choiceTitle')}
          >
            {(['accepted', 'declined'] as const).map((value) => (
              <RadioGroupPrimitive.Item
                key={value}
                value={value}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  decision === value
                    ? 'border-primary/45 bg-primary/5 text-foreground'
                    : 'border-border/65 text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <span className="block text-sm font-semibold">
                  {t(value === 'accepted'
                    ? 'chat.trust.acceptTitle'
                    : 'chat.trust.declineTitle')}
                </span>
                <span className="mt-1 block text-xs leading-relaxed">
                  {t(value === 'accepted'
                    ? 'chat.trust.acceptDetail'
                    : 'chat.trust.declineDetail')}
                </span>
              </RadioGroupPrimitive.Item>
            ))}
          </RadioGroupPrimitive.Root>
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!decision || saving}
            onClick={() => { if (decision) onDecision(decision); }}
          >
            {t('chat.trust.continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
