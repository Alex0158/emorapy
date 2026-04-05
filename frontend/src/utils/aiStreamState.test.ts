import { describe, expect, it } from 'vitest';
import { buildLocalDraft, draftFromSnapshot, reduceDraftWithEvent } from './aiStreamState';

describe('aiStreamState', () => {
  it('buildLocalDraft 在無 status 時應返回 null', () => {
    expect(buildLocalDraft({ text: 'hello', status: null })).toBeNull();
  });

  it('buildLocalDraft 應構造與共享 draft 契約一致的本地 draft', () => {
    expect(buildLocalDraft({ text: 'hello', status: 'thinking' })).toEqual({
      streamId: null,
      requestId: null,
      text: 'hello',
      status: 'thinking',
    });
  });

  it('draftFromSnapshot 在 completed 時應映射為 persisting', () => {
    expect(
      draftFromSnapshot({
        streamId: 'stream-1',
        requestId: 'req-1',
        scopeType: 'chat_room',
        scopeId: 'room-1',
        seq: 3,
        status: 'completed',
        text: 'done',
        updatedAt: new Date().toISOString(),
      })
    ).toEqual({
      streamId: 'stream-1',
      requestId: 'req-1',
      text: 'done',
      status: 'persisting',
    });
  });

  it('reduceDraftWithEvent 在 persisted 時應清空 draft', () => {
    expect(
      reduceDraftWithEvent(
        {
          streamId: 'stream-1',
          requestId: 'req-1',
          text: 'done',
          status: 'persisting',
        },
        {
          eventType: 'stream.persisted',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'chat_room',
          scopeId: 'room-1',
          seq: 4,
          createdAt: new Date().toISOString(),
        }
      )
    ).toBeNull();
  });

  it('draftFromSnapshot 在 keepCancelled=true 時應保留 cancelled draft', () => {
    expect(
      draftFromSnapshot(
        {
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'interview_session',
          scopeId: 'session-1',
          status: 'cancelled',
          lastSeq: 5,
          text: 'partial reply',
          updatedAt: new Date().toISOString(),
        },
        { keepCancelled: true }
      )
    ).toEqual({
      streamId: 'stream-1',
      requestId: 'req-1',
      text: 'partial reply',
      status: 'cancelled',
    });
  });

  it('reduceDraftWithEvent 在 keepCancelled=true 時應保留 cancelled 事件為 draft', () => {
    expect(
      reduceDraftWithEvent(
        {
          streamId: 'stream-1',
          requestId: 'req-1',
          text: 'partial',
          status: 'streaming',
        },
        {
          eventType: 'stream.cancelled',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'interview_session',
          scopeId: 'session-1',
          seq: 6,
          createdAt: new Date().toISOString(),
          fullText: 'partial',
        },
        { keepCancelled: true }
      )
    ).toEqual({
      streamId: 'stream-1',
      requestId: 'req-1',
      text: 'partial',
      status: 'cancelled',
    });
  });
});
