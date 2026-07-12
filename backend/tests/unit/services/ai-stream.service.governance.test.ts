// @ts-nocheck
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockAiStreamSessionCount = jest.fn();
const mockAiStreamSessionFindMany = jest.fn();
const mockAiStreamSessionFindUnique = jest.fn();
const mockAiStreamSessionDeleteMany = jest.fn();
const mockAiStreamSessionArchiveCount = jest.fn();
const mockAiStreamSessionArchiveFindMany = jest.fn();
const mockAiStreamSessionArchiveFindUnique = jest.fn();
const mockAiStreamSessionArchiveCreateMany = jest.fn();
const mockAiStreamEventCount = jest.fn();
const mockAiStreamEventFindMany = jest.fn();
const mockAiStreamEventDeleteMany = jest.fn();
const mockAiStreamEventArchiveCount = jest.fn();
const mockAiStreamEventArchiveFindMany = jest.fn();
const mockAiStreamEventArchiveCreateMany = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    aIStreamSession: {
      count: (...args: unknown[]) => mockAiStreamSessionCount(...args),
      findMany: (...args: unknown[]) => mockAiStreamSessionFindMany(...args),
      deleteMany: (...args: unknown[]) => mockAiStreamSessionDeleteMany(...args),
      groupBy: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
      findUnique: (...args: unknown[]) => mockAiStreamSessionFindUnique(...args),
    },
    aIStreamSessionArchive: {
      count: (...args: unknown[]) => mockAiStreamSessionArchiveCount(...args),
      findMany: (...args: unknown[]) => mockAiStreamSessionArchiveFindMany(...args),
      createMany: (...args: unknown[]) => mockAiStreamSessionArchiveCreateMany(...args),
      findUnique: (...args: unknown[]) => mockAiStreamSessionArchiveFindUnique(...args),
    },
    aIStreamEventRecord: {
      count: (...args: unknown[]) => mockAiStreamEventCount(...args),
      findMany: (...args: unknown[]) => mockAiStreamEventFindMany(...args),
      deleteMany: (...args: unknown[]) => mockAiStreamEventDeleteMany(...args),
      create: jest.fn().mockResolvedValue(undefined),
    },
    aIStreamEventArchive: {
      count: (...args: unknown[]) => mockAiStreamEventArchiveCount(...args),
      findMany: (...args: unknown[]) => mockAiStreamEventArchiveFindMany(...args),
      createMany: (...args: unknown[]) => mockAiStreamEventArchiveCreateMany(...args),
    },
  },
}));

describe('AIStreamService governance', () => {
  beforeEach(() => {
    jest.resetModules();
    mockAiStreamSessionCount.mockReset().mockResolvedValue(0);
    mockAiStreamSessionFindMany.mockReset().mockResolvedValue([]);
    mockAiStreamSessionFindUnique.mockReset().mockResolvedValue(null);
    mockAiStreamSessionDeleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockAiStreamSessionArchiveCount.mockReset().mockResolvedValue(0);
    mockAiStreamSessionArchiveFindMany.mockReset().mockResolvedValue([]);
    mockAiStreamSessionArchiveFindUnique.mockReset().mockResolvedValue(null);
    mockAiStreamSessionArchiveCreateMany.mockReset().mockResolvedValue({ count: 0 });
    mockAiStreamEventCount.mockReset().mockResolvedValue(0);
    mockAiStreamEventFindMany.mockReset().mockResolvedValue([]);
    mockAiStreamEventDeleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockAiStreamEventArchiveCount.mockReset().mockResolvedValue(0);
    mockAiStreamEventArchiveFindMany.mockReset().mockResolvedValue([]);
    mockAiStreamEventArchiveCreateMany.mockReset().mockResolvedValue({ count: 0 });
  });

  it('cleanupPersistence 應先歸檔再刪除 events 與 sessions', async () => {
    const eventRecord = {
      id: 'event-1',
      stream_id: 'stream-1',
      request_id: 'request-1',
      scope_type: 'chat_room',
      scope_id: 'room-1',
      seq: 1,
      event_type: 'stream.delta',
      actor_role: 'aiMediator',
      message_id: null,
      delta_text: 'hello',
      full_text: null,
      phase: null,
      metadata: null,
      error: null,
      created_at: new Date('2026-03-01T00:00:00.000Z'),
    };
    const sessionRecord = {
      id: 'session-row-1',
      stream_id: 'stream-1',
      request_id: 'request-1',
      scope_type: 'chat_room',
      scope_id: 'room-1',
      status: 'persisted',
      last_seq: 3,
      last_event_type: 'stream.persisted',
      actor_role: 'aiMediator',
      text: 'hello',
      phase: 'completed',
      message_id: 'msg-1',
      metadata: null,
      error: null,
      backend_mode: 'redis',
      started_at: new Date('2026-03-01T00:00:00.000Z'),
      completed_at: new Date('2026-03-01T00:00:05.000Z'),
      persisted_at: new Date('2026-03-01T00:00:06.000Z'),
      failed_at: null,
      cancelled_at: null,
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:06.000Z'),
    };

    mockAiStreamEventFindMany
      .mockResolvedValueOnce([eventRecord])
      .mockResolvedValueOnce([]);
    mockAiStreamSessionFindMany
      .mockResolvedValueOnce([sessionRecord])
      .mockResolvedValueOnce([]);
    mockAiStreamEventDeleteMany.mockResolvedValueOnce({ count: 1 });
    mockAiStreamSessionDeleteMany.mockResolvedValueOnce({ count: 1 });

    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: false });
    const result = await service.cleanupPersistence({
      archiveEnabled: true,
      archiveBatchSize: 100,
      eventRetentionDays: 14,
      sessionRetentionDays: 30,
    });

    expect(mockAiStreamEventArchiveCreateMany).toHaveBeenCalled();
    expect(mockAiStreamSessionArchiveCreateMany).toHaveBeenCalled();
    expect(mockAiStreamEventDeleteMany).toHaveBeenCalled();
    expect(mockAiStreamSessionDeleteMany).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      archiveEnabled: true,
      archivedEvents: 1,
      archivedSessions: 1,
      deletedEvents: 1,
      deletedSessions: 1,
    }));
  });

  it('listPersistenceSessions source=all 應合併 live 與 archive 列表', async () => {
    mockAiStreamSessionCount.mockResolvedValueOnce(1);
    mockAiStreamSessionFindMany.mockResolvedValueOnce([
      {
        stream_id: 'live-1',
        request_id: 'request-live',
        scope_type: 'chat_room',
        scope_id: 'room-live',
        status: 'streaming',
        last_seq: 10,
        last_event_type: 'stream.delta',
        actor_role: 'aiMediator',
        phase: 'thinking',
        message_id: null,
        backend_mode: 'redis',
        created_at: new Date('2026-04-04T10:00:00.000Z'),
        updated_at: new Date('2026-04-04T10:00:05.000Z'),
      },
    ]);
    mockAiStreamSessionArchiveCount.mockResolvedValueOnce(1);
    mockAiStreamSessionArchiveFindMany.mockResolvedValueOnce([
      {
        stream_id: 'archive-1',
        request_id: 'request-archive',
        scope_type: 'interview_session',
        scope_id: 'session-1',
        status: 'persisted',
        last_seq: 8,
        last_event_type: 'stream.persisted',
        actor_role: 'aiMediator',
        phase: 'completed',
        message_id: 'msg-1',
        backend_mode: 'redis',
        source_created_at: new Date('2026-04-01T10:00:00.000Z'),
        source_updated_at: new Date('2026-04-03T10:00:00.000Z'),
        archived_at: new Date('2026-04-04T00:00:00.000Z'),
      },
    ]);

    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: false });
    const result = await service.listPersistenceSessions({ source: 'all', limit: 20, offset: 0 });

    expect(result).toEqual(expect.objectContaining({
      source: 'all',
      total: 2,
    }));
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual(expect.objectContaining({ streamId: 'live-1', source: 'live' }));
    expect(result.items[1]).toEqual(expect.objectContaining({ streamId: 'archive-1', source: 'archive' }));
  });

  it('getPersistenceReport 應對一般 reports read 移除 failure message 與額外欄位', async () => {
    mockAiStreamSessionFindMany.mockResolvedValueOnce([
      {
        stream_id: 'failed-stream-1',
        request_id: 'failed-request-1',
        scope_type: 'interview_session',
        scope_id: 'session-1',
        status: 'failed',
        last_event_type: 'stream.failed',
        last_seq: 3,
        error: {
          code: 'INTERVIEW_STREAM_FAILED',
          message: 'private relationship narrative',
          retryable: true,
          metadata: { prompt: 'private prompt' },
        },
        updated_at: new Date('2026-07-12T10:00:02.000Z'),
      },
    ]);

    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: false });
    const result = await service.getPersistenceReport({ days: 7, limit: 10 });

    expect(result.recentFailures).toEqual([
      expect.objectContaining({
        error: {
          code: 'INTERVIEW_STREAM_FAILED',
          retryable: true,
        },
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('private relationship narrative');
    expect(JSON.stringify(result)).not.toContain('private prompt');
  });

  it('getStreamPersistenceDetail 預設應移除高敏文本、metadata 與 error message', async () => {
    mockAiStreamSessionFindUnique.mockResolvedValue({
      stream_id: 'stream-1',
      request_id: 'request-1',
      scope_type: 'interview_session',
      scope_id: 'session-1',
      status: 'persisted',
      last_seq: 2,
      last_event_type: 'stream.persisted',
      actor_role: 'aiMediator',
      text: 'private interview text',
      phase: 'completed',
      message_id: 'message-1',
      metadata: { prompt: 'private prompt' },
      error: {
        code: 'INTERVIEW_STREAM_FAILED',
        message: 'private session failure message',
        retryable: true,
        metadata: { prompt: 'private session prompt' },
      },
      backend_mode: 'redis',
      created_at: new Date('2026-07-12T10:00:00.000Z'),
      updated_at: new Date('2026-07-12T10:00:02.000Z'),
    });
    mockAiStreamEventFindMany.mockResolvedValue([
      {
        stream_id: 'stream-1',
        request_id: 'request-1',
        scope_type: 'interview_session',
        scope_id: 'session-1',
        seq: 1,
        event_type: 'stream.delta',
        actor_role: 'aiMediator',
        message_id: 'message-1',
        delta_text: 'private delta',
        full_text: 'private full text',
        phase: 'streaming',
        metadata: { private: true },
        error: {
          code: 'user supplied private error code',
          message: 'private event failure message',
          retryable: false,
          metadata: { prompt: 'private event prompt' },
        },
        created_at: new Date('2026-07-12T10:00:01.000Z'),
      },
    ]);

    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: false });
    const result = await service.getStreamPersistenceDetail('stream-1', { source: 'live' });

    expect(result).toEqual(expect.objectContaining({
      sensitiveContentIncluded: false,
      session: expect.objectContaining({
        text: null,
        metadata: null,
        error: { code: 'INTERVIEW_STREAM_FAILED', retryable: true },
      }),
      events: [expect.objectContaining({
        deltaText: null,
        fullText: null,
        metadata: null,
        error: { retryable: false },
      })],
    }));
    expect(JSON.stringify(result)).not.toContain('private session failure message');
    expect(JSON.stringify(result)).not.toContain('private event failure message');
    expect(JSON.stringify(result)).not.toContain('private session prompt');
    expect(JSON.stringify(result)).not.toContain('private event prompt');
    expect(JSON.stringify(result)).not.toContain('user supplied private error code');
  });

  it('getStreamPersistenceDetail 只在明確授權時返回高敏內容', async () => {
    mockAiStreamSessionFindUnique.mockResolvedValue({
      stream_id: 'stream-1',
      request_id: 'request-1',
      scope_type: 'chat_room',
      scope_id: 'room-1',
      status: 'persisted',
      last_seq: 2,
      last_event_type: 'stream.persisted',
      actor_role: 'aiMediator',
      text: 'private chat text',
      phase: 'completed',
      message_id: 'message-1',
      metadata: { private: true },
      error: {
        code: 'CHAT_STREAM_FAILED',
        message: 'private session failure message',
        retryable: true,
        metadata: { prompt: 'private session prompt' },
      },
      backend_mode: 'redis',
      created_at: new Date('2026-07-12T10:00:00.000Z'),
      updated_at: new Date('2026-07-12T10:00:02.000Z'),
    });
    mockAiStreamEventFindMany.mockResolvedValue([
      {
        stream_id: 'stream-1',
        request_id: 'request-1',
        scope_type: 'chat_room',
        scope_id: 'room-1',
        seq: 1,
        event_type: 'stream.delta',
        actor_role: 'aiMediator',
        message_id: 'message-1',
        delta_text: 'private delta',
        full_text: 'private full text',
        phase: 'streaming',
        metadata: { private: true },
        error: {
          code: 'CHAT_EVENT_FAILED',
          message: 'private event failure message',
          retryable: false,
          metadata: { prompt: 'private event prompt' },
        },
        created_at: new Date('2026-07-12T10:00:01.000Z'),
      },
    ]);

    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: false });
    const result = await service.getStreamPersistenceDetail('stream-1', {
      source: 'live',
      includeSensitive: true,
    });

    expect(result).toEqual(expect.objectContaining({
      sensitiveContentIncluded: true,
      session: expect.objectContaining({
        text: 'private chat text',
        metadata: { private: true },
        error: {
          code: 'CHAT_STREAM_FAILED',
          message: 'private session failure message',
          retryable: true,
          metadata: { prompt: 'private session prompt' },
        },
      }),
      events: [expect.objectContaining({
        deltaText: 'private delta',
        fullText: 'private full text',
        metadata: { private: true },
        error: {
          code: 'CHAT_EVENT_FAILED',
          message: 'private event failure message',
          retryable: false,
          metadata: { prompt: 'private event prompt' },
        },
      })],
    }));
  });
});
