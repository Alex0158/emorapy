import Redis from 'ioredis';
import logger from '../config/logger';

const REDIS_CLIENT_OPTIONS = {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
} as const;

interface RedisFallbackClientOptions {
  connectedMessage: string;
  connectionLostMessage: string;
  disconnectCleanupFailedMessage: string;
}

export class RedisFallbackClient {
  private client: Redis | null = null;

  private readonly handleRedisError = (error: unknown): void => {
    if (!this.client) return;
    this.disable(this.options.connectionLostMessage, { error });
  };

  constructor(private readonly options: RedisFallbackClientOptions) {}

  get current(): Redis | null {
    return this.client;
  }

  async init(redisUrl?: string): Promise<void> {
    if (!redisUrl) return;

    const client = new Redis(redisUrl, REDIS_CLIENT_OPTIONS);
    client.on('error', this.handleRedisError);

    try {
      await client.connect();
      this.client = client;
      logger.info(this.options.connectedMessage);
    } catch (error) {
      this.detachAndDisconnect(client);
      throw error;
    }
  }

  disable(message: string, context: Record<string, unknown>): void {
    const client = this.client;
    if (!client) return;

    this.client = null;
    this.detachAndDisconnect(client, this.options.disconnectCleanupFailedMessage);
    logger.warn(message, context);
  }

  private detachAndDisconnect(client: Redis, cleanupFailedMessage?: string): void {
    try {
      client.removeListener('error', this.handleRedisError);
      client.disconnect(false);
    } catch (disconnectError) {
      if (cleanupFailedMessage) {
        logger.debug(cleanupFailedMessage, { error: disconnectError });
      }
    }
  }
}
