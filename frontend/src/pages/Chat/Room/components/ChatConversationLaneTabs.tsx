import { ShieldCheck, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { t } from '@/utils/i18n';
import type { ChatConversationLane } from '../hooks/useChatRoomUiState';

interface ChatConversationLaneTabsProps {
  activeLane: ChatConversationLane;
  sharedDisabled: boolean;
  sharedReadOnly: boolean;
  onLaneChange: (lane: ChatConversationLane) => void;
}

const laneOptions = [
  {
    value: 'private',
    icon: ShieldCheck,
    labelKey: 'chat.lane.private',
    descriptionKey: 'chat.lane.privateDescription',
  },
  {
    value: 'shared',
    icon: Users,
    labelKey: 'chat.lane.shared',
    descriptionKey: 'chat.lane.sharedDescription',
  },
] as const;

export default function ChatConversationLaneTabs({
  activeLane,
  sharedDisabled,
  sharedReadOnly,
  onLaneChange,
}: ChatConversationLaneTabsProps) {
  return (
    <Tabs
      value={activeLane}
      onValueChange={(value: string) => onLaneChange(value as ChatConversationLane)}
      className="space-y-2"
    >
      <TabsList
        aria-label={t('chat.lane.label')}
        className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border bg-muted/45 p-1"
      >
        {laneOptions.map((lane) => {
          const Icon = lane.icon;
          const disabled = lane.value === 'shared' && sharedDisabled;
          const selected = activeLane === lane.value;
          return (
            <TabsTrigger
              key={lane.value}
              value={lane.value}
              id={`chat-lane-${lane.value}-tab`}
              aria-controls="chat-conversation-panel"
              disabled={disabled}
              className={`flex h-auto min-h-14 items-center justify-start gap-3 rounded-lg px-3 py-2 text-left whitespace-normal after:hidden disabled:cursor-not-allowed disabled:opacity-45 ${
                selected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/65 hover:text-foreground'
              }`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${selected ? 'bg-primary/10 text-primary' : 'bg-background/70'}`}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{t(lane.labelKey)}</span>
                <span className="mt-0.5 block text-xs leading-snug">{t(lane.descriptionKey)}</span>
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {sharedDisabled && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground" role="status">
          {t('chat.lane.sharedUnavailable')}
        </p>
      )}
      {sharedReadOnly && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground" role="status">
          {t('chat.lane.sharedReadOnly')}
        </p>
      )}
    </Tabs>
  );
}
