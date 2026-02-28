import Redis from 'ioredis';
import logger from '../config/logger';
import { env } from '../config/env';

type HttpMetricSnapshot = {
  total: number;
  status5xx: number;
  status409: number;
};

const METRICS_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days
const METRICS_KEY_PREFIX = 'ops:metrics:http:minute';

function getMinuteBucket(date: Date): string {
  const yyyy = date.getUTCFullYear().toString().padStart(4, '0');
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = date.getUTCDate().toString().padStart(2, '0');
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mi = date.getUTCMinutes().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${mi}`;
}

function bucketKey(date: Date): string {
  return `${METRICS_KEY_PREFIX}:${getMinuteBucket(date)}`;
}

class OpsMetricsService {
  private redis: Redis | null = null;
  private initFailedLogged = false;

  constructor() {
    this.initRedis().catch((error) => {
      if (!this.initFailedLogged) {
        this.initFailedLogged = true;
        logger.warn('Ops metrics Redis unavailable, metrics disabled', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  private async initRedis(): Promise<void> {
    if (!env.REDIS_URL) return;
    this.redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    await this.redis.connect();
    logger.info('Redis connected for ops metrics');
  }

  async recordHttpStatus(statusCode: number): Promise<void> {
    if (!this.redis) return;

    const key = bucketKey(new Date());
    const multi = this.redis.multi();
    multi.hincrby(key, 'total', 1);
    if (statusCode >= 500) multi.hincrby(key, 'status5xx', 1);
    if (statusCode === 409) multi.hincrby(key, 'status409', 1);
    multi.expire(key, METRICS_TTL_SECONDS);

    try {
      await multi.exec();
    } catch (error) {
      logger.warn('Failed to record HTTP metric', {
        statusCode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getWindowSnapshot(windowMinutes: number): Promise<HttpMetricSnapshot> {
    if (!this.redis || windowMinutes <= 0) {
      return { total: 0, status5xx: 0, status409: 0 };
    }

    const now = new Date();
    const keys: string[] = [];
    for (let i = 0; i < windowMinutes; i++) {
      const bucket = new Date(now.getTime() - i * 60_000);
      keys.push(bucketKey(bucket));
    }

    try {
      const pipeline = this.redis.pipeline();
      for (const key of keys) {
        pipeline.hmget(key, 'total', 'status5xx', 'status409');
      }
      const results = await pipeline.exec();
      const snapshot: HttpMetricSnapshot = { total: 0, status5xx: 0, status409: 0 };

      for (const [, values] of results || []) {
        const [total, status5xx, status409] = (values as string[]) || [];
        snapshot.total += Number(total || '0');
        snapshot.status5xx += Number(status5xx || '0');
        snapshot.status409 += Number(status409 || '0');
      }
      return snapshot;
    } catch (error) {
      logger.warn('Failed to read HTTP metrics window snapshot', {
        windowMinutes,
        error: error instanceof Error ? error.message : String(error),
      });
      return { total: 0, status5xx: 0, status409: 0 };
    }
  }
}

export const opsMetricsService = new OpsMetricsService();
