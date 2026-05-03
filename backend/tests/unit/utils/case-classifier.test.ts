import { getCaseAccessKind, isCaseParticipant, isSessionBoundCase } from '../../../src/utils/case-classifier';

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
});

