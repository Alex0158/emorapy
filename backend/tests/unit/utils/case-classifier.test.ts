import {
  buildCaseProductFlowWhere,
  buildCompletedExecutionProductFlowWhere,
  buildJudgmentProductFlowWhere,
  buildSessionBoundCaseWhere,
  buildStaleFormalDraftCaseWhere,
  buildUserBoundCaseModeWhere,
  buildUserBoundProductCaseWhere,
  getCaseAccessKind,
  getCaseProductFlow,
  hasChatToCaseSource,
  isCaseParticipant,
  isSessionBoundCase,
  isUserBoundProductCase,
} from '../../../src/utils/case-classifier';

describe('case-classifier', () => {
  it('quick 一律為 session-bound', () => {
    expect(isSessionBoundCase({ mode: 'quick', session_id: null })).toBe(true);
    expect(getCaseAccessKind({ mode: 'quick', session_id: null })).toBe('session');
  });

  it('collaborative 僅在 session_id 存在時為 session-bound', () => {
    expect(isSessionBoundCase({ mode: 'collaborative', session_id: 's1' })).toBe(true);
    expect(isSessionBoundCase({ mode: 'collaborative', session_id: null })).toBe(false);
    expect(getCaseAccessKind({ mode: 'collaborative', session_id: null })).toBe('user');
  });

  it('remote 走 user 授權', () => {
    expect(isSessionBoundCase({ mode: 'remote', session_id: 'stale-session' })).toBe(false);
    expect(getCaseAccessKind({ mode: 'remote', session_id: 'stale-session' })).toBe('user');
  });

  it('isCaseParticipant 只接受 plaintiff 或 defendant', () => {
    const case_ = { plaintiff_id: 'u1', defendant_id: 'u2' };
    expect(isCaseParticipant(case_, 'u1')).toBe(true);
    expect(isCaseParticipant(case_, 'u2')).toBe(true);
    expect(isCaseParticipant(case_, 'u3')).toBe(false);
    expect(isCaseParticipant(case_, undefined)).toBe(false);
  });

  it('chat_to_case_link 優先於 mode 判斷產品來源', () => {
    expect(getCaseProductFlow({
      mode: 'collaborative',
      session_id: null,
      chat_to_case_links: [{ id: 'link-1' }],
    })).toBe('chat_to_case');
    expect(hasChatToCaseSource({ _count: { chat_to_case_links: 1 } })).toBe(true);
  });

  it('應分類四條非 chat case 產品流', () => {
    expect(getCaseProductFlow({ mode: 'quick', session_id: 's1' })).toBe('quick_single');
    expect(getCaseProductFlow({ mode: 'collaborative', session_id: 's1' })).toBe('quick_collaborative');
    expect(getCaseProductFlow({ mode: 'remote', session_id: null })).toBe('formal_remote');
    expect(getCaseProductFlow({ mode: 'collaborative', session_id: null })).toBe('formal_collaborative');
  });

  it('user-bound product case 應包含正式與 chat-to-case，排除 session-bound quick', () => {
    expect(isUserBoundProductCase({ mode: 'remote', session_id: null })).toBe(true);
    expect(isUserBoundProductCase({ mode: 'collaborative', session_id: null })).toBe(true);
    expect(isUserBoundProductCase({ mode: 'quick', session_id: 's1', chat_to_case_links: [{ id: 'l1' }] })).toBe(true);
    expect(isUserBoundProductCase({ mode: 'quick', session_id: 's1' })).toBe(false);
    expect(isUserBoundProductCase({ mode: 'collaborative', session_id: 's1' })).toBe(false);
  });

  it('user-bound case query 不應只等同 mode=remote', () => {
    expect(buildUserBoundCaseModeWhere()).toEqual({
      OR: [
        { mode: 'remote' },
        { mode: 'collaborative', session_id: null },
      ],
    });
  });

  it('session-bound case query 應覆蓋 quick 與 collaborative 同 session', () => {
    expect(buildSessionBoundCaseWhere('s1')).toEqual({
      OR: [
        { mode: 'quick', session_id: 's1' },
        { mode: 'collaborative', session_id: 's1' },
      ],
    });
  });

  it('user-bound product case query 應包含 chat-to-case 且排除 session-bound quick/collab', () => {
    expect(buildUserBoundProductCaseWhere()).toEqual({
      OR: [
        { chat_to_case_links: { some: {} } },
        { chat_to_case_links: { none: {} }, mode: 'remote' },
        { chat_to_case_links: { none: {} }, mode: 'collaborative', session_id: null },
      ],
    });
  });

  it('product-flow where 應與 runtime 分類口徑一致', () => {
    expect(buildCaseProductFlowWhere('chat_to_case')).toEqual({
      chat_to_case_links: { some: {} },
    });
    expect(buildCaseProductFlowWhere('quick_single')).toEqual({
      chat_to_case_links: { none: {} },
      mode: 'quick',
    });
    expect(buildCaseProductFlowWhere('quick_collaborative')).toEqual({
      chat_to_case_links: { none: {} },
      mode: 'collaborative',
      session_id: { not: null },
    });
    expect(buildCaseProductFlowWhere('formal_remote')).toEqual({
      chat_to_case_links: { none: {} },
      mode: 'remote',
    });
    expect(buildCaseProductFlowWhere('formal_collaborative')).toEqual({
      chat_to_case_links: { none: {} },
      mode: 'collaborative',
      session_id: null,
    });
  });

  it('judgment 與 completed execution product-flow where 應共用 case product-flow 口徑', () => {
    expect(buildJudgmentProductFlowWhere('quick_collaborative')).toEqual({
      case: {
        is: {
          chat_to_case_links: { none: {} },
          mode: 'collaborative',
          session_id: { not: null },
        },
      },
    });
    expect(buildCompletedExecutionProductFlowWhere('chat_to_case')).toEqual({
      status: 'completed',
      reconciliation_plan: {
        is: {
          judgment: {
            is: {
              case: {
                is: {
                  chat_to_case_links: { some: {} },
                },
              },
            },
          },
        },
      },
    });
  });

  it('stale formal draft where 應覆蓋正式 remote/collaborative 並排除 chat/session-bound', () => {
    const cutoff = new Date('2026-05-03T00:00:00.000Z');

    expect(buildStaleFormalDraftCaseWhere(cutoff)).toEqual({
      status: 'draft',
      OR: [
        { mode: 'remote' },
        { mode: 'collaborative', session_id: null },
      ],
      chat_to_case_links: { none: {} },
      defendant_statement: null,
      created_at: { lt: cutoff },
    });
  });
});
