import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Errors } from './errors';

const ALGORITHM = 'HS256';
const EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '12h';
const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || env.JWT_SECRET;

export interface AdminPayload {
  id: string;
  email: string;
  roleKey: 'super_admin' | 'ops' | 'marketing' | 'support';
}

export function generateAdminToken(payload: AdminPayload): string {
  return jwt.sign(payload, ADMIN_SECRET as string, {
    algorithm: ALGORITHM,
    expiresIn: EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAdminToken(token: string): AdminPayload {
  try {
    return jwt.verify(token, ADMIN_SECRET as string, {
      algorithms: [ALGORITHM],
    }) as AdminPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.TOKEN_EXPIRED('管理員 Token 已過期');
    }
    throw Errors.UNAUTHORIZED('管理員 Token 無效');
  }
}

