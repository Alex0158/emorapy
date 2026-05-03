import { CASE_MODE } from './constants';

export type CaseAccessSubject = {
  mode: string;
  session_id?: string | null;
  plaintiff_id?: string | null;
  defendant_id?: string | null;
};

export type CaseAccessKind = 'session' | 'user';

export function isSessionBoundCase(case_: Pick<CaseAccessSubject, 'mode' | 'session_id'>): boolean {
  return case_.mode === CASE_MODE.QUICK || (case_.mode === CASE_MODE.COLLABORATIVE && Boolean(case_.session_id));
}

export function getCaseAccessKind(case_: Pick<CaseAccessSubject, 'mode' | 'session_id'>): CaseAccessKind {
  return isSessionBoundCase(case_) ? 'session' : 'user';
}

export function isCaseParticipant(
  case_: Pick<CaseAccessSubject, 'plaintiff_id' | 'defendant_id'>,
  userId?: string | null
): boolean {
  return Boolean(userId && (case_.plaintiff_id === userId || case_.defendant_id === userId));
}

