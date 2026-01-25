import { v4 as uuidv4 } from 'uuid';

/**
 * 生成快速體驗模式的Session ID
 * 格式：guest_{timestamp}_{random}
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  // 增強隨機性：取uuid去除'-'後的前16位（向後兼容 validateSessionId 的 {8,}）
  const random = uuidv4().replace(/-/g, '').substring(0, 16);
  return `guest_${timestamp}_${random}`;
}

/**
 * 驗證Session ID格式
 * 注意：只驗證格式，不驗證時間戳（時間驗證由數據庫查詢處理）
 */
export function validateSessionId(sessionId: string): boolean {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  
  // 格式：guest_timestamp_random
  // 只驗證基本格式，時間戳驗證由數據庫查詢和過期檢查處理
  const pattern = /^guest_\d+_[a-z0-9]{8,}$/;
  return pattern.test(sessionId);
}

/**
 * 生成驗證碼（6位數字）
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 生成邀請碼（6位字母數字）
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

