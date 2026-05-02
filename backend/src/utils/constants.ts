/**
 * 常量定義
 */

// 案件狀態
export const CASE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  JUDGMENT_FAILED: 'judgment_failed',
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

// 訪談 Session 狀態
export const INTERVIEW_STATUS = {
  IN_PROGRESS: 'in_progress',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  PROCESSING_FAILED: 'processing_failed',
  ABANDONED: 'abandoned',
} as const;

// 允許上傳證據的案件狀態
export const EVIDENCE_UPLOAD_ALLOWED_STATUSES = [
  CASE_STATUS.DRAFT,
  CASE_STATUS.SUBMITTED,
  CASE_STATUS.IN_PROGRESS,
] as const;

// 執行動作
export const EXECUTION_ACTION = {
  CONFIRM: 'confirm',
  CHECKIN: 'checkin',
  COMPLETE: 'complete',
  SKIP: 'skip',
} as const;

// 鎖定時間常量（秒）
export const LOCK_TTL = {
  // Judgment generation is a multi-stage pipeline with several sequential AI calls.
  // Keep the lock TTL comfortably above the end-to-end judgment timeout to avoid
  // lock expiry mid-flight and duplicate generation.
  JUDGMENT_GENERATION: 300,
  DEFAULT: 60,
  CASE_CREATE: 30,
  CASE_SUBMIT: 10,
  CASE_UPDATE: 15,
  EVIDENCE_UPLOAD: 30,
  PAIRING_CREATE: 20,
} as const;

// Session 過期常量
export const SESSION_EXPIRY = {
  DEFAULT_MS: 24 * 60 * 60 * 1000,
  COMPLETED_MS: 7 * 24 * 60 * 60 * 1000,
  CLEANUP_BATCH: 1000,
} as const;

// 緩存相關常量
export const CACHE_CONFIG = {
  MAX_SIZE: 1000,
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
} as const;

// AI服務超時常量（毫秒）
export const AI_TIMEOUT = {
  // Single OpenAI calls in the judgment pipeline can legitimately exceed 45s for
  // large prompts. The overall judgment budget must cover multiple sequential calls:
  // analysis -> main response -> responsibility ratio -> summary.
  OPENAI_REQUEST: 90000,
  JUDGMENT_GENERATION: 180000,
  DEFAULT: 30000,
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
  GIFT: 'gift',
  SERVICE: 'service',
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
  DOC: 'doc',
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
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  SESSION_EXPIRY_HOURS: 24,
  SESSION_EXPIRY_DAYS_COMPLETED: 7,
  VERIFICATION_CODE_EXPIRY_MINUTES: 5,
  INVITE_CODE_EXPIRY_HOURS: 24,
} as const;

// 清理任務閾值
export const CLEANUP_THRESHOLDS = {
  TEMP_PAIRING_EXPIRY_DAYS: 30,
  ABANDONED_SESSION_HOURS: 24,
  MIN_TURNS_FOR_PIPELINE: 5,
  MIN_USER_CONTENT_CHARS: 50,
  STALE_DRAFT_DAYS: 14,
  STUCK_PROCESSING_MINUTES: 10,
  FOLLOWUP_7_DAYS: 7,
  FOLLOWUP_8_DAYS: 8,
  FOLLOWUP_30_DAYS: 30,
  FOLLOWUP_31_DAYS: 31,
  FOLLOWUP_PROGRESS_THRESHOLD: 50,
  DEFAULT_ESTIMATED_DURATION_DAYS: 7,
} as const;

// 分頁常量
export const PAGINATION = {
  CASE_LIST_MAX_PAGE_SIZE: 50,
  CASE_LIST_DEFAULT_PAGE_SIZE: 10,
  EXECUTION_LIST_TAKE: 50,
  EXECUTION_RECORDS_TAKE: 100,
} as const;
