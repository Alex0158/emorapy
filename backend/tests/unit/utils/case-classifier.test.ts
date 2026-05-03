import {
  buildUserBoundCaseModeWhere,
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
});
