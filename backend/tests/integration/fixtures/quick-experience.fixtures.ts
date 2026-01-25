/**
 * 快速體驗測試數據 Fixtures
 * 
 * 包含各種測試場景的預設數據
 */

/**
 * 有效的案件請求數據
 */
export const validCaseRequests = {
  // 典型的情侶爭吵案件
  coupleDispute: {
    plaintiff_statement: '他總是不聽我說話，每次我想和他談心事的時候，他都在玩手機。我覺得自己被忽視了，這讓我非常難過。',
    defendant_statement: '我工作壓力很大，回家想放鬆一下，她總是選在我最累的時候要聊天。我不是不想聽，只是需要一點自己的時間。',
  },

  // 家務分工爭議
  houseworkDispute: {
    plaintiff_statement: '家裡的家務都是我在做，他從來不主動幫忙。每次我提起這件事，他就說他工作太忙。但我也在工作啊！',
    defendant_statement: '我確實最近工作比較忙，但我週末都有在幫忙打掃。可能她沒有注意到，我會試著做得更明顯一些。',
  },

  // 金錢觀念衝突
  moneyDispute: {
    plaintiff_statement: '他花錢太大手大腳了，買了很多不需要的東西。我們應該要為未來存錢，而不是這樣揮霍。',
    defendant_statement: '我覺得適當的消費是可以的，生活不能太過於節省。而且那些東西都是我用自己的錢買的。',
  },

  // 社交活動爭議
  socialDispute: {
    plaintiff_statement: '她太黏人了，我和朋友出去玩她都會不開心。我需要有自己的社交生活，不能整天只和她在一起。',
    defendant_statement: '我只是希望他能多陪陪我。他週末總是和朋友出去，我一個人在家很孤單。',
  },

  // 生活習慣衝突
  habitDispute: {
    plaintiff_statement: '她晚上總是很晚睡，影響到我的休息。我早上要上班，需要好好睡覺，但她看電視看到半夜。',
    defendant_statement: '我是夜貓子，很難早睡。我已經盡量把聲音調小了，而且我用的是耳機。',
  },

  // 最小長度陳述
  minimalStatements: {
    plaintiff_statement: '他不理我',
    defendant_statement: '她誤會了',
  },

  // 較長的陳述
  longStatements: {
    plaintiff_statement: `
      這件事要從上個月說起。我們約好了一起去看電影，那是我期待已久的一部電影。
      但是當天他突然說有工作要處理，讓我一個人去看。我當時就很失望，但還是體諒他的工作。
      結果我後來發現他那天根本沒有在工作，而是和他的朋友去打籃球了。
      我問他為什麼要騙我，他說只是臨時起意，不想讓我失望所以才說是工作。
      但這讓我更加難過，因為他選擇了欺騙而不是坦誠相告。
      從那之後我就開始不太信任他說的話了。
    `.trim(),
    defendant_statement: `
      那天確實是我不對，我應該直接告訴她我想和朋友打球。
      但我知道她很期待那部電影，不想讓她失望，所以才說是工作。
      我現在知道這樣做是錯的，應該要坦誠。
      但她現在因為這件事就一直懷疑我說的每一句話，這讓我覺得很委屈。
      我承認那次錯了，但不代表我以後說的話都是假的。
      我希望她能給我一個改正的機會，不要因為一次錯誤就否定一切。
    `.trim(),
  },
};

/**
 * 無效的案件請求數據（用於測試驗證）
 */
export const invalidCaseRequests = {
  // 空的原告陳述
  emptyPlaintiff: {
    plaintiff_statement: '',
    defendant_statement: '我的陳述',
  },

  // 空的被告陳述
  emptyDefendant: {
    plaintiff_statement: '我的陳述',
    defendant_statement: '',
  },

  // 兩者都為空
  bothEmpty: {
    plaintiff_statement: '',
    defendant_statement: '',
  },

  // 陳述過長（超過 5000 字）
  tooLong: {
    plaintiff_statement: 'a'.repeat(5001),
    defendant_statement: '正常陳述',
  },

  // 缺少必填字段
  missingFields: {},

  // 只有原告陳述
  onlyPlaintiff: {
    plaintiff_statement: '只有我的陳述',
  },
};

/**
 * Session 相關測試數據
 */
export const sessionFixtures = {
  // 有效的 Session ID 格式
  validSessionId: 'test-session-12345678',
  
  // 無效的 Session ID 格式
  invalidSessionIds: [
    '', // 空字符串
    '   ', // 空白字符
    'invalid', // 太短
    '../../etc/passwd', // 路徑遍歷嘗試
    '<script>alert(1)</script>', // XSS 嘗試
    'a'.repeat(200), // 太長
  ],

  // 過期的 Session
  expiredSession: {
    session_id: 'expired-session-12345678',
    expires_at: new Date(Date.now() - 60 * 60 * 1000), // 1小時前過期
  },
};

/**
 * 判決相關測試數據
 */
export const judgmentFixtures = {
  // 預期的判決結構
  expectedStructure: {
    hasId: true,
    hasCaseId: true,
    hasContent: true,
    hasSummary: true,
    hasResponsibilityRatio: true,
    hasAiModel: true,
    hasCreatedAt: true,
  },

  // 責任比例範例
  responsibilityRatios: [
    { plaintiff: 50, defendant: 50 }, // 各半
    { plaintiff: 70, defendant: 30 }, // 原告主要責任
    { plaintiff: 30, defendant: 70 }, // 被告主要責任
    { plaintiff: 100, defendant: 0 }, // 原告全責
    { plaintiff: 0, defendant: 100 }, // 被告全責
  ],
};

/**
 * 證據相關測試數據
 */
export const evidenceFixtures = {
  // 有效的文件類型
  validFileTypes: [
    { extension: 'png', mimeType: 'image/png' },
    { extension: 'jpg', mimeType: 'image/jpeg' },
    { extension: 'jpeg', mimeType: 'image/jpeg' },
    { extension: 'gif', mimeType: 'image/gif' },
    { extension: 'pdf', mimeType: 'application/pdf' },
  ],

  // 無效的文件類型
  invalidFileTypes: [
    { extension: 'exe', mimeType: 'application/x-msdownload' },
    { extension: 'js', mimeType: 'application/javascript' },
    { extension: 'php', mimeType: 'application/x-php' },
    { extension: 'sh', mimeType: 'application/x-sh' },
  ],

  // 最大允許文件數量
  maxFileCount: 3,

  // 最大文件大小（字節）
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

/**
 * 錯誤碼對照
 */
export const errorCodes = {
  // Session 相關
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_SESSION: 'INVALID_SESSION',

  // 案件相關
  CASE_NOT_FOUND: 'CASE_NOT_FOUND',
  INVALID_CASE_DATA: 'INVALID_CASE_DATA',
  CASE_ACCESS_DENIED: 'CASE_ACCESS_DENIED',

  // 判決相關
  JUDGMENT_NOT_FOUND: 'JUDGMENT_NOT_FOUND',
  JUDGMENT_PENDING: 'JUDGMENT_PENDING',
  JUDGMENT_FAILED: 'JUDGMENT_FAILED',
  JUDGMENT_GENERATION_IN_PROGRESS: 'JUDGMENT_GENERATION_IN_PROGRESS',

  // 證據相關
  EVIDENCE_UPLOAD_FAILED: 'EVIDENCE_UPLOAD_FAILED',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  TOO_MANY_FILES: 'TOO_MANY_FILES',

  // 通用
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
};

/**
 * HTTP 狀態碼對照
 */
export const httpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * 輪詢配置
 */
export const pollingConfig = {
  // 默認最大輪詢次數
  defaultMaxAttempts: 30,
  // 默認輪詢間隔（毫秒）
  defaultIntervalMs: 1000,
  // 測試用快速輪詢間隔
  testIntervalMs: 100,
  // 測試用最大輪詢次數
  testMaxAttempts: 50,
};

/**
 * 案件類型對照
 */
export const caseTypes = [
  '生活習慣衝突',
  '溝通問題',
  '金錢觀念分歧',
  '社交活動爭議',
  '家務分工不均',
  '信任問題',
  '時間分配爭議',
  '價值觀差異',
  '親密關係問題',
  '其他',
];

/**
 * 案件狀態對照
 */
export const caseStatuses = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  JUDGING: 'judging',
  COMPLETED: 'completed',
  CLOSED: 'closed',
};

/**
 * 創建測試用的案件請求
 */
export function createTestCaseRequest(
  options: {
    plaintiffLength?: number;
    defendantLength?: number;
    includeEvidenceUrls?: boolean;
  } = {}
): {
  plaintiff_statement: string;
  defendant_statement: string;
  evidence_urls?: string[];
} {
  const { 
    plaintiffLength = 100, 
    defendantLength = 100,
    includeEvidenceUrls = false 
  } = options;

  const request: {
    plaintiff_statement: string;
    defendant_statement: string;
    evidence_urls?: string[];
  } = {
    plaintiff_statement: generateStatement('plaintiff', plaintiffLength),
    defendant_statement: generateStatement('defendant', defendantLength),
  };

  if (includeEvidenceUrls) {
    request.evidence_urls = [
      'https://example.com/evidence1.png',
      'https://example.com/evidence2.jpg',
    ];
  }

  return request;
}

/**
 * 生成指定長度的陳述
 */
function generateStatement(role: 'plaintiff' | 'defendant', targetLength: number): string {
  const base = role === 'plaintiff' 
    ? '我認為對方做錯了，這件事讓我很難過。' 
    : '我覺得這是一個誤會，我並沒有想傷害對方。';
  
  let statement = base;
  const filler = '這是測試用的補充內容。';
  
  while (statement.length < targetLength) {
    statement += filler;
  }
  
  return statement.substring(0, targetLength);
}
