/**
 * 常量定義
 */

// 案件狀態
export const CASE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// 案件模式
export const CASE_MODE = {
  REMOTE: 'remote',
  COLLABORATIVE: 'collaborative',
  QUICK: 'quick',
} as const;

// 案件類型
export const CASE_TYPES = [
  '生活習慣衝突',
  '消費決策衝突',
  '社交關係衝突',
  '價值觀衝突',
  '情感需求衝突',
  '其他衝突',
] as const;

// 配對狀態
export const PAIRING_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  TEMP: 'temp',
} as const;

// 配對類型
export const PAIRING_TYPE = {
  NORMAL: 'normal',
  QUICK: 'quick',
} as const;

// 執行動作
export const EXECUTION_ACTION = {
  CONFIRM: 'confirm',
  CHECKIN: 'checkin',
  COMPLETE: 'complete',
  SKIP: 'skip',
} as const;

// 鎖定時間常量（秒）
export const LOCK_TTL = {
  JUDGMENT_GENERATION: 120, // 判決生成鎖定時間：120秒
  DEFAULT: 60, // 默認鎖定時間：60秒
} as const;

// Session相關常量
export const SESSION_CONFIG = {
  EXPIRE_MINUTES: 5, // Session過期時間：5分鐘
  EXPIRE_MS: 5 * 60 * 1000, // Session過期時間（毫秒）
} as const;

// 緩存相關常量
export const CACHE_CONFIG = {
  MAX_SIZE: 1000, // 最大緩存條目數
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 清理間隔：5分鐘
} as const;

// AI服務超時常量（毫秒）
export const AI_TIMEOUT = {
  JUDGMENT_GENERATION: 60000, // 判決生成超時：60秒
  DEFAULT: 30000, // 默認超時：30秒
} as const;

// 執行狀態
export const EXECUTION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  FAILED: 'failed',
} as const;

// 和好方案類型
export const PLAN_TYPE = {
  ACTIVITY: 'activity',
  COMMUNICATION: 'communication',
  INTIMACY: 'intimacy',
} as const;

// 難度等級
export const DIFFICULTY_LEVEL = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;

// 文件類型
export const FILE_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

// 驗證類型
export const VERIFICATION_TYPE = {
  REGISTER: 'register',
  RESET_PASSWORD: 'reset_password',
  VERIFY_EMAIL: 'verify_email',
} as const;

// 限制常量
export const LIMITS = {
  MAX_STATEMENT_LENGTH: 2000,
  MIN_STATEMENT_LENGTH: 50,
  MAX_EVIDENCE_COUNT: 3,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  SESSION_EXPIRY_HOURS: 24,
  SESSION_EXPIRY_DAYS_COMPLETED: 7,
  VERIFICATION_CODE_EXPIRY_MINUTES: 5,
  INVITE_CODE_EXPIRY_HOURS: 24,
} as const;

