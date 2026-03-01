import { ChatMessageType, ChatParticipant, ChatRoomStatus } from '@prisma/client';
import prisma from '../config/database';
import { aiService } from './ai.service';
import { safetyRoutingService } from './safety-routing.service';
import logger from '../config/logger';
import { LOCK_TTL } from '../utils/constants';
import { lockService } from '../utils/lock';
import { chatEventsService } from './chat-events.service';
import { chatMetricsService } from './chat-metrics.service';

type OrchestratorContext = {
  roomId: string;
  roomStatus: ChatRoomStatus;
  aiParticipant?: ChatParticipant | null;
};

export class ChatAIOrchestrator {
  private throttleMs = 8000;
  private maxContextMessages = 30;
  private inFlight = new Set<string>();
  private lastResponseAt = new Map<string, number>();
  private safetyCooldownUntil = new Map<string, number>();

  async onUserMessage(
    ctx: OrchestratorContext,
    sender: ChatParticipant | null,
    message: { id: string; content: string; visibility_scope: string }
  ): Promise<void> {
    if (!sender) return;
    if (ctx.roomStatus === 'judgment_requested' || ctx.roomStatus === 'judgment_completed' || ctx.roomStatus === 'judgment_failed' || ctx.roomStatus === 'archived') {
      return;
    }
    const now = Date.now();
    const cooldownUntil = this.safetyCooldownUntil.get(ctx.roomId) ?? 0;
    if (now < cooldownUntil) {
      return;
    }
    const last = this.lastResponseAt.get(ctx.roomId) ?? 0;
    if (now - last < this.throttleMs) {
      return;
    }
    // 不處理非公開訊息，避免誤觸隱私
    if (message.visibility_scope !== 'all') {
      return;
    }

    const lockKey = `chat:ai:${ctx.roomId}`;
    if (this.inFlight.has(lockKey)) return;

    this.inFlight.add(lockKey);
    void lockService.withLock(lockKey, async () => {
      try {
        await this.safeHandle(ctx, sender, message);
      } catch (error) {
        logger.warn('ChatAIOrchestrator handle failed', { roomId: ctx.roomId, error });
      } finally {
        this.lastResponseAt.set(ctx.roomId, Date.now());
        this.inFlight.delete(lockKey);
      }
    }, LOCK_TTL.DEFAULT);
  }

  private async safeHandle(
    ctx: OrchestratorContext,
    sender: ChatParticipant,
    message: { id: string; content: string }
  ) {
    const ai = ctx.aiParticipant ?? await prisma.chatParticipant.findFirst({
      where: { room_id: ctx.roomId, role_in_room: 'aiMediator', is_active: true },
    });
    if (!ai) return;

    // 安全前置：即時危機/IPV 偵測
    const preRoute = safetyRoutingService.decideRoute({
      plaintiffStatement: message.content,
      defendantStatement: '',
    });
    if (preRoute.route === 'crisis_support') {
      this.safetyCooldownUntil.set(ctx.roomId, Date.now() + 120_000);
      chatMetricsService.recordSafetyHit().catch(() => undefined);
      await this.createSystemSafety(ai, ctx.roomId, '偵測到高風險危機訊號，已暫停一般回覆，請優先確保安全。', preRoute.detectedFlags);
      return;
    }
    if (preRoute.route === 'safety_support') {
      this.safetyCooldownUntil.set(ctx.roomId, Date.now() + 120_000);
      chatMetricsService.recordSafetyHit().catch(() => undefined);
      await this.createSystemSafety(ai, ctx.roomId, '偵測到可能的安全風險，將優先以安全為核心回應。', preRoute.detectedFlags);
    }

    const hasRoleB = await prisma.chatParticipant.count({
      where: { room_id: ctx.roomId, role_in_room: 'roleB', is_active: true },
    }) > 0;
    const messageType: ChatMessageType = hasRoleB ? 'ai_mediation' : 'ai_reflection';

    const contextMessages = await prisma.chatMessage.findMany({
      where: { room_id: ctx.roomId },
      orderBy: { created_at: 'desc' },
      take: this.maxContextMessages,
      include: { sender_participant: true },
    });

    const systemPrompt = hasRoleB
      ? '你是關係調解員，幫助 A/B 聽懂彼此，用中立、溫暖、短句翻譯與降溫，不做責任裁定。'
      : '你是關係支持者，先同理與命名情緒，再點出需求與小步行動，語氣溫暖、短句。';

    const userContent = this.buildPrompt(contextMessages);
    const response = await aiService.generateText(userContent, {
      systemPrompt,
      temperature: hasRoleB ? 0.55 : 0.65,
      maxTokens: 220,
    });

    const created = await prisma.chatMessage.create({
      data: {
        room_id: ctx.roomId,
        sender_participant_id: ai.id,
        content: response.trim().slice(0, 2000),
        message_type: messageType,
        visibility_scope: 'all',
        ai_strategy: hasRoleB ? 'mediation' : 'support',
        ai_confidence: preRoute.route === 'safety_support' ? 0.5 : 0.8,
      },
    });

    chatMetricsService.recordAiTrigger(hasRoleB ? 'mediation' : 'support').catch(() => undefined);

    chatEventsService.publish({
      type: 'message',
      roomId: ctx.roomId,
      payload: {
        messageId: created.id,
        senderParticipantId: created.sender_participant_id,
        messageType: created.message_type,
        visibilityScope: created.visibility_scope,
        aiStrategy: created.ai_strategy,
      },
      at: new Date().toISOString(),
    });
  }

  private async createSystemSafety(ai: ChatParticipant, roomId: string, text: string, flags: string[]) {
    const created = await prisma.chatMessage.create({
      data: {
        room_id: roomId,
        sender_participant_id: ai.id,
        content: text,
        message_type: 'safety_notice',
        visibility_scope: 'all',
        safety_flag: true,
        safety_detail: flags.join('、'),
      },
    });
    chatEventsService.publish({
      type: 'message',
      roomId,
      payload: {
        messageId: created.id,
        senderParticipantId: created.sender_participant_id,
        messageType: created.message_type,
        visibilityScope: created.visibility_scope,
        safety: true,
      },
      at: new Date().toISOString(),
    });
  }

  private buildPrompt(messages: Array<{
    content: string;
    sender_participant: ChatParticipant | null;
    message_type: ChatMessageType;
  }>): string {
    const ordered = [...messages].reverse();
    const lines = ordered.map((m) => {
      const role = m.sender_participant?.role_in_room ?? 'unknown';
      const tag = role === 'roleA' ? 'A' : role === 'roleB' ? 'B' : 'AI';
      return `${tag}: ${m.content}`;
    });
    return lines.join('\n').slice(-4000);
  }
}

export const chatAIOrchestrator = new ChatAIOrchestrator();
