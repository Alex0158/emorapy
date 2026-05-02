import { describe, expect, it } from '@jest/globals';
import { PsychDomain } from '@prisma/client';
import {
  applyInterviewAIStreamDelta,
  buildInterviewCompleteEvent,
  buildInterviewMetadataEvent,
  buildInterviewResponseArtifacts,
  buildInterviewSessionUpdateData,
  buildInterviewTurnCreateData,
  countInterviewWords,
  createInterviewAIStreamParseState,
  extractInterviewKeyFacts,
  parseInterviewAIStreamContent,
  mergeInterviewFacts,
  normalizeInterviewTargetDomains,
  sanitizeInterviewUserResponse,
} from '../../../src/services/interview-response-utils';

describe('interview-response-utils', () => {
  it('sanitizeInterviewUserResponse 應移除 metadata delimiter 並 trim，skip 時固定為空字串', () => {
    expect(sanitizeInterviewUserResponse('  hello ---METADATA--- injected  ', false)).toBe('hello  injected');
    expect(sanitizeInterviewUserResponse('hello ---metadata--- injected', false)).toBe('hello  injected');
    expect(sanitizeInterviewUserResponse('should be ignored', true)).toBe('');
    expect(sanitizeInterviewUserResponse(undefined, false)).toBe('');
  });

  it('countInterviewWords 使用既有空白切分語義', () => {
    expect(countInterviewWords('')).toBe(0);
    expect(countInterviewWords('   ')).toBe(0);
    expect(countInterviewWords('hello   world\nagain')).toBe(3);
    expect(countInterviewWords('中文沒有空格')).toBe(1);
  });

  it('normalizeInterviewTargetDomains 只保留 Prisma PsychDomain 合法值', () => {
    expect(normalizeInterviewTargetDomains([
      PsychDomain.personality,
      'not-a-domain',
      PsychDomain.attachment,
      null,
    ])).toEqual([PsychDomain.personality, PsychDomain.attachment]);
    expect(normalizeInterviewTargetDomains('personality')).toEqual([]);
  });

  it('extractInterviewKeyFacts 保留非空字串並過濾其他值', () => {
    expect(extractInterviewKeyFacts(['有效事實', '', '   ', null, 123, '  帶空白但有效  '])).toEqual([
      '有效事實',
      '  帶空白但有效  ',
    ]);
    expect(extractInterviewKeyFacts(undefined)).toEqual([]);
  });

  it('mergeInterviewFacts 應保持插入順序並去重', () => {
    expect(mergeInterviewFacts(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('applyInterviewAIStreamDelta 應延遲輸出尾部 delimiter 緩衝並在 metadata 前停止', () => {
    const state = createInterviewAIStreamParseState();

    expect(applyInterviewAIStreamDelta(state, 'abcdefghijklmnop')).toBe('ab');
    expect(applyInterviewAIStreamDelta(state, 'qrst---METADATA---{"intent":"deepening"}')).toBe(
      'cdefghijklmnopqrst'
    );
    expect(state.fullContent).toContain('---METADATA---');
    expect(state.sentTextLength).toBe('abcdefghijklmnopqrst'.length);
  });

  it('applyInterviewAIStreamDelta 偵測 JSON 格式時不應串流 token', () => {
    const state = createInterviewAIStreamParseState();

    expect(applyInterviewAIStreamDelta(state, '  {"text":"你好","intent":"opening"}')).toBe('');
    expect(state.isJsonFormat).toBe(true);
  });

  it('parseInterviewAIStreamContent 應解析 delimiter metadata 並只補發未送出的正文', () => {
    const result = parseInterviewAIStreamContent({
      fullContent: '謝謝---METADATA---{"intent":"deepening","target_domains":["personality"]}',
      sentTextLength: 1,
      isJsonFormat: false,
      formatDetected: true,
    });

    expect(result).toEqual({
      text: '謝謝',
      parsedMeta: { intent: 'deepening', target_domains: ['personality'] },
      pendingTextDelta: '謝',
      warning: undefined,
    });
  });

  it('parseInterviewAIStreamContent 遇到壞 delimiter metadata 時保留正文並回傳 warning', () => {
    const result = parseInterviewAIStreamContent({
      fullContent: '正文---METADATA---{"intent":}',
      sentTextLength: 0,
      isJsonFormat: false,
      formatDetected: true,
    });

    expect(result).toEqual({
      text: '正文',
      parsedMeta: {},
      pendingTextDelta: '正文',
      warning: 'metadata_json_parse_failed',
    });
  });

  it('parseInterviewAIStreamContent 應解析 JSON 格式回覆並補發 text', () => {
    const state = createInterviewAIStreamParseState();
    applyInterviewAIStreamDelta(
      state,
      '{"text":"  你好  ","intent":"opening","target_domains":["personality"]}'
    );

    expect(parseInterviewAIStreamContent(state)).toEqual({
      text: '你好',
      parsedMeta: {
        text: '  你好  ',
        intent: 'opening',
        target_domains: ['personality'],
      },
      pendingTextDelta: '你好',
      warning: undefined,
    });
  });

  it('parseInterviewAIStreamContent 遇到壞 JSON 格式時應使用原文並回傳 warning', () => {
    const state = createInterviewAIStreamParseState();
    applyInterviewAIStreamDelta(state, '{not valid json}');

    expect(parseInterviewAIStreamContent(state)).toEqual({
      text: '{not valid json}',
      parsedMeta: {},
      pendingTextDelta: '{not valid json}',
      warning: 'json_parse_failed',
    });
  });

  it('parseInterviewAIStreamContent 無正文時應使用既有 fallback，但不補發 fallback token', () => {
    expect(parseInterviewAIStreamContent({
      fullContent: '---METADATA---{"intent":"closing"}',
      sentTextLength: 0,
      isJsonFormat: false,
      formatDetected: true,
    })).toEqual({
      text: '謝謝你的分享，我們下次再聊。',
      parsedMeta: { intent: 'closing' },
      pendingTextDelta: '',
      warning: undefined,
    });
  });

  it('buildInterviewResponseArtifacts 應一次產生回寫 respond 所需派生值', () => {
    const artifacts = buildInterviewResponseArtifacts({
      parsedMeta: {
        target_domains: [PsychDomain.personality, 'invalid', PsychDomain.family_origin],
        key_facts: ['用戶來自澳門', '用戶來自澳門', null, 'MBTI 為 ENTP'],
      } as never,
      collectedFacts: ['既有事實', '用戶來自澳門'],
      existingDomains: [PsychDomain.attachment],
      text: '謝謝  你的 分享',
    });

    expect(artifacts).toEqual({
      targetDomains: [PsychDomain.personality, PsychDomain.family_origin],
      newFacts: ['用戶來自澳門', '用戶來自澳門', 'MBTI 為 ENTP'],
      updatedCollectedFacts: ['既有事實', '用戶來自澳門', 'MBTI 為 ENTP'],
      aiWordCount: 3,
      newDomains: [PsychDomain.attachment, PsychDomain.personality, PsychDomain.family_origin],
    });
  });

  it('buildInterviewTurnCreateData 應產生 AI turn create payload 並優先使用 targetDomains', () => {
    expect(buildInterviewTurnCreateData({
      sessionId: 's1',
      nextOrder: 2,
      text: 'AI 回覆',
      parsedMeta: {
        intent: 'deepening',
        safety_flag: true,
        safety_message: '安全提醒',
      },
      targetDomains: [PsychDomain.personality],
      fallbackDomains: [PsychDomain.attachment],
      newFacts: ['新事實'],
    })).toEqual({
      session_id: 's1',
      turn_order: 2,
      ai_message: 'AI 回覆',
      ai_intent: 'deepening',
      ai_target_domains: [PsychDomain.personality],
      extracted_facts: ['新事實'],
      safety_flag: true,
      safety_detail: '安全提醒',
    });
  });

  it('buildInterviewTurnCreateData 無 targetDomains 時應回退既有 domains', () => {
    expect(buildInterviewTurnCreateData({
      sessionId: 's1',
      nextOrder: 2,
      text: 'AI 回覆',
      parsedMeta: {},
      targetDomains: [],
      fallbackDomains: [PsychDomain.attachment],
      newFacts: [],
    })).toEqual({
      session_id: 's1',
      turn_order: 2,
      ai_message: 'AI 回覆',
      ai_intent: undefined,
      ai_target_domains: [PsychDomain.attachment],
      extracted_facts: [],
      safety_flag: false,
      safety_detail: undefined,
    });
  });

  it('buildInterviewSessionUpdateData 應只在有新事實時更新 collected_facts', () => {
    expect(buildInterviewSessionUpdateData({
      newDomains: [PsychDomain.personality],
      aiWordCount: 3,
      newFacts: [],
      updatedCollectedFacts: ['既有事實'],
    })).toEqual({
      domains_touched: [PsychDomain.personality],
      total_ai_words: { increment: 3 },
    });

    expect(buildInterviewSessionUpdateData({
      newDomains: [PsychDomain.personality, PsychDomain.attachment],
      aiWordCount: 5,
      newFacts: ['新事實'],
      updatedCollectedFacts: ['既有事實', '新事實'],
    })).toEqual({
      domains_touched: [PsychDomain.personality, PsychDomain.attachment],
      total_ai_words: { increment: 5 },
      collected_facts: ['既有事實', '新事實'],
    });
  });

  it('buildInterviewMetadataEvent 應產生前端 metadata SSE payload', () => {
    expect(buildInterviewMetadataEvent({
      nextOrder: 2,
      parsedMeta: {
        intent: 'deepening',
        target_domains: [PsychDomain.personality],
      },
      domainsTouched: [PsychDomain.attachment, PsychDomain.personality],
    })).toEqual({
      turn_order: 2,
      intent: 'deepening',
      target_domains: [PsychDomain.personality],
      domains_touched: [PsychDomain.attachment, PsychDomain.personality],
      total_turns: 2,
      should_end: false,
    });
  });

  it('buildInterviewCompleteEvent 應產生前端 complete SSE payload', () => {
    expect(buildInterviewCompleteEvent({
      sessionId: 's1',
      status: 'in_progress',
      nextOrder: 2,
      domainsTouched: [PsychDomain.personality],
    })).toEqual({
      session_id: 's1',
      status: 'in_progress',
      total_turns: 2,
      domains_touched: [PsychDomain.personality],
    });
  });
});
