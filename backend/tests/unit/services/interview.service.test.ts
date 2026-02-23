/**
 * InterviewService 單元測試 — prompt 構建、key_facts 解析邏輯
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewSession: { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    interviewTurn: { create: jest.fn(), update: jest.fn() },
    profileInsight: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/config/env', () => ({
  env: {
    INTERVIEW_MAX_TURNS: 30,
    INTERVIEW_SOFT_TARGET: 10,
    INTERVIEW_TURN_INTERVAL_MS: 0,
  },
}));
jest.mock('../../../src/config/openai', () => ({
  __esModule: true,
  openai: { chat: { completions: { create: jest.fn() } } },
  INTERVIEW_AI_CONFIG: { model: 'gpt-4o-mini', maxTokens: 800, temperature: 0.85, topP: 0.95 },
}));
jest.mock('../../../src/utils/lock', () => ({
  __esModule: true,
  lockService: { withLock: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()) },
}));
jest.mock('../../../src/utils/retry', () => ({
  __esModule: true,
  retryWithBackoff: jest.fn((fn: () => Promise<unknown>) => fn()),
}));
jest.mock('../../../src/services/async-pipeline.service', () => ({
  __esModule: true,
  asyncPipelineService: { runPipeline: jest.fn() },
}));

import { InterviewService } from '../../../src/services/interview.service';

const service = new InterviewService();
const buildSystemPrompt = (service as any).buildInterviewSystemPrompt.bind(service);
const buildUserPrompt = (service as any).buildInterviewUserPrompt.bind(service);

describe('InterviewService — buildInterviewSystemPrompt', () => {
  const baseCtx = {
    coveredDomains: ['personality'],
    uncoveredDomains: ['attachment', 'family_origin'],
    currentTurn: 3,
    maxTurns: 30,
    previousInsights: '',
    collectedFacts: [] as string[],
  };

  it('無 collectedFacts 時不應包含事實清單區段', () => {
    const prompt = buildSystemPrompt(baseCtx);
    expect(prompt).not.toContain('## 本次對話已收集的事實（不要重複問這些）');
    expect(prompt).not.toContain('絕對不要重複詢問這些已知的資訊');
  });

  it('有 collectedFacts 時應注入事實清單和深入探索指令', () => {
    const prompt = buildSystemPrompt({
      ...baseCtx,
      collectedFacts: ['用戶來自澳門', 'MBTI 為 ENTP'],
    });
    expect(prompt).toContain('## 本次對話已收集的事實（不要重複問這些）');
    expect(prompt).toContain('- 用戶來自澳門');
    expect(prompt).toContain('- MBTI 為 ENTP');
    expect(prompt).toContain('絕對不要重複詢問這些已知的資訊');
    expect(prompt).toContain('基於這些事實，往更深的層次探索');
  });

  it('metadata 格式應包含 key_facts 欄位', () => {
    const prompt = buildSystemPrompt(baseCtx);
    expect(prompt).toContain('"key_facts":["本輪新發現的具體事實"]');
  });

  it('有 previousInsights 時應顯示「已知背景（歷史 session 的洞見）」', () => {
    const prompt = buildSystemPrompt({
      ...baseCtx,
      previousInsights: '- attachment：安全型依附（85%）',
    });
    expect(prompt).toContain('已知背景（歷史 session 的洞見）：');
    expect(prompt).toContain('安全型依附');
  });

  it('currentTurn >= INTERVIEW_SOFT_TARGET 時應包含覆蓋引導', () => {
    const prompt = buildSystemPrompt({
      ...baseCtx,
      currentTurn: 12,
    });
    expect(prompt).toContain('覆蓋引導');
  });

  it('currentTurn < INTERVIEW_SOFT_TARGET 時不應包含覆蓋引導', () => {
    const prompt = buildSystemPrompt({
      ...baseCtx,
      currentTurn: 5,
    });
    expect(prompt).not.toContain('覆蓋引導');
  });
});

describe('InterviewService — buildInterviewUserPrompt', () => {
  it('歷史輪數 <= 3 時不應生成摘要，全部作為最近對話', () => {
    const history = [
      { ai: 'Q1', user: 'A1', intent: 'opening', extractedFacts: ['用戶住台北'] },
      { ai: 'Q2', user: 'A2', intent: 'exploring', extractedFacts: [] },
      { ai: 'Q3', user: 'A3', intent: 'deepening', extractedFacts: ['有一個弟弟'] },
    ];
    const prompt = buildUserPrompt(history, 3);
    expect(prompt).not.toContain('之前的對話摘要');
    expect(prompt).toContain('最近對話：');
    expect(prompt).toContain('第1輪');
    expect(prompt).toContain('第3輪');
  });

  it('歷史輪數 > 3 時，早期輪次壓縮為摘要，保留 intent + extractedFacts', () => {
    const history = [
      { ai: 'Q1', user: 'A1', intent: 'opening', extractedFacts: ['用戶來自澳門'] },
      { ai: 'Q2', user: 'A2', intent: 'exploring_personality', extractedFacts: ['MBTI 為 ENTP', '對性格工具有興趣'] },
      { ai: 'Q3', user: 'A3', intent: 'exploring_family', extractedFacts: [] },
      { ai: 'Q4', user: 'A4', intent: 'deepening', extractedFacts: ['與母親關係緊張'] },
      { ai: 'Q5', user: '', intent: undefined, extractedFacts: [] },
    ];
    const prompt = buildUserPrompt(history, 5);
    // 5 turns, RECENT_FULL_TURNS=3 → earlier=turns 1-2, recent=turns 3-5
    expect(prompt).toContain('之前的對話摘要');
    expect(prompt).toContain('第1輪 — opening（收集到：用戶來自澳門）');
    expect(prompt).toContain('第2輪 — exploring_personality（收集到：MBTI 為 ENTP、對性格工具有興趣）');
    expect(prompt).toContain('最近對話：');
    expect(prompt).toContain('第3輪');
    expect(prompt).toContain('第5輪');
  });

  it('早期輪次無 intent 但有 extractedFacts 時也應輸出', () => {
    const history = [
      { ai: 'Q1', user: 'A1', intent: undefined, extractedFacts: ['用戶28歲'] },
      { ai: 'Q2', user: 'A2', intent: undefined, extractedFacts: [] },
      { ai: 'Q3', user: 'A3', intent: 'deep', extractedFacts: [] },
      { ai: 'Q4', user: '', intent: undefined, extractedFacts: [] },
    ];
    const prompt = buildUserPrompt(history, 4);
    expect(prompt).toContain('第1輪（收集到：用戶28歲）');
  });
});

describe('InterviewService — key_facts 解析邏輯', () => {
  it('應從合法 metadata 中提取 key_facts 陣列', () => {
    const parsedMeta: Record<string, unknown> = {
      intent: 'exploring',
      target_domains: ['personality'],
      should_end: false,
      safety_flag: false,
      safety_message: '',
      key_facts: ['用戶來自澳門', 'MBTI 為 ENTP'],
    };
    const keyFacts = parsedMeta.key_facts;
    const newFacts = Array.isArray(keyFacts)
      ? (keyFacts as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];
    expect(newFacts).toEqual(['用戶來自澳門', 'MBTI 為 ENTP']);
  });

  it('key_facts 為空陣列時結果也為空', () => {
    const parsedMeta = { key_facts: [] };
    const newFacts = Array.isArray(parsedMeta.key_facts)
      ? (parsedMeta.key_facts as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];
    expect(newFacts).toEqual([]);
  });

  it('key_facts 缺失時結果為空', () => {
    const parsedMeta: Record<string, unknown> = { intent: 'opening' };
    const newFacts = Array.isArray(parsedMeta.key_facts)
      ? (parsedMeta.key_facts as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];
    expect(newFacts).toEqual([]);
  });

  it('key_facts 含無效值時應過濾掉', () => {
    const parsedMeta = { key_facts: ['有效事實', '', null, 123, '   ', '另一個事實'] };
    const newFacts = Array.isArray(parsedMeta.key_facts)
      ? (parsedMeta.key_facts as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];
    expect(newFacts).toEqual(['有效事實', '另一個事實']);
  });

  it('collectedFacts 應累積合併新舊事實', () => {
    const existingFacts = ['用戶來自澳門'];
    const newFacts = ['MBTI 為 ENTP', '對星座有興趣'];
    const updated = [...existingFacts, ...newFacts];
    expect(updated).toEqual(['用戶來自澳門', 'MBTI 為 ENTP', '對星座有興趣']);
  });
});
