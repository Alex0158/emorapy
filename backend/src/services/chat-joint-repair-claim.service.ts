import type { Prisma } from '../types/prisma-client';
import { chatSafetyRouterService } from './chat-safety-router.service';

export type ChatLinkedRepairCase = {
  chat_to_case_links?: Array<{ room_id?: string | null }> | null;
};

/**
 * Linearizes Chat-linked joint-repair side effects with private Safety state.
 *
 * Callers must use a ReadCommitted transaction. PostgreSQL then takes a fresh
 * statement snapshot after a waited participant lock, so a Safety state that
 * committed while this claim was waiting cannot be missed.
 */
export class ChatJointRepairClaimService {
  getRoomId(caseRecord: ChatLinkedRepairCase): string | null {
    return caseRecord.chat_to_case_links?.[0]?.room_id ?? null;
  }

  private async lockParticipants(
    tx: Prisma.TransactionClient,
    roomId: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT "id"
      FROM "chat_participants"
      WHERE "room_id" = ${roomId}
        AND "participant_type" = 'user'
        AND "role_in_room" IN ('roleA', 'roleB')
      ORDER BY "id"
      FOR UPDATE
    `;
  }

  async assertAllowed(
    tx: Prisma.TransactionClient,
    caseRecord: ChatLinkedRepairCase,
  ): Promise<void> {
    const roomId = this.getRoomId(caseRecord);
    if (!roomId) return;

    await this.lockParticipants(tx, roomId);
    await chatSafetyRouterService.assertJointRepairAllowed(roomId, tx);
  }

  async observeAllowed(
    tx: Prisma.TransactionClient,
    caseRecord: ChatLinkedRepairCase,
  ): Promise<boolean> {
    const roomId = this.getRoomId(caseRecord);
    if (!roomId) return true;

    await this.lockParticipants(tx, roomId);
    return chatSafetyRouterService.isJointRepairAllowed(roomId, tx);
  }
}

export const chatJointRepairClaimService = new ChatJointRepairClaimService();
