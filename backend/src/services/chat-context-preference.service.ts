import { PrivateContextUseMode } from '@prisma/client';
import prisma from '../config/database';
import {
  chatActorAccessService,
  type ChatActorContext,
} from './chat-actor-access.service';
import { Errors } from '../utils/errors';
import { isTransactionWriteConflict } from '../utils/chat-context-validation';

export type PrivateContextPreference = {
  participantId: string;
  mode: PrivateContextUseMode;
};

export class ChatContextPreferenceService {
  async get(
    roomId: string,
    actor: ChatActorContext,
  ): Promise<PrivateContextPreference> {
    const { participant } = await chatActorAccessService.resolveActiveHumanParticipant(
      roomId,
      actor,
    );
    return {
      participantId: participant.id,
      mode: participant.private_context_use_mode,
    };
  }

  async update(
    roomId: string,
    actor: ChatActorContext,
    mode: PrivateContextUseMode,
  ): Promise<PrivateContextPreference> {
    try {
      return await prisma.$transaction(async tx => {
        const { participant } = await chatActorAccessService.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx,
        );
        await chatActorAccessService.lockActiveParticipant(tx, roomId, participant.id);
        const updated = await tx.chatParticipant.updateMany({
          where: {
            id: participant.id,
            room_id: roomId,
            participant_type: 'user',
            is_active: true,
            left_at: null,
          },
          data: { private_context_use_mode: mode },
        });
        if (updated.count !== 1) {
          throw Errors.FORBIDDEN('聊天室參與者權限已失效');
        }
        const persisted = await tx.chatParticipant.findUniqueOrThrow({
          where: { id: participant.id },
          select: { id: true, private_context_use_mode: true },
        });
        return {
          participantId: persisted.id,
          mode: persisted.private_context_use_mode,
        };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isTransactionWriteConflict(error)) {
        throw Errors.CONFLICT('Context preference 狀態已變更，請重新載入');
      }
      throw error;
    }
  }
}

export const chatContextPreferenceService = new ChatContextPreferenceService();
