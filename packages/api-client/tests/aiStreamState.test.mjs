import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  appendUniquePhase,
  buildLocalDraft,
  draftFromSnapshot,
  getLatestActiveAIStreamSnapshot,
  getLatestAIStreamSnapshot,
  isTerminalAIStreamEvent,
  isTerminalAIStreamStatus,
  reduceDraftWithEvent,
} from '../dist/index.js';

const now = '2026-05-12T00:00:00.000Z';

function snapshot(overrides) {
  return {
    streamId: 'stream-1',
    requestId: 'req-1',
    scopeType: 'chat_room',
    scopeId: 'room-1',
    status: 'streaming',
    lastSeq: 1,
    text: '',
    updatedAt: now,
    ...overrides,
  };
}

function event(overrides) {
  return {
    eventType: 'stream.delta',
    streamId: 'stream-1',
    requestId: 'req-1',
    scopeType: 'chat_room',
    scopeId: 'room-1',
    seq: 1,
    createdAt: now,
    ...overrides,
  };
}

describe('AI stream shared state helpers', () => {
  it('maps local and snapshot draft states for Web stream UIs', () => {
    assert.equal(buildLocalDraft({ text: 'hello', status: null }), null);
    assert.deepEqual(buildLocalDraft({ text: 'hello', status: 'thinking' }), {
      streamId: null,
      requestId: null,
      text: 'hello',
      status: 'thinking',
    });

    assert.deepEqual(draftFromSnapshot(snapshot({ status: 'completed', text: 'done' })), {
      streamId: 'stream-1',
      requestId: 'req-1',
      text: 'done',
      status: 'persisting',
    });

    assert.equal(draftFromSnapshot(snapshot({ status: 'cancelled', text: 'partial' })), null);
    assert.deepEqual(
      draftFromSnapshot(snapshot({ status: 'cancelled', text: 'partial' }), { keepCancelled: true }),
      {
        streamId: 'stream-1',
        requestId: 'req-1',
        text: 'partial',
        status: 'cancelled',
      }
    );
  });

  it('reduces delta, completed, persisted, failed, and cancelled events consistently', () => {
    const started = reduceDraftWithEvent(null, event({ eventType: 'stream.started' }));
    assert.deepEqual(started, {
      streamId: 'stream-1',
      requestId: 'req-1',
      text: '',
      status: 'thinking',
    });

    const streaming = reduceDraftWithEvent(started, event({ seq: 2, deltaText: 'hi' }));
    assert.deepEqual(streaming, {
      streamId: 'stream-1',
      requestId: 'req-1',
      text: 'hi',
      status: 'streaming',
    });

    assert.deepEqual(
      reduceDraftWithEvent(streaming, event({ eventType: 'stream.completed', seq: 3, fullText: 'hi done' })),
      {
        streamId: 'stream-1',
        requestId: 'req-1',
        text: 'hi done',
        status: 'persisting',
      }
    );

    assert.equal(reduceDraftWithEvent(streaming, event({ eventType: 'stream.persisted', seq: 4 })), null);
    assert.equal(reduceDraftWithEvent(streaming, event({ eventType: 'stream.failed', seq: 4 })), null);
    assert.equal(reduceDraftWithEvent(streaming, event({ eventType: 'stream.cancelled', seq: 4 })), null);
    assert.deepEqual(
      reduceDraftWithEvent(streaming, event({ eventType: 'stream.cancelled', seq: 4 }), { keepCancelled: true }),
      {
        streamId: 'stream-1',
        requestId: 'req-1',
        text: 'hi',
        status: 'cancelled',
      }
    );
  });

  it('preserves existing draft text when receiving an unrelated stream event', () => {
    const draft = {
      streamId: 'stream-1',
      requestId: 'req-1',
      text: 'existing',
      status: 'streaming',
    };

    assert.equal(
      reduceDraftWithEvent(draft, event({ streamId: 'stream-2', requestId: 'req-2', deltaText: 'new' })),
      draft
    );
    assert.equal(
      reduceDraftWithEvent(draft, event({ streamId: 'stream-2', requestId: 'req-2', eventType: 'stream.completed' })),
      draft
    );
  });

  it('provides App snapshot selection and terminal-state helpers', () => {
    assert.equal(isTerminalAIStreamStatus('persisted'), true);
    assert.equal(isTerminalAIStreamStatus('failed'), true);
    assert.equal(isTerminalAIStreamStatus('cancelled'), true);
    assert.equal(isTerminalAIStreamStatus('streaming'), false);
    assert.equal(isTerminalAIStreamEvent(event({ eventType: 'stream.persisted' })), true);
    assert.equal(isTerminalAIStreamEvent(event({ eventType: 'stream.delta' })), false);

    const snapshots = [
      snapshot({ streamId: 'old', lastSeq: 2, status: 'streaming' }),
      snapshot({ streamId: 'new-terminal', lastSeq: 9, status: 'persisted' }),
      snapshot({ streamId: 'new-active', lastSeq: 7, status: 'completed' }),
    ];

    assert.equal(getLatestAIStreamSnapshot(snapshots)?.streamId, 'new-terminal');
    assert.equal(getLatestActiveAIStreamSnapshot(snapshots)?.streamId, 'new-active');
    assert.equal(getLatestAIStreamSnapshot([]), null);
    assert.equal(getLatestActiveAIStreamSnapshot([snapshot({ status: 'failed' })]), null);
  });

  it('appends stream phases without duplicates', () => {
    assert.deepEqual(appendUniquePhase(['thinking'], 'thinking'), ['thinking']);
    assert.deepEqual(appendUniquePhase(['thinking'], 'drafting_judgment'), ['thinking', 'drafting_judgment']);
    assert.deepEqual(appendUniquePhase(['thinking'], null), ['thinking']);
  });
});
