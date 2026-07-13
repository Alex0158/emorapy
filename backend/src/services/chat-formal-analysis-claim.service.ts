import type { Prisma } from '../types/prisma-client';
import prisma from '../config/database';
import { chatActorAccessService } from './chat-actor-access.service';
import { chatSafetyRouterService } from './chat-safety-router.service';

/**
 * Linearizes Chat-linked formal-analysis provider use with private Safety state.
 *
 * The provider boundary uses ReadCommitted so a statement that waits for the
 * ordered participant locks observes a Safety state committed by the winner.
 */
export class ChatFormalAnalysisClaimService {
  async assertAllowedInTransaction(
    tx: Prisma.TransactionClient,
    roomId: string,
  ): Promise<void> {
    await chatActorAccessService.lockActiveHumanParticipants(tx, roomId);
    await chatSafetyRouterService.assertFormalAnalysisAllowed(roomId, tx);
  }

  async claimProviderUse(roomId: string): Promise<void> {
    await prisma.$transaction(
      tx => this.assertAllowedInTransaction(tx, roomId),
      { isolationLevel: 'ReadCommitted' },
    );
  }
}

export const chatFormalAnalysisClaimService = new ChatFormalAnalysisClaimService();
