import { Request, Response, NextFunction } from 'express';
import { resolveLocaleFromHeader } from '../i18n';

export const localeMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const preferred = req.headers['x-locale'] ?? req.headers['accept-language'];
  req.locale = resolveLocaleFromHeader(preferred);
  next();
};
