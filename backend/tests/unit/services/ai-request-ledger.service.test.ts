import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockUpsert = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockLogger = { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.mock('../../../src/config/env', () => ({
  env: { NODE_ENV: 'test' },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

jest.mock('../../../src/config/openai', () => ({
  AI_CONFIG: { model: 'gpt-4o-mini' },
}));

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    aiRequestLedger: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { AIRequestLedgerService } from '../../../src/services/ai-request-ledger.service';

describe('AIRequestLedgerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
  });

  it('starts a ledger row without prompt content and sanitizes metadata', async () => {
    const service = new AIRequestLedgerService({ enabled: true });

    const result = await service.start({
      requestId: 'req-1',
      streamId: 'stream-1',
      scopeType: 'case_judgment',
      scopeId: 'case-1',
      productFlow: 'formal_remote',
      model: 'gpt-4.1',
      requestKind: 'judgment_draft',
      metadata: {
        prompt_chars: 1234,
        nested: { keep: true, drop: undefined },
      },
    });

    expect(result.requestId).toBe('req-1');
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { request_id: 'req-1' },
      create: expect.objectContaining({
        request_id: 'req-1',
        stream_id: 'stream-1',
        scope_type: 'case_judgment',
        scope_id: 'case-1',
        product_flow: 'formal_remote',
        model: 'gpt-4.1',
        request_kind: 'judgment_draft',
        metadata: {
          prompt_chars: 1234,
          nested: { keep: true },
        },
      }),
    }));
  });

  it('completes a ledger row with token usage and retry count', async () => {
    const service = new AIRequestLedgerService({ enabled: true });

    await service.complete({
      requestId: 'req-2',
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      retryCount: 1,
    });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { request_id: 'req-2' },
      data: expect.objectContaining({
        status: 'succeeded',
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
        retry_count: 1,
        failure_reason: null,
        completed_at: expect.any(Date),
      }),
    }));
  });

  it('fails open when persistence is unavailable', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('db unavailable'));
    const service = new AIRequestLedgerService({ enabled: true });

    await expect(service.fail({
      requestId: 'req-3',
      failureReason: 'timeout',
    })).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'AI request ledger finish failed',
      expect.objectContaining({ requestId: 'req-3' })
    );
  });
});
