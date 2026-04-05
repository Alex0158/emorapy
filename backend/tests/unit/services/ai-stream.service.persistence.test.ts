// @ts-nocheck
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUpsert = jest.fn();
const mockCreate = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    aiStreamSession: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    aiStreamEventRecord: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

describe('AIStreamService persistence', () => {
  beforeEach(() => {
    jest.resetModules();
    mockUpsert.mockReset();
    mockCreate.mockReset();
    mockUpsert.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(undefined);
  });

  it('應持久化 ai_stream_sessions 與非 heartbeat 事件', async () => {
    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: true });

    const handle = await service.createStream('chat_room', 'room-persist', '66666666-6666-4666-8666-666666666666');
    await service.start(handle, { actorRole: 'aiMediator', phase: 'thinking' });
    await service.delta(handle, 'Hello');
    await service.completed(handle, { fullText: 'Hello', phase: 'completed' });
    await service.persisted(handle, { fullText: 'Hello', messageId: 'msg-1', phase: 'completed' });

    expect(mockUpsert).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();

    const lastUpsertArg = mockUpsert.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(lastUpsertArg.where).toEqual({ stream_id: handle.streamId });
    expect(lastUpsertArg.update).toEqual(expect.objectContaining({
      request_id: handle.requestId,
      scope_type: 'chat_room',
      scope_id: 'room-persist',
      status: 'persisted',
      message_id: 'msg-1',
    }));

    const persistedEventArg = mockCreate.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(persistedEventArg.data).toEqual(expect.objectContaining({
      stream_id: handle.streamId,
      request_id: handle.requestId,
      scope_type: 'chat_room',
      scope_id: 'room-persist',
      event_type: 'stream.persisted',
      message_id: 'msg-1',
      full_text: 'Hello',
    }));
  });

  it('heartbeat 應只更新 session，不寫入 ai_stream_events', async () => {
    const { AIStreamService } = await import('../../../src/services/ai-stream.service');
    const service = new AIStreamService({ enabled: false, persistToDatabase: true });

    const handle = await service.createStream('chat_room', 'room-heartbeat-db', '77777777-7777-4777-8777-777777777777');
    await service.start(handle, { actorRole: 'aiMediator' });
    await service.heartbeat(handle);

    const heartbeatEventCalls = mockCreate.mock.calls.filter(
      (call) => (call[0] as Record<string, any>).data.event_type === 'stream.heartbeat'
    );

    expect(mockUpsert).toHaveBeenCalled();
    expect(heartbeatEventCalls).toHaveLength(0);
  });
});
