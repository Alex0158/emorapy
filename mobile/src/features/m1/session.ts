import type { Session } from '@cj/contracts/session';

import { normalizeM1Error, m1Api } from '@/src/features/m1/api';
import { sessionStorage } from '@/src/platform/storage/secureStore';
import { captureTelemetry } from '@/src/platform/telemetry/client';

const RECOVERABLE_SESSION_ERROR_CODES = new Set([
  'INVALID_SESSION_ID',
  'SESSION_EXPIRED',
  'SESSION_ID_REQUIRED',
  'SESSION_NOT_FOUND',
  'NOT_FOUND',
  'HTTP_400',
  'HTTP_401',
  'HTTP_404',
]);

export interface QuickSessionResolution {
  previousSessionId: string | null;
  recovered: boolean;
  session: Session;
}

export async function clearQuickSessionForRecoverableError(
  error: unknown,
  route: string
): Promise<{ code: string; message: string } | null> {
  const sessionError = normalizeM1Error(error);
  if (!RECOVERABLE_SESSION_ERROR_CODES.has(sessionError.code)) {
    return null;
  }

  await sessionStorage.clearSessionId();
  captureTelemetry({
    name: 'app_quick_session_access_failed',
    severity: 'warning',
    route,
    context: {
      code: sessionError.code,
      clearedSession: true,
    },
  });
  return sessionError;
}

export async function getOrCreateQuickSession(): Promise<QuickSessionResolution> {
  const previousSessionId = await sessionStorage.getSessionId();

  if (!previousSessionId) {
    const session = await m1Api.session.createQuickSession();
    await sessionStorage.setSessionId(session.session_id);
    return { previousSessionId, recovered: false, session };
  }

  try {
    const session = await m1Api.session.refreshQuickSession(previousSessionId);
    await sessionStorage.setSessionId(session.session_id);
    return { previousSessionId, recovered: false, session };
  } catch (error) {
    const sessionError = normalizeM1Error(error);
    if (!RECOVERABLE_SESSION_ERROR_CODES.has(sessionError.code)) {
      throw error;
    }

    await sessionStorage.clearSessionId();
    const session = await m1Api.session.createQuickSession();
    await sessionStorage.setSessionId(session.session_id);
    captureTelemetry({
      name: 'app_quick_session_recovered',
      severity: 'warning',
      route: '/quick',
      context: {
        code: sessionError.code,
        hadSession: true,
      },
    });

    return { previousSessionId, recovered: true, session };
  }
}
