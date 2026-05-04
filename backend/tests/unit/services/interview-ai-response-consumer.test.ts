import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../src/services/interview-ai-stream-request-utils', () => ({
  __esModule: true,
  createInterviewAIResponseStream: jest.fn(),
}));

import { createInterviewAIResponseStream } from '../../../src/services/interview-ai-stream-request-utils';
import { consumeInterviewAIResponseStream } from '../../../src/services/interview-ai-response-consumer';
import { aiRequestLedgerService } from '../../../src/services/ai-request-ledger.service';

function createStreamFromContent(chunks: Array<string | null | undefined>) {
  return (async function* () {
    for (const content of chunks) {
      yield {
        choices: [
          {
            delta: { content },
          },
        ],
      };
    }
  })();
}

describe('interview-ai-response-consumer', () => {
  const mockedCreateInterviewAIResponseStream = createInterviewAIResponseStream as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(aiRequestLedgerService, 'start').mockResolvedValue({ requestId: 'ledger-interview-1' });
    jest.spyOn(aiRequestLedgerService, 'complete').mockResolvedValue(undefined);
    jest.spyOn(aiRequestLedgerService, 'fail').mockResolvedValue(undefined);
  });

  it('consumeInterviewAIResponseStream 應消費 delimiter 格式回覆、發送正文 delta 並返回 parsedMeta', async () => {
    const emitTextDelta = jest.fn();
    const controller = new AbortController();
    mockedCreateInterviewAIResponseStream.mockResolvedValue(
      createStreamFromContent([
        '謝謝你願意說這些。---METADATA---{"intent":"deepening","target_domains":["personality"],"key_facts":["用戶來自澳門"]}',
      ])
    );

    await expect(
      consumeInterviewAIResponseStream({
        systemPrompt: 'system prompt',
        userPrompt: 'user prompt',
        signal: controller.signal,
        emitTextDelta,
      })
    ).resolves.toEqual({
      text: '謝謝你願意說這些。',
      parsedMeta: {
        intent: 'deepening',
        target_domains: ['personality'],
        key_facts: ['用戶來自澳門'],
      },
    });

    expect(mockedCreateInterviewAIResponseStream).toHaveBeenCalledWith({
      systemPrompt: 'system prompt',
      userPrompt: 'user prompt',
      signal: controller.signal,
    });
    expect(aiRequestLedgerService.start).toHaveBeenCalledWith(expect.objectContaining({
      productFlow: 'profile_interview',
      sourceChannel: 'profile_interview',
      entryPoint: 'interview_ai_response',
      requestKind: 'interview_ai_response',
      promptVersion: 'interview-ai-response@v1.0',
      metadata: expect.objectContaining({
        stream: true,
        prompt_chars: 'user prompt'.length,
      }),
    }));
    expect(aiRequestLedgerService.complete).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'ledger-interview-1',
    }));
    expect(emitTextDelta).toHaveBeenCalledTimes(1);
    expect(emitTextDelta).toHaveBeenCalledWith('謝謝你願意說這些。');
  });

  it('consumeInterviewAIResponseStream 應保留上層傳入的 ledger scope 並補齊預設歸因欄位', async () => {
    mockedCreateInterviewAIResponseStream.mockResolvedValue(
      createStreamFromContent(['{"text":"我聽到了。"}'])
    );

    await consumeInterviewAIResponseStream({
      systemPrompt: 'system',
      userPrompt: 'user',
      emitTextDelta: jest.fn(),
      ledger: {
        streamId: 'stream-1',
        scopeType: 'interview_session',
        scopeId: 'session-1',
        metadata: {
          parent_request_id: 'stream-request-1',
        },
      },
    });

    expect(aiRequestLedgerService.start).toHaveBeenCalledWith(expect.objectContaining({
      streamId: 'stream-1',
      scopeType: 'interview_session',
      scopeId: 'session-1',
      productFlow: 'profile_interview',
      sourceChannel: 'profile_interview',
      entryPoint: 'interview_ai_response',
      requestKind: 'interview_ai_response',
      promptVersion: 'interview-ai-response@v1.0',
      metadata: expect.objectContaining({
        parent_request_id: 'stream-request-1',
        stream: true,
        prompt_chars: 'user'.length,
      }),
    }));
  });

  it('consumeInterviewAIResponseStream 應在 JSON 格式回覆解析後補發 text delta', async () => {
    const emitTextDelta = jest.fn();
    mockedCreateInterviewAIResponseStream.mockResolvedValue(
      createStreamFromContent([
        '{"text":"我會陪你慢慢看這件事。","intent":"support","target_domains":["life_events"]}',
      ])
    );

    await expect(
      consumeInterviewAIResponseStream({
        systemPrompt: 'system',
        userPrompt: 'user',
        emitTextDelta,
      })
    ).resolves.toEqual({
      text: '我會陪你慢慢看這件事。',
      parsedMeta: {
        text: '我會陪你慢慢看這件事。',
        intent: 'support',
        target_domains: ['life_events'],
      },
    });

    expect(emitTextDelta).toHaveBeenCalledTimes(1);
    expect(emitTextDelta).toHaveBeenCalledWith('我會陪你慢慢看這件事。');
  });

  it('consumeInterviewAIResponseStream metadata JSON 解析失敗時應回報 warning 並保留正文', async () => {
    const emitTextDelta = jest.fn();
    const onParseWarning = jest.fn();
    mockedCreateInterviewAIResponseStream.mockResolvedValue(
      createStreamFromContent(['正文內容---METADATA---{bad json}'])
    );

    await expect(
      consumeInterviewAIResponseStream({
        systemPrompt: 'system',
        userPrompt: 'user',
        emitTextDelta,
        onParseWarning,
      })
    ).resolves.toEqual({
      text: '正文內容',
      parsedMeta: {},
    });

    expect(onParseWarning).toHaveBeenCalledWith('metadata_json_parse_failed');
    expect(emitTextDelta).toHaveBeenCalledWith('正文內容');
  });

  it('consumeInterviewAIResponseStream 空內容時應拋 AI_CALL_FAILED', async () => {
    mockedCreateInterviewAIResponseStream.mockResolvedValue(
      createStreamFromContent([undefined, ''])
    );

    await expect(
      consumeInterviewAIResponseStream({
        systemPrompt: 'system',
        userPrompt: 'user',
        emitTextDelta: jest.fn(),
      })
    ).rejects.toMatchObject({
      code: 'AI_CALL_FAILED',
      message: 'AI 返回空內容',
    });
  });
});
