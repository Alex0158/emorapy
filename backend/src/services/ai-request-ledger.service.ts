import { randomUUID } from 'crypto';
import logger from '../config/logger';
import { env } from '../config/env';
import { AI_CONFIG } from '../config/openai';
import type { Prisma, PrismaClient } from '../types/prisma-client';
import { calculateAIRequestCost } from './ai-cost-pricing.service';

type AIRequestLedgerStatus = 'started' | 'succeeded' | 'failed' | 'cancelled';

interface TokenUsage {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

export interface AIRequestLedgerStartInput {
  requestId?: string;
  streamId?: string | null;
  scopeType?: string | null;
  scopeId?: string | null;
  productFlow?: string | null;
  sourceChannel?: string | null;
  entryPoint?: string | null;
  provider?: string | null;
  model?: string | null;
  requestKind?: string | null;
  promptVersion?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AIRequestLedgerFinishInput extends TokenUsage {
  requestId: string;
  status?: Exclude<AIRequestLedgerStatus, 'started'>;
  provider?: string | null;
  model?: string | null;
  retryCount?: number;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
}

type AIRequestLedgerPrisma = Pick<PrismaClient, 'aIRequestLedger'>;

let prismaLoader: (() => AIRequestLedgerPrisma) | null = null;

function loadPrisma(): AIRequestLedgerPrisma {
  if (!prismaLoader) {
    prismaLoader = () => (
      require('../config/database') as typeof import('../config/database')
    ).default;
  }
  return prismaLoader();
}

function truncate(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function sanitizeMetadata(metadata?: Record<string, unknown> | null): Prisma.InputJsonObject | undefined {
  if (!metadata) return undefined;
  return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonObject;
}

function normalizeFailureReason(reason?: string | null): string | null {
  return truncate(reason || null, 1000);
}

export class AIRequestLedgerService {
  private readonly enabled: boolean;
  private readonly startedMetadata = new Map<string, Record<string, unknown>>();

  constructor(options: { enabled?: boolean } = {}) {
    this.enabled = options.enabled ?? env.NODE_ENV !== 'test';
  }

  async start(input: AIRequestLedgerStartInput = {}): Promise<{ requestId: string }> {
    const requestId = truncate(input.requestId, 100) || randomUUID();
    if (input.metadata) {
      this.startedMetadata.set(requestId, input.metadata);
    }
    if (!this.enabled) {
      return { requestId };
    }

    const startedAt = new Date();
    const data = {
      request_id: requestId,
      stream_id: truncate(input.streamId, 100),
      scope_type: truncate(input.scopeType, 50) || 'unknown',
      scope_id: input.scopeId || null,
      product_flow: truncate(input.productFlow, 50),
      source_channel: truncate(input.sourceChannel, 50),
      entry_point: truncate(input.entryPoint, 50),
      provider: truncate(input.provider, 50) || 'openai',
      model: truncate(input.model, 100) || AI_CONFIG.model,
      request_kind: truncate(input.requestKind, 50) || 'chat_completion',
      prompt_version: truncate(input.promptVersion, 100),
      status: 'started',
      metadata: sanitizeMetadata(input.metadata),
      started_at: startedAt,
    } satisfies Prisma.AIRequestLedgerUncheckedCreateInput;

    try {
      await loadPrisma().aIRequestLedger.upsert({
        where: { request_id: requestId },
        create: data,
        update: {
          ...data,
          completed_at: null,
          failure_reason: null,
          input_tokens: null,
          output_tokens: null,
          total_tokens: null,
          cost_usd: null,
          retry_count: 0,
        },
      });
    } catch (error) {
      logger.warn('AI request ledger start failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return { requestId };
  }

  async complete(input: AIRequestLedgerFinishInput): Promise<void> {
    await this.finish({ ...input, status: input.status ?? 'succeeded' });
  }

  async fail(input: AIRequestLedgerFinishInput): Promise<void> {
    await this.finish({ ...input, status: input.status ?? 'failed' });
  }

  private async finish(input: AIRequestLedgerFinishInput & { status: Exclude<AIRequestLedgerStatus, 'started'> }): Promise<void> {
    if (!this.enabled) return;

    try {
      const cost = calculateAIRequestCost({
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
      });
      const baseMetadata = input.metadata || this.startedMetadata.get(input.requestId) || null;
      const metadata = cost
        ? {
            ...(baseMetadata || {}),
            pricing: cost.pricing,
          }
        : baseMetadata;

      await loadPrisma().aIRequestLedger.update({
        where: { request_id: input.requestId },
        data: {
          status: input.status,
          input_tokens: input.inputTokens ?? null,
          output_tokens: input.outputTokens ?? null,
          total_tokens: input.totalTokens ?? null,
          cost_usd: cost?.costUsd ?? null,
          retry_count: Math.max(0, input.retryCount ?? 0),
          failure_reason: normalizeFailureReason(input.failureReason),
          metadata: sanitizeMetadata(metadata),
          completed_at: new Date(),
        },
      });
    } catch (error) {
      logger.warn('AI request ledger finish failed', {
        requestId: input.requestId,
        status: input.status,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.startedMetadata.delete(input.requestId);
    }
  }
}

export const aiRequestLedgerService = new AIRequestLedgerService();
