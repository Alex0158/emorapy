import {
  ChatChannelKind,
  ChatHistoryVisibilityMode,
  ChatRoleInRoom,
} from '@prisma/client';
import type { AIStreamScopeType } from '../types/ai-stream';
import type { ChatActorContext } from '../services/chat-actor-access.service';
import { chatActorAccessService } from '../services/chat-actor-access.service';
import { caseService } from '../services/case.service';
import { chatChannelService } from '../services/chat-channel.service';
import { executionService } from '../services/execution.service';
import { interviewService } from '../services/interview.service';
import { Errors } from '../utils/errors';

const AI_STREAM_SCOPE_TYPES: readonly AIStreamScopeType[] = [
  'interview_session',
  'chat_room',
  'chat_channel',
  'case_judgment',
  'judgment_detail',
  'repair_track',
  'generic_ai_task',
];

export type AIStreamScopeAccess = {
  chatParticipantId?: string;
  replayNotBefore?: Date;
};

function resolveSharedReplayNotBefore(
  participant: { role_in_room: ChatRoleInRoom; joined_at: Date | null },
  historyVisibilityMode: ChatHistoryVisibilityMode,
): Date | undefined {
  if (
    participant.role_in_room !== ChatRoleInRoom.roleB
    || historyVisibilityMode === ChatHistoryVisibilityMode.share_full_history
  ) {
    return undefined;
  }
  if (!participant.joined_at) {
    throw Errors.FORBIDDEN('B 方缺少有效加入時間，不能重播共同 AI stream');
  }
  return participant.joined_at;
}

export function isAIStreamScopeType(value: string): value is AIStreamScopeType {
  return AI_STREAM_SCOPE_TYPES.includes(value as AIStreamScopeType);
}

export async function assertAIStreamScopeAccess(
  scopeType: AIStreamScopeType,
  scopeId: string,
  actor: ChatActorContext,
): Promise<AIStreamScopeAccess> {
  switch (scopeType) {
    case 'interview_session':
      if (!actor.userId) throw Errors.UNAUTHORIZED('需要認證');
      await interviewService.getSession(scopeId, actor.userId);
      return {};
    case 'chat_room': {
      const context = await chatActorAccessService.resolveActiveHumanParticipant(scopeId, actor);
      return {
        chatParticipantId: context.participant.id,
        replayNotBefore: resolveSharedReplayNotBefore(
          context.participant,
          context.room.history_visibility_mode,
        ),
      };
    }
    case 'chat_channel': {
      const context = await chatChannelService.resolveAccessibleChannel(scopeId, actor);
      return {
        chatParticipantId: context.participant.id,
        replayNotBefore: context.channel.kind === ChatChannelKind.shared
          ? resolveSharedReplayNotBefore(
              context.participant,
              context.room.history_visibility_mode,
            )
          : undefined,
      };
    }
    case 'case_judgment':
    case 'judgment_detail':
      await caseService.getCaseById(scopeId, actor.userId, actor.sessionId);
      return {};
    case 'repair_track':
      if (!actor.userId) throw Errors.UNAUTHORIZED('需要認證');
      await executionService.assertTrackAccess(scopeId, actor.userId);
      return {};
    case 'generic_ai_task':
      return {};
  }
}
