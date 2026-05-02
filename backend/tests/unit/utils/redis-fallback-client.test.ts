import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

const mockRedisInstance = {
  connect: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  disconnect: jest.fn(),
};

const mockRedisConstructor = jest.fn((_url: string, _options: unknown) => mockRedisInstance);

jest.mock('ioredis', () => ({
  __esModule: true,
  default: mockRedisConstructor,
}));

import { RedisFallbackClient } from '../../../src/utils/redis-fallback-client';

function createClient(): RedisFallbackClient {
  return new RedisFallbackClient({
    connectedMessage: 'Redis connected for test',
    connectionLostMessage: 'Redis connection lost for test',
    disconnectCleanupFailedMessage: 'Redis test cleanup failed',
  });
}

describe('RedisFallbackClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockRedisInstance.connect as jest.Mock).mockResolvedValue(undefined as never);
    (mockRedisInstance.on as jest.Mock).mockReturnValue(undefined as never);
    (mockRedisInstance.removeListener as jest.Mock).mockReturnValue(undefined as never);
    (mockRedisInstance.disconnect as jest.Mock).mockReturnValue(undefined as never);
  });

  it('未提供 REDIS_URL 時不初始化 client', async () => {
    const client = createClient();
    await client.init(undefined);
    expect(client.current).toBeNull();
    expect(mockRedisConstructor).not.toHaveBeenCalled();
  });

  it('connect 成功時保存 client 並記錄連線成功', async () => {
    const client = createClient();
    await client.init('redis://localhost');

    expect(client.current).toBe(mockRedisInstance);
    expect(mockRedisConstructor).toHaveBeenCalledWith('redis://localhost', {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockLogger.info).toHaveBeenCalledWith('Redis connected for test');
  });

  it('connect 失敗時移除 listener 並斷線後拋出原錯誤', async () => {
    const error = new Error('connect failed');
    (mockRedisInstance.connect as jest.Mock).mockRejectedValue(error as never);
    const client = createClient();

    await expect(client.init('redis://localhost')).rejects.toBe(error);

    expect(client.current).toBeNull();
    expect(mockRedisInstance.removeListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockRedisInstance.disconnect).toHaveBeenCalledWith(false);
  });

  it('disable 會永久清除 client、移除 listener、斷線並記錄警告', async () => {
    const client = createClient();
    await client.init('redis://localhost');

    client.disable('Redis op failed for test', { key: 'k1' });

    expect(client.current).toBeNull();
    expect(mockRedisInstance.removeListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockRedisInstance.disconnect).toHaveBeenCalledWith(false);
    expect(mockLogger.warn).toHaveBeenCalledWith('Redis op failed for test', { key: 'k1' });
  });

  it('Redis error event 會走 connection lost 降級路徑', async () => {
    const client = createClient();
    await client.init('redis://localhost');
    const errorHandler = (mockRedisInstance.on as jest.Mock).mock.calls[0][1] as (error: unknown) => void;
    const error = new Error('connection lost');

    errorHandler(error);

    expect(client.current).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith('Redis connection lost for test', { error });
  });

  it('disable 斷線清理失敗時記錄 debug，但仍完成降級', async () => {
    const client = createClient();
    await client.init('redis://localhost');
    const disconnectError = new Error('disconnect failed');
    (mockRedisInstance.disconnect as jest.Mock).mockImplementation(() => {
      throw disconnectError;
    });

    client.disable('Redis op failed for test', { key: 'k1' });

    expect(client.current).toBeNull();
    expect(mockLogger.debug).toHaveBeenCalledWith('Redis test cleanup failed', { error: disconnectError });
    expect(mockLogger.warn).toHaveBeenCalledWith('Redis op failed for test', { key: 'k1' });
  });
});
