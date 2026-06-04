import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../src/services/ai-stream.service', () => ({
  __esModule: true,
  aiStreamService: {
    cancelled: jest.fn(),
    failed: jest.fn(),
  },
}));

import { aiStreamService } from '../../../src/services/ai-stream.service';
import type { AIStreamHandle } from '../../../src/services/ai-stream.service';
import {
  settleInterviewResponseCancellation,
  settleInterviewResponseError,
  settleInterviewResponseFailure,
} from '../../../src/services/interview-response-settlement';

const streamHandle: AIStreamHandle = {
  streamId: 'stream-1',
  requestId: 'request-1',
  scopeType: 'interview_session',
  scopeId: 's1',
};

describe('interview-response-settlement', () => {
  const mockedAIStreamService = aiStreamService as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('settleInterviewResponseCancellation 應發送 stream.cancelled 並保留 latestText', async () => {
    await expect(
      settleInterviewResponseCancellation({
        streamHandle,
        streamSettled: false,
        streamMode: 'respond',
        latestText: '已生成內容',
      })
    ).resolves.toBe(true);

    expect(mockedAIStreamService.cancelled).toHaveBeenCalledWith(streamHandle, {
      actorRole: 'aiMediator',
      fullText: '已生成內容',
      metadata: {
        reason: 'client_abort',
        mode: 'respond',
      },
    });
  });

  it('settleInterviewResponseCancellation 已 settled 或無 streamHandle 時不重複寫終態', async () => {
    await expect(
      settleInterviewResponseCancellation({
        streamHandle,
        streamSettled: true,
        streamMode: 'respond',
      })
    ).resolves.toBe(true);
    await expect(
      settleInterviewResponseCancellation({
        streamHandle: null,
        streamSettled: false,
        streamMode: 'respond',
      })
    ).resolves.toBe(false);

    expect(mockedAIStreamService.cancelled).not.toHaveBeenCalled();
  });

  it('settleInterviewResponseFailure 應發送 stream.failed，保留 code 並本地化 message', async () => {
    const error = Object.assign(new Error('db write failed'), { code: 'DB_WRITE_FAILED' });

    await expect(
      settleInterviewResponseFailure({
        error,
        streamHandle,
        streamSettled: false,
        streamMode: 'respond',
        latestText: '已完成文字',
        locale: 'en-US',
      })
    ).resolves.toBe(true);

    expect(mockedAIStreamService.failed).toHaveBeenCalledWith(
      streamHandle,
      { code: 'DB_WRITE_FAILED', message: 'Internal service error' },
      {
        actorRole: 'aiMediator',
        fullText: '已完成文字',
        metadata: { mode: 'respond' },
      }
    );
  });

  it('settleInterviewResponseError 遇到 AbortError 應取消 stream 並要求上層 return', async () => {
    const abortError = Object.assign(new Error('aborted by client'), { name: 'AbortError' });

    await expect(
      settleInterviewResponseError({
        error: abortError,
        streamHandle,
        streamSettled: false,
        streamMode: 'skip',
      })
    ).resolves.toEqual({
      streamSettled: true,
      shouldReturn: true,
    });

    expect(mockedAIStreamService.cancelled).toHaveBeenCalledWith(
      streamHandle,
      expect.objectContaining({
        actorRole: 'aiMediator',
        metadata: { reason: 'client_abort', mode: 'skip' },
      })
    );
    expect(mockedAIStreamService.failed).not.toHaveBeenCalled();
  });

  it('settleInterviewResponseError 非 abort 錯誤應標記 failed 並回傳原錯', async () => {
    const error = Object.assign(new Error('provider down'), { code: 'AI_PROVIDER_DOWN' });

    await expect(
      settleInterviewResponseError({
        error,
        streamHandle,
        streamSettled: false,
        streamMode: 'respond',
        locale: 'en-US',
      })
    ).resolves.toEqual({
      streamSettled: true,
      shouldReturn: false,
      errorToThrow: error,
    });

    expect(mockedAIStreamService.failed).toHaveBeenCalledWith(
      streamHandle,
      { code: 'AI_PROVIDER_DOWN', message: 'Internal service error' },
      expect.objectContaining({
        actorRole: 'aiMediator',
        metadata: { mode: 'respond' },
      })
    );
  });

  it('settleInterviewResponseError 應把 lock conflict 映射為 CONCURRENT_REQUEST', async () => {
    const error = Object.assign(new Error('正在進行中'), { code: 'CONFLICT' });

    const result = await settleInterviewResponseError({
      error,
      streamHandle: null,
      streamSettled: false,
      streamMode: 'respond',
    });

    expect(result.streamSettled).toBe(false);
    expect(result.shouldReturn).toBe(false);
    expect(result.errorToThrow).toMatchObject({
      code: 'CONCURRENT_REQUEST',
      statusCode: 409,
    });
    expect(mockedAIStreamService.failed).not.toHaveBeenCalled();
  });
});
