/**
 * Express Request 擴展類型
 * 供認證、日誌等中間件使用
 */
import type { UserPayload } from '../utils/jwt';
import type { BackendLocale } from '../i18n';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserPayload;
      sessionId?: string;
      requestId?: string;
      locale?: BackendLocale;
    }
  }
}

export {};
