import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Errors } from './errors';

const ALGORITHM = 'HS256';

function getVerificationSecrets(): string[] {
  const secrets = [env.JWT_SECRET];
  if (env.JWT_SECRET_PREVIOUS && env.JWT_SECRET_PREVIOUS !== env.JWT_SECRET) {
    secrets.push(env.JWT_SECRET_PREVIOUS);
  }
  return secrets;
}

export interface UserPayload {
  id: string;
  email: string;
  token_version?: number;
}

/**
 * 生成JWT Token（顯式指定 HS256 演算法）
 */
export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, env.JWT_SECRET as string, {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * 驗證JWT Token（強制 HS256，拒絕 none / 其他演算法）
 */
export function verifyToken(token: string): UserPayload {
  const secrets = getVerificationSecrets();
  let lastError: unknown;

  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret as string, {
        algorithms: [ALGORITHM],
      }) as UserPayload;
      return decoded;
    } catch (error) {
      lastError = error;
      if (error instanceof jwt.TokenExpiredError) {
        throw Errors.TOKEN_EXPIRED();
      }
      // JsonWebTokenError（如 invalid signature）允許嘗試下一把密鑰
      if (error instanceof jwt.JsonWebTokenError) {
        continue;
      }
      break;
    }
  }

  if (lastError instanceof jwt.TokenExpiredError) {
    throw Errors.TOKEN_EXPIRED();
  }
  if (lastError instanceof jwt.JsonWebTokenError) {
    throw Errors.UNAUTHORIZED('Token無效');
  }
  throw Errors.UNAUTHORIZED('Token驗證失敗');
}
