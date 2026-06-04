import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PsychDomain } from '@prisma/client';

jest.mock('../../../src/services/ai-stream.service', () => ({
  __esModule: true,
  aiStreamService: {
    phase: jest.fn(),
    persisted: jest.fn(),
  },
}));

import { aiStreamService } from '../../../src/services/ai-stream.service';
import type { AIStreamHandle } from '../../../src/services/ai-stream.service';
import { emitInterviewResponseSuccessEvents } from '../../../src/services/interview-response-success-events';

const streamHandle: AIStreamHandle = {
  streamId: 'stream-1',
  requestId: 'request-1',
  scopeType: 'interview_session',
  scopeId: 's1',
};

describe('interview-response-success-events', () => {
  const mockedAIStreamService = aiStreamService as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emitInterviewResponseSuccessEvents 無 safety 時應依序發送 metadata、complete、persisted', async () => {
    const onSSE = jest.fn();

    await emitInterviewResponseSuccessEvents({
      onSSE,
      streamHandle,
      sessionId: 's1',
      status: 'in_progress',
      nextOrder: 2,
      parsedMeta: {
        intent: 'deepening',
        target_domains: [PsychDomain.personality],
        should_end: true,
      },
      domainsTouched: [PsychDomain.attachment, PsychDomain.personality],
      createdTurnId: 'turn-ai-2',
      text: 'AI 回覆',
      streamMode: 'respond',
    });

    expect(onSSE).toHaveBeenNthCalledWith(1, {
      turn_order: 2,
      intent: 'deepening',
      target_domains: [PsychDomain.personality],
      domains_touched: [PsychDomain.attachment, PsychDomain.personality],
      total_turns: 2,
      should_end: true,
    });
    expect(onSSE).toHaveBeenNthCalledWith(2, {
      session_id: 's1',
      status: 'in_progress',
      total_turns: 2,
      domains_touched: [PsychDomain.attachment, PsychDomain.personality],
    });
    expect(mockedAIStreamService.phase).not.toHaveBeenCalled();
    expect(mockedAIStreamService.persisted).toHaveBeenCalledWith(streamHandle, {
      actorRole: 'aiMediator',
      messageId: 'turn-ai-2',
      fullText: 'AI 回覆',
      phase: 'completed',
      metadata: {
        mode: 'respond',
        turnOrder: 2,
        shouldEnd: true,
        domainsTouched: [PsychDomain.attachment, PsychDomain.personality],
      },
    });
    expect(onSSE.mock.invocationCallOrder[1]).toBeLessThan(
      mockedAIStreamService.persisted.mock.invocationCallOrder[0]
    );
  });

  it('emitInterviewResponseSuccessEvents 有 safety 時應維持 metadata、safety、phase、complete、persisted 順序', async () => {
    const onSSE = jest.fn();

    await emitInterviewResponseSuccessEvents({
      onSSE,
      streamHandle,
      sessionId: 's1',
      status: 'in_progress',
      nextOrder: 3,
      parsedMeta: {
        intent: 'safety_support',
        target_domains: [PsychDomain.life_events],
        safety_flag: true,
        safety_message: '觀察到自傷風險語句',
      },
      domainsTouched: [PsychDomain.life_events],
      createdTurnId: 'turn-ai-3',
      text: '我會先停下來陪你看這個部分。',
      streamMode: 'respond',
    });

    expect(onSSE).toHaveBeenNthCalledWith(1, expect.objectContaining({
      turn_order: 3,
      intent: 'safety_support',
    }));
    expect(onSSE).toHaveBeenNthCalledWith(2, {
      message: '系統偵測到安全風險，已先切換到安全支持回應。',
      severity: 'warning',
    });
    expect(mockedAIStreamService.phase).toHaveBeenCalledWith(
      streamHandle,
      'safety_alert',
      {
        actorRole: 'aiMediator',
        metadata: {
          message: '系統偵測到安全風險，已先切換到安全支持回應。',
          severity: 'warning',
        },
      }
    );
    expect(onSSE).toHaveBeenNthCalledWith(3, expect.objectContaining({
      session_id: 's1',
      total_turns: 3,
    }));
    expect(mockedAIStreamService.persisted).toHaveBeenCalledWith(
      streamHandle,
      expect.objectContaining({ messageId: 'turn-ai-3' })
    );

    const metadataOrder = onSSE.mock.invocationCallOrder[0];
    const safetyOrder = onSSE.mock.invocationCallOrder[1];
    const phaseOrder = mockedAIStreamService.phase.mock.invocationCallOrder[0];
    const completeOrder = onSSE.mock.invocationCallOrder[2];
    const persistedOrder = mockedAIStreamService.persisted.mock.invocationCallOrder[0];
    expect(metadataOrder).toBeLessThan(safetyOrder);
    expect(safetyOrder).toBeLessThan(phaseOrder);
    expect(phaseOrder).toBeLessThan(completeOrder);
    expect(completeOrder).toBeLessThan(persistedOrder);
  });

  it('emitInterviewResponseSuccessEvents 無 streamHandle 時只發送 SSE，不寫入 stream phase/persisted', async () => {
    const onSSE = jest.fn();

    await emitInterviewResponseSuccessEvents({
      onSSE,
      streamHandle: null,
      sessionId: 's1',
      status: 'in_progress',
      nextOrder: 4,
      parsedMeta: {
        safety_flag: true,
        safety_message: '安全提示',
      },
      locale: 'en-US',
      domainsTouched: [PsychDomain.attachment],
      createdTurnId: 'turn-ai-4',
      text: 'AI 回覆',
      streamMode: 'skip',
    });

    expect(onSSE).toHaveBeenCalledTimes(3);
    expect(onSSE).toHaveBeenNthCalledWith(2, {
      message: 'We detected a possible safety risk and switched to a safety-first response.',
      severity: 'warning',
    });
    expect(mockedAIStreamService.phase).not.toHaveBeenCalled();
    expect(mockedAIStreamService.persisted).not.toHaveBeenCalled();
  });
});
