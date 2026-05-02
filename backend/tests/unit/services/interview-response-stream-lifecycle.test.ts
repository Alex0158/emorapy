import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../src/services/ai-stream.service', () => ({
  __esModule: true,
  aiStreamService: {
    createStream: jest.fn(),
    start: jest.fn(),
    delta: jest.fn(),
    cancelled: jest.fn(),
  },
}));

import type { AIStreamHandle } from '../../../src/services/ai-stream.service';
import { aiStreamService } from '../../../src/services/ai-stream.service';
import {
  createInterviewResponseTextDeltaEmitter,
  startInterviewResponseStreamLifecycle,
} from '../../../src/services/interview-response-stream-lifecycle';

const streamHandle: AIStreamHandle = {
  streamId: 'stream-1',
  requestId: 'request-1',
  scopeType: 'interview_session',
  scopeId: 's1',
};

describe('interview-response-stream-lifecycle', () => {
  const mockedAIStreamService = aiStreamService as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAIStreamService.createStream.mockResolvedValue(streamHandle);
  });

  it('startInterviewResponseStreamLifecycle 應建立 stream、發送 start payload 並返回 delta emitter', async () => {
    const sseEvents: string[] = [];
    const latestTextDeltas: string[] = [];

    const lifecycle = await startInterviewResponseStreamLifecycle({
      sessionId: 's1',
      streamMode: 'respond',
      currentTurn: 3,
      streamSettled: false,
      onSSE: (event) => sseEvents.push(event.text),
      onLatestTextDelta: (delta) => latestTextDeltas.push(delta),
    });

    expect(mockedAIStreamService.createStream).toHaveBeenCalledWith('interview_session', 's1');
    expect(mockedAIStreamService.start).toHaveBeenCalledWith(streamHandle, {
      actorRole: 'aiMediator',
      phase: 'thinking',
      metadata: {
        mode: 'respond',
        currentTurn: 3,
      },
    });
    expect(lifecycle).toMatchObject({
      streamHandle,
      streamSettled: false,
      shouldReturn: false,
    });

    lifecycle.emitTextDelta('你好');

    expect(latestTextDeltas).toEqual(['你好']);
    expect(sseEvents).toEqual(['你好']);
    expect(mockedAIStreamService.delta).toHaveBeenCalledWith(
      streamHandle,
      '你好',
      { actorRole: 'aiMediator' }
    );
  });

  it('startInterviewResponseStreamLifecycle signal 已 abort 時應寫 cancelled 並要求上層 return', async () => {
    const controller = new AbortController();
    controller.abort();
    const onSSE = jest.fn();
    const onLatestTextDelta = jest.fn();

    const lifecycle = await startInterviewResponseStreamLifecycle({
      sessionId: 's1',
      streamMode: 'skip',
      currentTurn: 4,
      streamSettled: false,
      signal: controller.signal,
      onSSE,
      onLatestTextDelta,
    });

    expect(lifecycle).toMatchObject({
      streamHandle,
      streamSettled: true,
      shouldReturn: true,
    });
    expect(mockedAIStreamService.cancelled).toHaveBeenCalledWith(streamHandle, {
      actorRole: 'aiMediator',
      fullText: undefined,
      metadata: {
        reason: 'client_abort',
        mode: 'skip',
      },
    });

    lifecycle.emitTextDelta('不應發送');
    expect(onSSE).not.toHaveBeenCalled();
    expect(onLatestTextDelta).not.toHaveBeenCalled();
    expect(mockedAIStreamService.delta).not.toHaveBeenCalled();
  });

  it('createInterviewResponseTextDeltaEmitter 空 delta 不應發送任何事件', () => {
    const onSSE = jest.fn();
    const onLatestTextDelta = jest.fn();
    const emitTextDelta = createInterviewResponseTextDeltaEmitter({
      streamHandle,
      onSSE,
      onLatestTextDelta,
    });

    emitTextDelta('');

    expect(onSSE).not.toHaveBeenCalled();
    expect(onLatestTextDelta).not.toHaveBeenCalled();
    expect(mockedAIStreamService.delta).not.toHaveBeenCalled();
  });
});
