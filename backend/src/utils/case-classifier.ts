import { Prisma } from '../types/prisma-client';
import { CASE_MODE, CASE_STATUS } from './constants';

export type CaseAccessSubject = {
  mode: string;
  session_id?: string | null;
  plaintiff_id?: string | null;
  defendant_id?: string | null;
};

export type CaseAccessKind = 'session' | 'user';
export type CaseProductFlow =
  | 'quick_single'
  | 'quick_collaborative'
  | 'formal_remote'
  | 'formal_collaborative'
  | 'chat_to_case';
export type FormalCaseMode = 'remote' | 'collaborative';

export type CaseProductFlowSubject = CaseAccessSubject & {
  chat_to_case_links?: unknown[] | null;
  _count?: {
    chat_to_case_links?: number | null;
  } | null;
};

export type SessionBoundCaseAccessSubject = Pick<CaseAccessSubject, 'mode' | 'session_id'> & {
  quick_sessions?: Array<{ id?: string | null }> | null;
};

export function hasChatToCaseSource(
  case_: Pick<CaseProductFlowSubject, 'chat_to_case_links' | '_count'>
): boolean {
  return Boolean(
    (Array.isArray(case_.chat_to_case_links) && case_.chat_to_case_links.length > 0)
    || (case_._count?.chat_to_case_links ?? 0) > 0
  );
}

export function isSessionBoundCase(case_: Pick<CaseAccessSubject, 'mode' | 'session_id'>): boolean {
  return case_.mode === CASE_MODE.QUICK || (case_.mode === CASE_MODE.COLLABORATIVE && Boolean(case_.session_id));
}

export function isClaimableSessionCase(case_: Pick<CaseAccessSubject, 'mode' | 'session_id'>, sessionId: string): boolean {
  return case_.mode === CASE_MODE.QUICK || (case_.mode === CASE_MODE.COLLABORATIVE && case_.session_id === sessionId);
}

export function canAccessSessionBoundCase(
  case_: SessionBoundCaseAccessSubject,
  sessionId?: string | null
): boolean {
  if (!sessionId) {
    return false;
  }

  if (case_.mode === CASE_MODE.COLLABORATIVE) {
    return case_.session_id === sessionId;
  }

  if (case_.mode !== CASE_MODE.QUICK) {
    return false;
  }

  return case_.session_id === sessionId
    || Boolean(case_.quick_sessions?.some((session) => session.id === sessionId));
}

export function isFormalCaseMode(mode: string | null | undefined): mode is FormalCaseMode {
  return mode === CASE_MODE.REMOTE || mode === CASE_MODE.COLLABORATIVE;
}

export function isUserBoundFormalCase(case_: Pick<CaseAccessSubject, 'mode' | 'session_id'>): boolean {
  return case_.mode === CASE_MODE.REMOTE || (case_.mode === CASE_MODE.COLLABORATIVE && !case_.session_id);
}

export function requiresCounterpartyStatementForSubmit(
  case_: Pick<CaseAccessSubject, 'mode' | 'session_id'> & { defendant_statement?: string | null }
): boolean {
  return isUserBoundFormalCase(case_) && (!case_.defendant_statement || !case_.defendant_statement.trim());
}

export function shouldAutoSubmitFormalRemoteResponse(
  case_: Pick<CaseAccessSubject, 'mode' | 'defendant_id'> & { defendant_statement?: string | null },
  userId: string,
  nextDefendantStatement?: unknown
): boolean {
  return case_.mode === CASE_MODE.REMOTE
    && case_.defendant_id === userId
    && !case_.defendant_statement
    && Boolean(nextDefendantStatement);
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

export function getCaseProductFlow(case_: CaseProductFlowSubject): CaseProductFlow {
  if (hasChatToCaseSource(case_)) {
    return 'chat_to_case';
  }

  if (case_.mode === CASE_MODE.QUICK) {
    return 'quick_single';
  }

  if (case_.mode === CASE_MODE.COLLABORATIVE) {
    return case_.session_id ? 'quick_collaborative' : 'formal_collaborative';
  }

  return 'formal_remote';
}

export function isUserBoundProductFlow(flow: CaseProductFlow): boolean {
  return flow === 'formal_remote' || flow === 'formal_collaborative' || flow === 'chat_to_case';
}

export function isUserBoundProductCase(case_: CaseProductFlowSubject): boolean {
  return isUserBoundProductFlow(getCaseProductFlow(case_));
}

export function buildUserBoundCaseModeWhere() {
  return {
    OR: [
      { mode: CASE_MODE.REMOTE },
      { mode: CASE_MODE.COLLABORATIVE, session_id: null },
    ],
  };
}

export function buildSessionBoundCaseWhere(sessionId: string): Prisma.CaseWhereInput {
  return {
    OR: [
      {
        mode: CASE_MODE.QUICK,
        OR: [
          { session_id: sessionId },
          { quick_sessions: { some: { id: sessionId } } },
        ],
      },
      { mode: CASE_MODE.COLLABORATIVE, session_id: sessionId },
    ],
  };
}

export function buildClaimableSessionCaseWhere(sessionId: string): Prisma.CaseWhereInput {
  return {
    OR: [
      {
        mode: CASE_MODE.QUICK,
        OR: [
          { session_id: sessionId },
          { quick_sessions: { some: { id: sessionId } } },
        ],
      },
      {
        mode: CASE_MODE.COLLABORATIVE,
        session_id: sessionId,
      },
    ],
  };
}

export function buildUserBoundProductCaseWhere(): Prisma.CaseWhereInput {
  return {
    OR: [
      buildCaseProductFlowWhere('chat_to_case'),
      buildCaseProductFlowWhere('formal_remote'),
      buildCaseProductFlowWhere('formal_collaborative'),
    ],
  };
}

export function buildStaleFormalDraftCaseWhere(cutoff: Date): Prisma.CaseWhereInput {
  return {
    status: CASE_STATUS.DRAFT,
    ...buildUserBoundCaseModeWhere(),
    chat_to_case_links: { none: {} },
    defendant_statement: null,
    created_at: { lt: cutoff },
  };
}

export function buildCaseProductFlowWhere(flow: CaseProductFlow): Prisma.CaseWhereInput {
  if (flow === 'chat_to_case') {
    return {
      chat_to_case_links: { some: {} },
    };
  }

  const withoutChatToCase = {
    chat_to_case_links: { none: {} },
  };

  if (flow === 'quick_single') {
    return {
      ...withoutChatToCase,
      mode: CASE_MODE.QUICK,
    };
  }

  if (flow === 'quick_collaborative') {
    return {
      ...withoutChatToCase,
      mode: CASE_MODE.COLLABORATIVE,
      session_id: { not: null },
    };
  }

  if (flow === 'formal_collaborative') {
    return {
      ...withoutChatToCase,
      mode: CASE_MODE.COLLABORATIVE,
      session_id: null,
    };
  }

  return {
    ...withoutChatToCase,
    mode: CASE_MODE.REMOTE,
  };
}

export function buildJudgmentProductFlowWhere(flow: CaseProductFlow): Prisma.JudgmentWhereInput {
  return {
    case: {
      is: buildCaseProductFlowWhere(flow),
    },
  };
}

export function buildCompletedExecutionProductFlowWhere(flow: CaseProductFlow): Prisma.ExecutionRecordWhereInput {
  return {
    status: 'completed',
    reconciliation_plan: {
      is: {
        judgment: {
          is: {
            case: {
              is: buildCaseProductFlowWhere(flow),
            },
          },
        },
      },
    },
  };
}
