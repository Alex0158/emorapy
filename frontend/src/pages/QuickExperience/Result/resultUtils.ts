import type { Case } from '@/types/case';
import type { ResponsibilityRatio } from '@/types/common';
import type { Judgment } from '@/types/judgment';

export type EvidenceUploadStatus = 'success' | 'failed' | 'pending' | null;

const SESSION_ERROR_CODES = new Set(['SESSION_EXPIRED', 'SESSION_ID_REQUIRED', 'INVALID_SESSION_ID']);
const PENDING_JUDGMENT_ERROR_CODES = new Set(['JUDGMENT_PENDING', 'HTTP_404', 'JUDGMENT_NOT_FOUND']);
const SUPPORT_ONLY_JUDGMENT_ROUTES = new Set(['safety_support', 'crisis_support']);
const EVIDENCE_UPLOAD_ALLOWED_STATUSES = new Set(['draft', 'submitted', 'in_progress']);

export function isPendingJudgmentErrorCode(code?: string): boolean {
  return code ? PENDING_JUDGMENT_ERROR_CODES.has(code) : false;
}

export function isSessionJudgmentErrorCode(code?: string | null): boolean {
  return code ? SESSION_ERROR_CODES.has(code) : false;
}

export function isJudgmentFailedState(errorCode?: string | null, caseStatus?: string | null): boolean {
  return errorCode === 'JUDGMENT_FAILED' || caseStatus === 'judgment_failed';
}

export function getResponsibilityRatio(judgment: Judgment | null): ResponsibilityRatio {
  if (!judgment) return { plaintiff: 0, defendant: 0 };
  return judgment.responsibility_ratio ?? {
    plaintiff: judgment.plaintiff_ratio,
    defendant: judgment.defendant_ratio,
  };
}

export function shouldShowResponsibilityRatio(judgment: Judgment | null): boolean {
  return !SUPPORT_ONLY_JUDGMENT_ROUTES.has(judgment?.judgment_route ?? 'standard');
}

export function canUploadEvidenceForCaseStatus(status?: string | null): boolean {
  return status ? EVIDENCE_UPLOAD_ALLOWED_STATUSES.has(status) : false;
}

export function getPendingEvidenceStorageKey(caseId: string): string {
  return `pending_evidence_${caseId}`;
}

export function storageGetItem(key: string): string | null {
  try {
    return Storage.prototype.getItem.call(window.localStorage, key);
  } catch {
    return null;
  }
}

export function storageSetItem(key: string, value: string): void {
  try {
    Storage.prototype.setItem.call(window.localStorage, key, value);
  } catch {
    // Storage access can fail in private browsing or restricted embedded contexts.
  }
}

export function storageRemoveItem(key: string): void {
  try {
    Storage.prototype.removeItem.call(window.localStorage, key);
  } catch {
    // Storage access can fail in private browsing or restricted embedded contexts.
  }
}

export function getEvidenceUploadStatusFromCase(case_: Pick<Case, 'evidences'>, hasPendingEvidence: boolean): EvidenceUploadStatus {
  if (Array.isArray(case_.evidences) && case_.evidences.length > 0) return 'success';
  return hasPendingEvidence ? 'pending' : null;
}

export function resolveQuickResultSessionId({
  caseSessionId,
  globalSessionId,
  storeSessionId,
}: {
  caseSessionId?: string | null;
  globalSessionId?: string | null;
  storeSessionId?: string | null;
}): string | null {
  return caseSessionId || globalSessionId || storeSessionId || null;
}
