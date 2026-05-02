import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PsychDomain } from '@prisma/client';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewTurn: {
      create: jest.fn(),
    },
    interviewSession: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../src/services/ai-stream.service', () => ({
  __esModule: true,
  aiStreamService: {
    completed: jest.fn(),
    persisted: jest.fn(),
    phase: jest.fn(),
  },
}));

import prisma from '../../../src/config/database';
import type { AIStreamHandle } from '../../../src/services/ai-stream.service';
import { aiStreamService } from '../../../src/services/ai-stream.service';
import { finalizeInterviewAIResponse } from '../../../src/services/interview-ai-response-finalizer';

const streamHandle: AIStreamHandle = {
  streamId: 'stream-1',
  requestId: 'request-1',
  scopeType: 'interview_session',
  scopeId: 's1',
};

describe('interview-ai-response-finalizer', () => {
  const mockedPrisma = prisma as any;
  const mockedAIStreamService = aiStreamService as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.interviewTurn.create.mockResolvedValue({ id: 'turn-ai-2' });
    mockedPrisma.interviewSession.update.mockResolvedValue({});
  });

  it('finalizeInterviewAIResponse 應保持 completed -> persist -> SSE/persisted 的完成順序', async () => {
    const onSSE = jest.fn();

    await finalizeInterviewAIResponse({
      onSSE,
      streamHandle,
      sessionId: 's1',
      status: 'in_progress',
      nextOrder: 2,
      text: '謝謝你願意說這些。',
      parsedMeta: {
        intent: 'deepening',
        target_domains: [PsychDomain.personality],
        should_end: false,
        safety_flag: false,
        key_facts: ['用戶來自澳門'],
      },
      collectedFacts: ['既有事實'],
      existingDomains: [PsychDomain.attachment],
      fallbackDomains: [PsychDomain.attachment],
      streamMode: 'respond',
    });

    expect(mockedAIStreamService.completed).toHaveBeenCalledWith(streamHandle, {
      actorRole: 'aiMediator',
      fullText: '謝謝你願意說這些。',
      phase: 'completed',
      metadata: { mode: 'respond' },
    });
    expect(mockedPrisma.interviewTurn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        session_id: 's1',
        turn_order: 2,
        ai_message: '謝謝你願意說這些。',
        ai_intent: 'deepening',
        ai_target_domains: [PsychDomain.personality],
        extracted_facts: ['用戶來自澳門'],
        safety_flag: false,
      }),
    });
    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: {
        domains_touched: [PsychDomain.attachment, PsychDomain.personality],
        total_ai_words: { increment: 1 },
        collected_facts: ['既有事實', '用戶來自澳門'],
      },
    });
    expect(onSSE).toHaveBeenNthCalledWith(1, expect.objectContaining({
      turn_order: 2,
      intent: 'deepening',
      domains_touched: [PsychDomain.attachment, PsychDomain.personality],
    }));
    expect(onSSE).toHaveBeenNthCalledWith(2, expect.objectContaining({
      session_id: 's1',
      status: 'in_progress',
      total_turns: 2,
    }));
    expect(mockedAIStreamService.persisted).toHaveBeenCalledWith(streamHandle, {
      actorRole: 'aiMediator',
      messageId: 'turn-ai-2',
      fullText: '謝謝你願意說這些。',
      phase: 'completed',
      metadata: {
        mode: 'respond',
        turnOrder: 2,
        shouldEnd: false,
        domainsTouched: [PsychDomain.attachment, PsychDomain.personality],
      },
    });

    expect(mockedAIStreamService.completed.mock.invocationCallOrder[0]).toBeLessThan(
      mockedPrisma.interviewTurn.create.mock.invocationCallOrder[0]
    );
    expect(mockedPrisma.interviewSession.update.mock.invocationCallOrder[0]).toBeLessThan(
      onSSE.mock.invocationCallOrder[0]
    );
    expect(onSSE.mock.invocationCallOrder[1]).toBeLessThan(
      mockedAIStreamService.persisted.mock.invocationCallOrder[0]
    );
  });

  it('finalizeInterviewAIResponse 無 streamHandle 時仍應落庫並發 SSE，但不寫 stream 終態', async () => {
    const onSSE = jest.fn();

    await finalizeInterviewAIResponse({
      onSSE,
      streamHandle: null,
      sessionId: 's1',
      status: 'in_progress',
      nextOrder: 2,
      text: '完成內容',
      parsedMeta: {
        intent: 'closing',
        target_domains: [],
      },
      collectedFacts: [],
      existingDomains: [PsychDomain.personality],
      streamMode: 'skip',
    });

    expect(mockedAIStreamService.completed).not.toHaveBeenCalled();
    expect(mockedAIStreamService.persisted).not.toHaveBeenCalled();
    expect(mockedPrisma.interviewTurn.create).toHaveBeenCalled();
    expect(mockedPrisma.interviewSession.update).toHaveBeenCalled();
    expect(onSSE).toHaveBeenCalledTimes(2);
  });
});
