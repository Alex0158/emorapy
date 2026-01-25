import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * 加密密碼
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 驗證密碼
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * 驗證密碼強度
 */
export function validatePasswordStrength(password: string): { 
  valid: boolean; 
  message?: string 
} {
  // 檢查常見弱密碼（優先提示，提升用戶體驗）
  // 注意：放在最前面，避免被「長度/字母/數字」等更通用的提示覆蓋
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, message: '密碼過於簡單，請使用更複雜的密碼' };
  }

  // 至少8位
  if (password.length < 8) {
    return { valid: false, message: '密碼長度至少8位' };
  }
  
  // 最多128位（防止DoS攻擊）
  if (password.length > 128) {
    return { valid: false, message: '密碼長度不能超過128位' };
  }
  
  // 包含字母
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密碼必須包含字母' };
  }
  
  // 包含數字
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密碼必須包含數字' };
  }
  
  return { valid: true };
}

