import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { Errors } from '../utils/errors';

export const requireConsent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw Errors.UNAUTHORIZED('需要認證');
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { psych_consent_given: true },
    });
    if (!user?.psych_consent_given) {
      throw Errors.CONSENT_REQUIRED();
    }
    next();
  } catch (error) {
    next(error);
  }
};
