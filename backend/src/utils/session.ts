import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * 生成快速體驗模式的Session ID
 * 格式：guest_{timestamp}_{random}
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = uuidv4().replace(/-/g, '').substring(0, 16);
  return `guest_${timestamp}_${random}`;
}

/**
 * 驗證Session ID格式
 */
export function validateSessionId(sessionId: string): boolean {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  const pattern = /^guest_\d+_[a-z0-9]{8,}$/;
  return pattern.test(sessionId);
}

/**
 * 生成驗證碼（6位數字，使用密碼學安全隨機數）
 */
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * 生成邀請碼（6位字母數字，使用密碼學安全隨機數）
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

