import { describe, expect, it } from '@jest/globals';
import {
  buildAIRequestLedgerRuntimeReport,
  parseAIRequestLedgerRuntimeArgs,
} from '../../../scripts/verify-ai-request-ledger-runtime';

describe('verify-ai-request-ledger-runtime', () => {
  it('accepts only a completed succeeded row with usage and allocated cost', () => {
    const report = buildAIRequestLedgerRuntimeReport({
      status: 'succeeded',
      completed_at: new Date('2026-07-13T10:00:00.000Z'),
      total_tokens: 42,
      cost_usd: '0.000123',
    }, '2026-07-13T10:01:00.000Z');

    expect(report).toEqual({
      ok: true,
      check: 'ai-request-ledger-runtime',
      matched: true,
      status: 'succeeded',
      completed: true,
      hasTokenUsage: true,
      hasAllocatedCost: true,
      reason: null,
      generatedAt: '2026-07-13T10:01:00.000Z',
    });
  });

  it.each([
    { row: null, reason: 'no_match' },
    { row: { status: 'started', completed_at: null, total_tokens: null, cost_usd: null }, reason: 'still_started' },
    { row: { status: 'failed', completed_at: new Date(), total_tokens: null, cost_usd: null }, reason: 'terminal_not_succeeded' },
    { row: { status: 'succeeded', completed_at: null, total_tokens: 42, cost_usd: '0.1' }, reason: 'missing_completed_at' },
    { row: { status: 'succeeded', completed_at: new Date(), total_tokens: 0, cost_usd: '0.1' }, reason: 'missing_token_usage' },
    { row: { status: 'succeeded', completed_at: new Date(), total_tokens: 42, cost_usd: null }, reason: 'missing_cost' },
  ])('rejects an incomplete runtime result with reason $reason', ({ row, reason }) => {
    expect(buildAIRequestLedgerRuntimeReport(row).reason).toBe(reason);
    expect(buildAIRequestLedgerRuntimeReport(row).ok).toBe(false);
  });

  it('parses exact-scope inputs without exposing the scope id in the report', () => {
    const options = parseAIRequestLedgerRuntimeArgs([
      '--scope-type=case_judgment',
      '--scope-id=private-synthetic-case-id',
      '--product-flow=quick_single',
      '--request-kind=judgment_draft',
      '--since=2026-07-13T10:00:00Z',
      '--timeout-ms=999999',
    ], {});
    const serializedReport = JSON.stringify(buildAIRequestLedgerRuntimeReport(null));

    expect(options.scopeId).toBe('private-synthetic-case-id');
    expect(options.productFlow).toBe('quick_single');
    expect(options.timeoutMs).toBe(300_000);
    expect(serializedReport).not.toContain(options.scopeId);
  });
});
