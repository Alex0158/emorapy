import {
  ChatSafetyRouterAction,
  Prisma,
  type ChatSafetyRouterState,
} from '@prisma/client';
import prisma from '../config/database';
import { isTransactionWriteConflict } from '../utils/chat-context-validation';
import { Errors } from '../utils/errors';
import { chatActorAccessService, type ChatActorContext } from './chat-actor-access.service';
import type { JudgmentRoute } from './safety-routing.service';

export const CHAT_SAFETY_ROUTER_POLICY_VERSION = '2026-07-13.safety-router-v1';

const ACTION_PRIORITY: Record<ChatSafetyRouterAction, number> = {
  [ChatSafetyRouterAction.continue]: 0,
  [ChatSafetyRouterAction.private_checkin]: 1,
  [ChatSafetyRouterAction.block_joint_repair]: 2,
  [ChatSafetyRouterAction.pause_shared]: 3,
  [ChatSafetyRouterAction.crisis_support]: 4,
};

const ACTIONS = new Set<ChatSafetyRouterAction>(
  Object.values(ChatSafetyRouterAction),
);

type SafetyRouterReadClient = Pick<Prisma.TransactionClient, 'chatSafetyRouterState'>;

type SafetyRestrictions = {
  sharedMessagingBlocked: boolean;
  formalAnalysisBlocked: boolean;
  jointRepairBlocked: boolean;
};

export type SafetyActivationResult = {
  state: ChatSafetyRouterState;
  changed: boolean;
  sharedStatusChanged: boolean;
};

function parseAction(value: unknown): ChatSafetyRouterAction | null {
  return typeof value === 'string' && ACTIONS.has(value as ChatSafetyRouterAction)
    ? value as ChatSafetyRouterAction
    : null;
}

export function mapJudgmentRouteToSafetyAction(
  route: JudgmentRoute | unknown,
): ChatSafetyRouterAction {
  if (route === 'standard') return ChatSafetyRouterAction.continue;
  if (route === 'safety_support') return ChatSafetyRouterAction.block_joint_repair;
  if (route === 'crisis_support') return ChatSafetyRouterAction.crisis_support;

  // An unrecognized upstream route must never silently reopen a shared flow.
  return ChatSafetyRouterAction.crisis_support;
}

function restrictionsForAction(value: unknown): SafetyRestrictions {
  const action = parseAction(value);
  if (!action) {
    return {
      sharedMessagingBlocked: true,
      formalAnalysisBlocked: true,
      jointRepairBlocked: true,
    };
  }

  if (action === ChatSafetyRouterAction.crisis_support) {
    return {
      sharedMessagingBlocked: true,
      formalAnalysisBlocked: true,
      jointRepairBlocked: true,
    };
  }
  if (action === ChatSafetyRouterAction.pause_shared) {
    return {
      sharedMessagingBlocked: true,
      formalAnalysisBlocked: true,
      jointRepairBlocked: true,
    };
  }
  if (action === ChatSafetyRouterAction.block_joint_repair) {
    return {
      sharedMessagingBlocked: false,
      formalAnalysisBlocked: false,
      jointRepairBlocked: true,
    };
  }

  return {
    sharedMessagingBlocked: false,
    formalAnalysisBlocked: false,
    jointRepairBlocked: false,
  };
}

function mergeRestrictions(actions: unknown[]): SafetyRestrictions {
  return actions.reduce<SafetyRestrictions>((merged, action) => {
    const current = restrictionsForAction(action);
    return {
      sharedMessagingBlocked: merged.sharedMessagingBlocked || current.sharedMessagingBlocked,
      formalAnalysisBlocked: merged.formalAnalysisBlocked || current.formalAnalysisBlocked,
      jointRepairBlocked: merged.jointRepairBlocked || current.jointRepairBlocked,
    };
  }, {
    sharedMessagingBlocked: false,
    formalAnalysisBlocked: false,
    jointRepairBlocked: false,
  });
}

export class ChatSafetyRouterService {
  private async activateActionInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      roomId: string;
      ownerParticipantId: string;
      action: ChatSafetyRouterAction | unknown;
    },
  ): Promise<SafetyActivationResult> {
    const requestedAction = parseAction(input.action)
      ?? ChatSafetyRouterAction.crisis_support;
    const owners = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "chat_participants"
      WHERE "id" = ${input.ownerParticipantId}
        AND "room_id" = ${input.roomId}
        AND "participant_type" = 'user'
        AND "role_in_room" IN ('roleA', 'roleB')
        AND "is_active" = true
        AND "left_at" IS NULL
      FOR UPDATE
    `);
    if (owners.length !== 1) {
      throw Errors.FORBIDDEN('安全狀態只可綁定目前有效的聊天室成員');
    }

    const existing = await tx.chatSafetyRouterState.findUnique({
      where: {
        room_id_owner_participant_id: {
          room_id: input.roomId,
          owner_participant_id: input.ownerParticipantId,
        },
      },
    });
    const existingAction = parseAction(existing?.action);
    const shouldActivate = !existing
      || (existingAction !== null
        && ACTION_PRIORITY[requestedAction] > ACTION_PRIORITY[existingAction]);

    if (existing && !shouldActivate) {
      return {
        state: existing,
        changed: false,
        sharedStatusChanged: false,
      };
    }

    const previousSharedMessagingBlocked = existing
      ? restrictionsForAction(existing.action).sharedMessagingBlocked
      : false;

    const now = new Date();
    const state = existing
      ? await tx.chatSafetyRouterState.update({
          where: { id: existing.id },
          data: {
            action: requestedAction,
            policy_version: CHAT_SAFETY_ROUTER_POLICY_VERSION,
            state_version: { increment: 1 },
            activated_at: now,
          },
        })
      : await tx.chatSafetyRouterState.create({
          data: {
            room_id: input.roomId,
            owner_participant_id: input.ownerParticipantId,
            action: requestedAction,
            policy_version: CHAT_SAFETY_ROUTER_POLICY_VERSION,
            state_version: 1,
            activated_at: now,
          },
        });

    await tx.contextUseAudit.create({
      data: {
        room_id: input.roomId,
        actor_participant_id: input.ownerParticipantId,
        purpose: 'safety_routing',
        audience: 'safety_system',
        target_type: 'chat_room',
        target_id: input.roomId,
        decision: 'allowed',
        reason_code: 'safety_router_state_activated',
        source_refs: [],
        authorization_refs: [],
        content_hashes: [],
        policy_version: CHAT_SAFETY_ROUTER_POLICY_VERSION,
      },
    });

    return {
      state,
      changed: true,
      sharedStatusChanged: previousSharedMessagingBlocked
        !== restrictionsForAction(requestedAction).sharedMessagingBlocked,
    };
  }

  async activateForRoute(input: {
    roomId: string;
    ownerParticipantId: string;
    route: JudgmentRoute | unknown;
  }) {
    return this.activateAction({
      roomId: input.roomId,
      ownerParticipantId: input.ownerParticipantId,
      action: mapJudgmentRouteToSafetyAction(input.route),
    });
  }

  async activateForRouteWithClient(
    input: {
      roomId: string;
      ownerParticipantId: string;
      route: JudgmentRoute | unknown;
    },
    tx: Prisma.TransactionClient,
  ) {
    return this.activateActionInTransaction(tx, {
      roomId: input.roomId,
      ownerParticipantId: input.ownerParticipantId,
      action: mapJudgmentRouteToSafetyAction(input.route),
    });
  }

  async activateAction(input: {
    roomId: string;
    ownerParticipantId: string;
    action: ChatSafetyRouterAction | unknown;
  }) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await prisma.$transaction(
          tx => this.activateActionInTransaction(tx, input),
          { isolationLevel: 'Serializable' },
        );
        return result.state;
      } catch (error) {
        if (attempt === 0 && isTransactionWriteConflict(error)) continue;
        throw error;
      }
    }

    throw Errors.CONFLICT('安全狀態已變更，請重試');
  }

  private async getRestrictions(
    roomId: string,
    client: SafetyRouterReadClient = prisma,
  ): Promise<SafetyRestrictions> {
    const states = await client.chatSafetyRouterState.findMany({
      where: {
        room_id: roomId,
        owner_participant: {
          participant_type: 'user',
          role_in_room: { in: ['roleA', 'roleB'] },
          is_active: true,
          left_at: null,
        },
      },
      select: { action: true },
    });
    return mergeRestrictions(states.map(state => state.action));
  }

  async assertSharedMessagingAllowed(
    roomId: string,
    client: SafetyRouterReadClient = prisma,
  ): Promise<void> {
    const restrictions = await this.getRestrictions(roomId, client);
    if (restrictions.sharedMessagingBlocked) {
      throw Errors.CASE_NOT_EDITABLE('共同對話目前暫停，請先使用私人安全支持');
    }
  }

  async assertFormalAnalysisAllowed(
    roomId: string,
    client: SafetyRouterReadClient = prisma,
  ): Promise<void> {
    const restrictions = await this.getRestrictions(roomId, client);
    if (restrictions.formalAnalysisBlocked) {
      throw Errors.CASE_NOT_READY('共同梳理目前暫停，請先使用私人安全支持');
    }
  }

  async assertJointRepairAllowed(
    roomId: string,
    client: SafetyRouterReadClient = prisma,
  ): Promise<void> {
    if (!(await this.isJointRepairAllowed(roomId, client))) {
      throw Errors.FORBIDDEN('共同修復目前不可用，請先使用個人安全支持方向');
    }
  }

  async isJointRepairAllowed(
    roomId: string,
    client: SafetyRouterReadClient = prisma,
  ): Promise<boolean> {
    const restrictions = await this.getRestrictions(roomId, client);
    return !restrictions.jointRepairBlocked;
  }

  async getSanitizedSharedStatus(
    roomId: string,
    actor: ChatActorContext,
  ): Promise<{ status: 'open' | 'paused' }> {
    await chatActorAccessService.resolveActiveHumanParticipant(roomId, actor);
    const restrictions = await this.getRestrictions(roomId);
    return {
      status: restrictions.sharedMessagingBlocked ? 'paused' : 'open',
    };
  }
}

export const chatSafetyRouterService = new ChatSafetyRouterService();
