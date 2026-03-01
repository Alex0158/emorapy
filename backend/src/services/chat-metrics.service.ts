import Redis from 'ioredis';
import client, { Counter, Registry } from 'prom-client';
import logger from '../config/logger';
import { env } from '../config/env';

const TTL_SECONDS = 60 * 60 * 24 * 3;
const PREFIX = 'ops:metrics:chat:minute';

function bucket(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mi = d.getUTCMinutes().toString().padStart(2, '0');
  return `${PREFIX}:${yyyy}${mm}${dd}${hh}${mi}`;
}

class ChatMetricsService {
  private redis: Redis | null = null;
  private registry: Registry;
  private cMessages: Counter<string>;
  private cRateLimit: Counter<string>;
  private cAi: Counter<string>;
  private cSafety: Counter<string>;
  private cJudgment: Counter<string>;

  constructor() {
    this.registry = new client.Registry();
    this.cMessages = new client.Counter({
      name: 'chat_messages_total',
      help: 'Total chat messages recorded',
      registers: [this.registry],
    });
    this.cRateLimit = new client.Counter({
      name: 'chat_rate_limit_hits_total',
      help: 'Chat rate limit hits',
      registers: [this.registry],
    });
    this.cAi = new client.Counter({
      name: 'chat_ai_trigger_total',
      help: 'AI trigger count by strategy',
      labelNames: ['strategy'],
      registers: [this.registry],
    });
    this.cSafety = new client.Counter({
      name: 'chat_safety_hits_total',
      help: 'Safety hits detected in chat',
      registers: [this.registry],
    });
    this.cJudgment = new client.Counter({
      name: 'chat_judgment_total',
      help: 'Judgment generation results',
      labelNames: ['result'],
      registers: [this.registry],
    });

    this.init().catch((e) => {
      logger.warn('Chat metrics Redis unavailable, metrics disabled', { error: e instanceof Error ? e.message : String(e) });
    });
  }

  private async init(): Promise<void> {
    if (!env.REDIS_URL) return;
    this.redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
    await this.redis.connect();
    logger.info('Redis connected for chat metrics');
  }

  private async hincr(field: string, value = 1) {
    if (!this.redis) return;
    const key = bucket();
    try {
      await this.redis.multi().hincrby(key, field, value).expire(key, TTL_SECONDS).exec();
    } catch (error) {
      logger.warn('Failed to record chat metric', { field, error: error instanceof Error ? error.message : String(error) });
    }
  }

  recordMessage() {
    this.cMessages.inc();
    return this.hincr('messages');
  }

  recordRateLimit() {
    this.cRateLimit.inc();
    return this.hincr('rate_limit_hits');
  }

  recordAiTrigger(strategy: string) {
    this.cAi.inc({ strategy });
    return this.hincr(`ai_${strategy}`);
  }

  recordSafetyHit() {
    this.cSafety.inc();
    return this.hincr('safety_hits');
  }

  recordJudgmentSuccess() {
    this.cJudgment.inc({ result: 'success' });
    return this.hincr('judgment_success');
  }

  recordJudgmentFailed() {
    this.cJudgment.inc({ result: 'failed' });
    return this.hincr('judgment_failed');
  }

  async exportPrometheus(): Promise<string> {
    return this.registry.metrics();
  }
}

export const chatMetricsService = new ChatMetricsService();
