import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Errors } from './errors';

const ALGORITHM = 'HS256';

function getAdminTokenExpiresIn(): string {
  const expiresIn = process.env.ADMIN_JWT_EXPIRES_IN;
  if (expiresIn && expiresIn.trim()) {
    return expiresIn;
  }
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return '12h';
  }
  throw Errors.UNAUTHORIZED('管理員 JWT 過期時間配置缺失');
}

function getAdminSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (secret && secret.trim()) {
    return secret;
  }
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return env.JWT_SECRET;
  }
  if (!secret || !secret.trim()) {
    throw Errors.UNAUTHORIZED('管理員 JWT 配置缺失');
  }
  return secret;
}

export interface AdminPayload {
  id: string;
  email: string;
  roleKey: 'super_admin' | 'ops' | 'marketing' | 'support';
  iat?: number;
  exp?: number;
}

export function generateAdminToken(payload: AdminPayload): string {
  return jwt.sign(payload, getAdminSecret(), {
    algorithm: ALGORITHM,
    expiresIn: getAdminTokenExpiresIn(),
  } as jwt.SignOptions);
}

export function verifyAdminToken(token: string): AdminPayload {
  try {
    return jwt.verify(token, getAdminSecret(), {
      algorithms: [ALGORITHM],
    }) as AdminPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.TOKEN_EXPIRED('管理員 Token 已過期');
    }
    throw Errors.UNAUTHORIZED('管理員 Token 無效');
  }
}
