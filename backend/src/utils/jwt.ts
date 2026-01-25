import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Errors } from './errors';

export interface UserPayload {
  id: string;
  email: string;
}

/**
 * 生成JWT Token
 */
export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, env.JWT_SECRET as string, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * 驗證JWT Token
 */
export function verifyToken(token: string): UserPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET as string) as UserPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.TOKEN_EXPIRED();
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw Errors.UNAUTHORIZED('Token無效');
    }
    throw Errors.UNAUTHORIZED('Token驗證失敗');
  }
}

