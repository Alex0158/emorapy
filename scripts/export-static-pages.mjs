import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';
import playwright from '../frontend/node_modules/playwright/index.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const ADMIN_DIR = path.join(ROOT, 'frontend-admin');
const OUTPUT_DIR = path.join(ROOT, 'docs', '核心開發文件', '頁面HTML');
const FRONTEND_OUT = path.join(OUTPUT_DIR, 'frontend');
const ADMIN_OUT = path.join(OUTPUT_DIR, 'frontend-admin');
const FRONTEND_PORT = 4173;
const ADMIN_PORT = 4175;
const FRONTEND_BASE = `http://127.0.0.1:${FRONTEND_PORT}`;
const ADMIN_BASE = `http://127.0.0.1:${ADMIN_PORT}`;
const NOW = '2026-03-17T12:00:00.000Z';
const USER_TOKEN = 'snapshot-user-token';
const ADMIN_TOKEN = 'header.payload.signature';
const QUICK_SESSION_ID = 'quick-session-001';
const { chromium } = playwright;

const sampleUser = {
  id: 'user-001',
  email: 'alex@example.com',
  nickname: 'Alex',
  avatar_url: '',
  email_verified: true,
  created_at: NOW,
  last_login_at: NOW,
  gender: 'female',
  age: 32,
  relationship_status: 'in_relationship',
  language: 'zh-TW',
  timezone: 'Asia/Taipei',
  notification_enabled: true,
  privacy_level: 'standard',
};

const samplePairing = {
  id: 'pair-001',
  user1_id: 'user-001',
  user2_id: 'user-002',
  invite_code: 'PAIR-2026',
  status: 'active',
  pairing_type: 'normal',
  created_at: NOW,
  confirmed_at: NOW,
  expires_at: null,
  user1: { id: 'user-001', nickname: 'Alex', avatar_url: '' },
  user2: { id: 'user-002', nickname: 'Taylor', avatar_url: '' },
};

const sampleCase = {
  id: 'case-001',
  pairing_id: 'pair-001',
  title: '家庭分工與情緒勞動協調',
  type: 'relationship_conflict',
  sub_type: 'household',
  plaintiff_id: 'user-001',
  defendant_id: 'user-002',
  plaintiff_statement:
    '我希望對方能更主動承擔家務與照顧安排，而不是等我提出後才被動處理。',
  defendant_statement:
    '我不是不願意做，而是常常不知道你真正最在意的是什麼，也怕做了還是被否定。',
  status: 'completed',
  mode: 'remote',
  session_id: QUICK_SESSION_ID,
  judgment_failure_reason: '',
  created_at: NOW,
  updated_at: NOW,
  submitted_at: NOW,
  completed_at: NOW,
  evidences: [
    {
      id: 'evi-001',
      case_id: 'case-001',
      file_url: 'https://placehold.co/640x360?text=Evidence+1',
      file_type: 'image',
      file_size: 128000,
      description: '對話截圖',
      created_at: NOW,
    },
  ],
  pairing: {
    id: 'pair-001',
    user1: { id: 'user-001', nickname: 'Alex', avatar_url: '' },
    user2: { id: 'user-002', nickname: 'Taylor', avatar_url: '' },
  },
  judgment: {
    id: 'judgment-001',
    summary: '雙方都有責任，重點在於把需求說清楚並建立固定協作節奏。',
    plaintiff_ratio: 55,
    defendant_ratio: 45,
  },
};

const quickCase = {
  ...sampleCase,
  id: 'case-quick-001',
  title: '快速體驗案例',
  mode: 'quick',
  plaintiff_statement:
    '我覺得每次爭執都繞回同一件事，講到最後只剩下委屈和誤解。',
  defendant_statement:
    '我其實想和好，但常常不知道怎麼回應才不會讓情況更糟。',
};

const sampleJudgment = {
  id: 'judgment-001',
  case_id: 'case-001',
  judgment_content: `# 判定摘要

雙方都在壓力下溝通，問題不在單一惡意，而在於需求表達與責任分配沒有形成共識。

## 建議

1. 明確拆分固定家務責任。
2. 每週保留一次 20 分鐘的協調時間。
3. 用具體行為描述需求，避免抽象指責。`,
  summary: '雙方需同時調整：一方要更清楚表達需求，一方要更主動承接。',
  plaintiff_ratio: 55,
  defendant_ratio: 45,
  responsibility_ratio: { plaintiff: 55, defendant: 45 },
  ai_model: 'gpt-5',
  prompt_version: 'snapshot-v1',
  user1_acceptance: true,
  user2_acceptance: false,
  user1_rating: 4,
  user2_rating: 3,
  created_at: NOW,
  updated_at: NOW,
};

const samplePlans = [
  {
    id: 'plan-001',
    judgment_id: 'judgment-001',
    plan_content: '建立一份每週家務與照顧分工表，並在週日晚一起檢視。',
    plan_type: 'communication',
    difficulty_level: 'easy',
    estimated_duration: 7,
    time_cost: 2,
    money_cost: 1,
    emotion_cost: 2,
    skill_requirement: 2,
    user1_selected: true,
    user2_selected: false,
    created_at: NOW,
  },
  {
    id: 'plan-002',
    judgment_id: 'judgment-001',
    plan_content: '安排一次不討論爭議內容的約會，重新建立正向互動。',
    plan_type: 'activity',
    difficulty_level: 'medium',
    estimated_duration: 14,
    time_cost: 3,
    money_cost: 2,
    emotion_cost: 3,
    skill_requirement: 2,
    user1_selected: false,
    user2_selected: false,
    created_at: NOW,
  },
];

const sampleExecutionStatus = {
  plan_id: 'plan-001',
  status: 'in_progress',
  progress: 60,
  plan_summary: {
    title: '每週家務協調',
    plan_type: 'communication',
    difficulty_level: 'easy',
    estimated_duration: 7,
  },
  records: [
    {
      id: 'exec-001',
      reconciliation_plan_id: 'plan-001',
      user_id: 'user-001',
      action: 'confirm',
      status: 'completed',
      notes: '已確認開始執行',
      photos_urls: [],
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: 'exec-002',
      reconciliation_plan_id: 'plan-001',
      user_id: 'user-001',
      action: 'checkin',
      status: 'completed',
      notes: '第一週已完成分工討論',
      photos_urls: ['https://placehold.co/400x240?text=Check-in'],
      created_at: NOW,
      updated_at: NOW,
    },
  ],
};

const samplePsychProfile = {
  consent_given: true,
  consent_at: NOW,
  richness_score: 74,
  narratives: [
    {
      id: 'nar-001',
      domain: 'attachment',
      ai_summary: '在衝突時傾向先壓抑，累積到臨界點後一次爆發。',
      completeness: 0.8,
      word_count: 180,
      is_latest: true,
    },
  ],
  insights: [
    {
      id: 'ins-001',
      domain: 'belief_values',
      insight_type: 'belief',
      key: 'responsibility',
      value: '把主動分擔視為關係承諾的重要證據。',
      confidence: 0.86,
      evidence: '多次提及希望對方自發協助',
      is_active: true,
    },
  ],
};

const sampleFeedbackHistory = [
  {
    session_id: 'session-001',
    feedback_card: JSON.stringify({
      summary: '你在關係中重視穩定與可預期，也對責任分工有明確期待。',
      domains_explored: ['attachment', 'belief_values', 'relationship_history'],
      domains_unexplored: ['family_origin'],
      key_insights: ['你很在意被看見與被主動支持', '衝突時傾向先忍耐後爆發'],
      richness_score: 74,
      encouragement: '你已經能清楚說出需求，下一步是更早表達。',
      continuation_hint: '可以回到訪談繼續補充原生家庭對衝突的影響。',
    }),
    domains_touched: ['attachment', 'belief_values', 'relationship_history'],
    created_at: NOW,
    updated_at: NOW,
  },
];

const sampleInterviewSession = {
  id: 'session-001',
  user_id: 'user-001',
  status: 'completed',
  trigger: 'pre_case',
  ai_model_used: 'gpt-5',
  total_user_words: 480,
  total_ai_words: 620,
  domains_touched: ['attachment', 'belief_values', 'relationship_history'],
  pipeline_step: 4,
  partial_success: false,
  started_at: NOW,
  ended_at: NOW,
  created_at: NOW,
  updated_at: NOW,
  feedback_card: JSON.stringify({
    summary: '你傾向先維持關係表面穩定，再慢慢累積委屈。',
    domains_explored: ['attachment', 'belief_values', 'relationship_history'],
    domains_unexplored: ['family_origin'],
    key_insights: ['需要更早說出需求', '對責任公平高度敏感'],
    richness_score: 74,
    encouragement: '你的自我覺察很高，已能辨識衝突模式。',
    continuation_hint: '可以持續訪談，補足原生家庭與壓力事件脈絡。',
  }),
  turns: [
    {
      id: 'turn-001',
      turn_order: 1,
      ai_message: '最近最常讓你感到失望的互動是什麼？',
      skipped: false,
      safety_flag: false,
      created_at: NOW,
    },
    {
      id: 'turn-002',
      turn_order: 2,
      ai_message: '',
      user_response: '當家務和照顧安排又落到我身上時，我會覺得自己被理所當然地依賴。',
      skipped: false,
      safety_flag: false,
      created_at: NOW,
    },
    {
      id: 'turn-003',
      turn_order: 3,
      ai_message: '你比較在意的是事情本身，還是對方沒有主動意識到你的負擔？',
      skipped: false,
      safety_flag: false,
      created_at: NOW,
    },
  ],
};

const sampleRoom = {
  id: 'room-001',
  status: 'group_active',
  owner_user_id: 'user-001',
  session_id: QUICK_SESSION_ID,
  history_visibility_mode: 'share_summary_only',
  created_at: NOW,
  updated_at: NOW,
  participants: [
    {
      id: 'part-a',
      room_id: 'room-001',
      participant_type: 'user',
      user_id: 'user-001',
      role_in_room: 'roleA',
      joined_at: NOW,
      left_at: null,
      is_active: true,
    },
    {
      id: 'part-b',
      room_id: 'room-001',
      participant_type: 'user',
      user_id: 'user-002',
      role_in_room: 'roleB',
      joined_at: NOW,
      left_at: null,
      is_active: true,
    },
    {
      id: 'part-ai',
      room_id: 'room-001',
      participant_type: 'ai',
      user_id: null,
      role_in_room: 'aiMediator',
      joined_at: NOW,
      left_at: null,
      is_active: true,
    },
  ],
};

const sampleMessages = [
  {
    id: 'msg-001',
    room_id: 'room-001',
    sender_participant_id: 'part-a',
    content: '我希望我們能把家務與照顧安排講清楚。',
    message_type: 'user_text',
    visibility_scope: 'all',
    safety_flag: false,
    created_at: NOW,
    sender_participant: sampleRoom.participants[0],
  },
  {
    id: 'msg-002',
    room_id: 'room-001',
    sender_participant_id: 'part-b',
    content: '我同意，但我也想知道你最在意的幾件事是什麼。',
    message_type: 'user_text',
    visibility_scope: 'all',
    safety_flag: false,
    created_at: NOW,
    sender_participant: sampleRoom.participants[1],
  },
  {
    id: 'msg-003',
    room_id: 'room-001',
    sender_participant_id: 'part-ai',
    content: '建議先列出固定事項，再分辨哪些屬於緊急協助。',
    message_type: 'ai_mediation',
    visibility_scope: 'all',
    ai_strategy: 'de-escalate-and-structure',
    ai_confidence: 0.89,
    safety_flag: false,
    created_at: NOW,
    sender_participant: sampleRoom.participants[2],
  },
];

const sampleContentItems = [
  {
    id: 'content-001',
    title: '如何在衝突中表達需求',
    content: '先描述具體行為，再說明自己的感受與期待。',
    content_type: 'tip',
    tags: ['communication', 'conflict'],
    language: 'zh-TW',
    is_active: true,
    created_at: NOW,
  },
  {
    id: 'content-002',
    title: '家務分工範例',
    content: '把固定任務與臨時任務拆開，可以降低摩擦。',
    content_type: 'article',
    tags: ['household'],
    language: 'zh-TW',
    is_active: true,
    created_at: NOW,
  },
];

const adminMe = {
  admin: {
    id: 'admin-001',
    email: 'ops@example.com',
    roleKey: 'super_admin',
    permissions: ['ops:read', 'config:read', 'users:read', 'reports:read', 'admin:all'],
  },
};

const adminJobsStats = {
  days: 7,
  since: NOW,
  totals: {
    totalRuns: 182,
    successRuns: 170,
    failedRuns: 8,
    runningRuns: 4,
    completedRuns: 178,
    successRate: 93.4,
    failureRate: 4.4,
    successRateCompleted: 95.5,
    failureRateCompleted: 4.5,
    avgDurationMs: 4832,
  },
  perJob: [
    {
      jobKey: 'nightly-judgment-refresh',
      totalRuns: 42,
      successRuns: 39,
      failedRuns: 2,
      runningRuns: 1,
      completedRuns: 41,
      successRate: 92.9,
      failureRate: 4.8,
      successRateCompleted: 95.1,
      failureRateCompleted: 4.9,
      avgDurationMs: 6400,
      totalAffectedCount: 280,
      lastRunAt: NOW,
    },
  ],
  dailyBuckets: [
    {
      date: '2026-03-11',
      totalRuns: 22,
      successRuns: 21,
      failedRuns: 1,
      runningRuns: 0,
      completedRuns: 22,
      successRate: 95.5,
      failureRate: 4.5,
      successRateCompleted: 95.5,
      failureRateCompleted: 4.5,
    },
  ],
  rateBase: 'total_runs',
  statsMeta: { maxRows: 5000, returnedRows: 182, sampled: false, sampleStrategy: 'latest_runs_desc' },
};

const adminHealth = {
  status: 'ok',
  timestamp: NOW,
  cronStarted: true,
  activeJobCount: 4,
  adminCount: 3,
  userCount: 128,
  performance: { uptimeSec: 86400, memoryMb: 312, avgResponseMs: 128 },
  env: { nodeEnv: 'production', scheduledJobsEnabled: true },
};

const adminJobs = {
  jobs: [
    {
      key: 'nightly-judgment-refresh',
      schedule: '0 2 * * *',
      running: false,
      latestRun: {
        id: 'job-run-001',
        status: 'completed',
        started_at: NOW,
        finished_at: NOW,
        duration_ms: 5800,
        affected_count: 37,
      },
    },
    {
      key: 'cleanup-expired-sessions',
      schedule: '*/30 * * * *',
      running: true,
      latestRun: {
        id: 'job-run-002',
        status: 'running',
        started_at: NOW,
        finished_at: null,
        duration_ms: null,
        affected_count: null,
      },
    },
  ],
};

const adminConfigs = {
  items: [
    {
      id: 'cfg-001',
      key: 'feature.quick_experience_enabled',
      value: true,
      description: '是否開啟快速體驗',
      is_sensitive: false,
      is_runtime: true,
      updated_by: 'admin-001',
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const adminUsers = {
  items: [
    {
      id: 'user-001',
      email: 'alex@example.com',
      nickname: 'Alex',
      is_active: true,
      email_verified: true,
      login_failed_attempts: 0,
      locked_until: null,
      created_at: NOW,
      last_login_at: NOW,
      deleted_at: null,
    },
    {
      id: 'user-002',
      email: 'taylor@example.com',
      nickname: 'Taylor',
      is_active: true,
      email_verified: true,
      login_failed_attempts: 1,
      locked_until: null,
      created_at: NOW,
      last_login_at: NOW,
      deleted_at: null,
    },
  ],
  total: 2,
  limit: 50,
  offset: 0,
};

const adminAuditLogs = {
  items: [
    {
      id: 'audit-001',
      actor_id: 'admin-001',
      actor_type: 'admin',
      entity_type: 'config',
      entity_id: 'cfg-001',
      action: 'update',
      detail: { key: 'feature.quick_experience_enabled', from: false, to: true },
      created_at: NOW,
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const adminOverview = {
  totals: {
    users: 128,
    activePairings: 41,
    cases: 93,
    judgments: 77,
    reconciliationPlans: 65,
    executionCompleted: 28,
    interviewCompleted: 54,
  },
  conversion: {
    pairingRate: 32.1,
    caseCreationRate: 72.4,
    judgmentCompletionRate: 82.8,
    caseCompletionRate: 68.5,
  },
};

const adminFunnel = {
  stages: [
    { key: 'registered', count: 128 },
    { key: 'paired', count: 41 },
    { key: 'case_created', count: 93 },
    { key: 'judgment_completed', count: 77 },
  ],
};

const adminCosts = {
  generatedAt: NOW,
  currency: 'USD',
  partial: false,
  reasons: [],
  summary: {
    redisMemoryMb: 142,
    redisTotalKeys: 4120,
    railwayEgressGb24h: 2.1,
    railwayEgressGb7d: 15.7,
    openaiCostUsd24h: 34.7,
    openaiCostUsd7d: 219.4,
    openaiInputTokens24h: 320000,
    openaiOutputTokens24h: 186000,
  },
  redis: { status: 'ok', memoryUsedBytes: 148897792, connectedClients: 22, totalKeys: 4120 },
  railway: {
    status: 'ok',
    egressGb24h: 2.1,
    egressGb7d: 15.7,
    dailyEgressGb: [{ date: '2026-03-11', value: 2.1 }],
  },
  openai: {
    status: 'ok',
    costUsd24h: 34.7,
    costUsd7d: 219.4,
    inputTokens24h: 320000,
    outputTokens24h: 186000,
    dailyCostUsd: [{ date: '2026-03-11', value: 34.7 }],
  },
};

const adminRuntime = {
  defaults: { maxTurns: 12, timeoutSec: 45 },
  runtime: { maxTurns: 12, timeoutSec: 45 },
  source: 'db',
};

const adminAdminUsers = {
  items: [
    {
      id: 'admin-001',
      email: 'ops@example.com',
      name: 'Ops Lead',
      is_active: true,
      last_login_at: NOW,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      role: { key: 'super_admin', name: 'Super Admin', permissions: ['admin:all'] },
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const FRONTEND_ROUTES = [
  { file: 'home.html', path: '/', auth: 'public', waitFor: 'main' },
  { file: 'case-list.html', path: '/case/list', auth: 'user', waitFor: 'main' },
  { file: 'case-create.html', path: '/case/create', auth: 'user', waitFor: 'main' },
  { file: 'case-detail.html', path: '/case/case-001', auth: 'user', waitFor: 'main' },
  { file: 'case-review.html', path: '/case/case-001/review', auth: 'user', waitFor: 'main' },
  { file: 'judgment-detail.html', path: '/judgment/judgment-001', auth: 'user', waitFor: 'main' },
  { file: 'reconciliation-list.html', path: '/reconciliation/judgment-001', auth: 'user', waitFor: 'main' },
  { file: 'reconciliation-detail.html', path: '/reconciliation/judgment-001/plan-001', auth: 'user', waitFor: 'main' },
  { file: 'execution-dashboard.html', path: '/execution/dashboard', auth: 'user', waitFor: 'main' },
  { file: 'execution-checkin.html', path: '/execution/plan-001/checkin', auth: 'user', waitFor: 'main' },
  { file: 'profile-index.html', path: '/profile/index', auth: 'user', waitFor: 'main' },
  { file: 'profile-settings.html', path: '/profile/settings', auth: 'user', waitFor: 'main' },
  { file: 'profile-pairing.html', path: '/profile/pairing', auth: 'user', waitFor: 'main' },
  { file: 'profile-my-story.html', path: '/profile/my-story', auth: 'user', waitFor: 'main' },
  { file: 'interview-chat.html', path: '/interview/session-001', auth: 'user', waitFor: '.interview-chat' },
  { file: 'interview-result.html', path: '/interview/session-001/result', auth: 'user', waitFor: '.interview-result' },
  { file: 'chat-room-entry.html', path: '/chat/room', auth: 'user', waitFor: 'main' },
  { file: 'chat-room.html', path: '/chat/room/room-001', auth: 'user', waitFor: 'main' },
  { file: 'quick-experience-create.html', path: '/quick-experience/create', auth: 'quick', waitFor: 'main' },
  { file: 'quick-experience-result.html', path: '/quick-experience/result/case-quick-001', auth: 'quick', waitFor: 'main' },
  { file: 'quick-experience-collaborative.html', path: '/quick-experience/collaborative', auth: 'quick', waitFor: 'main' },
  { file: 'auth-login.html', path: '/auth/login', auth: 'public', waitFor: 'main' },
  { file: 'auth-register.html', path: '/auth/register', auth: 'public', waitFor: 'main' },
  { file: 'auth-forgot-password.html', path: '/auth/forgot-password', auth: 'public', waitFor: 'main' },
  { file: 'not-found.html', path: '/this-route-does-not-exist', auth: 'public', waitFor: 'main' },
];

const ADMIN_ROUTES = [
  { file: 'admin-login.html', path: '/admin/login', auth: 'public', waitFor: 'main' },
  { file: 'ops-jobs.html', path: '/admin/ops/jobs', auth: 'admin', waitFor: 'main' },
  { file: 'jobs.html', path: '/admin/jobs', auth: 'admin', waitFor: 'main' },
  { file: 'health.html', path: '/admin/health', auth: 'admin', waitFor: 'main' },
  { file: 'configs.html', path: '/admin/configs', auth: 'admin', waitFor: 'main' },
  { file: 'users.html', path: '/admin/users', auth: 'admin', waitFor: 'main' },
  { file: 'audit-logs.html', path: '/admin/audit-logs', auth: 'admin', waitFor: 'main' },
  { file: 'reports.html', path: '/admin/reports', auth: 'admin', waitFor: 'main' },
  { file: 'settings.html', path: '/admin/settings', auth: 'admin', waitFor: 'main' },
];

function success(data) {
  return { success: true, data };
}

function notFound(message = 'Not found') {
  return { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message } } };
}

function parseUrl(url) {
  return new URL(url);
}

function jsonResponse(route, payload, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  });
}

function textResponse(route, body, contentType) {
  return route.fulfill({ status: 200, contentType, body });
}

function frontendMockResponse(url, method) {
  const pathname = url.pathname.replace('/api/v1', '');
  if (pathname === '/user/profile' && method === 'GET') return success({ user: sampleUser });
  if (pathname === '/pairing/status' && method === 'GET') return success({ pairing: samplePairing });
  if (pathname === '/pairing/create' && method === 'POST') return success({ pairing: samplePairing });
  if (pathname === '/pairing/join' && method === 'POST') return success({ pairing: samplePairing });
  if (pathname === '/pairing/cancel' && method === 'POST') return success({ pairing: { ...samplePairing, status: 'cancelled' } });
  if (pathname === '/psych-profile' && method === 'GET') return success(samplePsychProfile);
  if (pathname === '/psych-profile/feedback' && method === 'GET') return success({ history: sampleFeedbackHistory });
  if (pathname === '/psych-profile/consent' && method === 'POST') return success({ ok: true });
  if (pathname === '/sessions/quick' && method === 'POST') return success({ session_id: QUICK_SESSION_ID, expires_at: '2026-03-18T12:00:00.000Z' });
  if (pathname === '/sessions/refresh' && method === 'POST') return success({ session_id: QUICK_SESSION_ID, expires_at: '2026-03-18T12:00:00.000Z' });
  if (pathname === '/cases' && method === 'GET') {
    return success({
      cases: [sampleCase, quickCase],
      pagination: { page: 1, page_size: 10, total: 2, total_pages: 1 },
    });
  }
  if (pathname === '/cases/by-session' && method === 'GET') return success({ case: quickCase });
  if (pathname === '/cases/quick' && method === 'POST') return success({ case: quickCase, session_id: QUICK_SESSION_ID, session_expires_at: '2026-03-18T12:00:00.000Z' });
  if (pathname === '/cases' && method === 'POST') return success({ case: sampleCase });
  if (pathname === '/cases/collaborative' && method === 'POST') {
    return success({ case: { ...quickCase, mode: 'collaborative' }, session_id: QUICK_SESSION_ID, session_expires_at: '2026-03-18T12:00:00.000Z', phase: 'submitted' });
  }
  if (pathname === '/content-items' && method === 'GET') return success({ items: sampleContentItems });
  if (pathname === '/interview/start' && method === 'POST') return success(sampleInterviewSession);
  if (pathname === '/interview/resume' && method === 'GET') return success({ has_pending: false, has_failed: false });
  if (pathname === `/interview/${sampleInterviewSession.id}` && method === 'GET') return success(sampleInterviewSession);
  if (pathname === `/interview/${sampleInterviewSession.id}/retry` && method === 'POST') return success({ ok: true });
  if (pathname === `/interview/${sampleInterviewSession.id}/end` && method === 'POST') return success({ ok: true });
  if (pathname === '/execution/dashboard' && method === 'GET') return success({ executions: [sampleExecutionStatus] });
  if (pathname === '/execution/status' && method === 'GET') return success(sampleExecutionStatus);
  if (pathname === '/execution/confirm' && method === 'POST') return success({ execution: sampleExecutionStatus.records[0] });
  if (pathname === '/execution/checkin' && method === 'POST') return success({ execution: sampleExecutionStatus.records[1] });
  if (pathname === `/profile/relationship/${samplePairing.id}` && method === 'GET') {
    return success({
      profile: {
        pairing_id: samplePairing.id,
        relationship_duration_days: 860,
        relationship_stage: 'long_term',
        communication_frequency: 'daily',
        preferred_communication_methods: ['face_to_face', 'messaging'],
        relationship_strengths: '願意一起面對問題',
        relationship_challenges: '衝突時容易用沉默拖延',
        completion_percentage: 82,
        last_updated_at: NOW,
      },
    });
  }
  if (pathname.startsWith('/profile/relationship/') && method === 'PUT') {
    return success({
      profile: {
        pairing_id: samplePairing.id,
        relationship_duration_days: 860,
        relationship_stage: 'long_term',
        communication_frequency: 'daily',
        preferred_communication_methods: ['face_to_face', 'messaging'],
        relationship_strengths: '願意一起面對問題',
        relationship_challenges: '衝突時容易用沉默拖延',
        completion_percentage: 82,
        last_updated_at: NOW,
      },
    });
  }
  if (pathname === '/auth/send-verification-code' && method === 'POST') return success({});
  if (pathname === '/auth/verify-email' && method === 'POST') return success({ verified: true });
  if (pathname === '/auth/reset-password' && method === 'POST') return success({});
  if (pathname === '/auth/reset-password-confirm' && method === 'POST') return success({});
  if (pathname === '/auth/login' && method === 'POST') return success({ user: sampleUser, token: USER_TOKEN });
  if (pathname === '/auth/register' && method === 'POST') return success({ user: sampleUser, token: USER_TOKEN });
  if (pathname === '/auth/claim-session' && method === 'POST') return success({ case_id: quickCase.id });
  if (pathname.startsWith('/cases/') && pathname.endsWith('/submit') && method === 'POST') return success({ case: { ...sampleCase, status: 'submitted' } });
  if (pathname.startsWith('/cases/') && pathname.endsWith('/evidence') && method === 'POST') {
    return success({ evidences: [{ id: 'evi-002', file_url: 'https://placehold.co/640x360?text=Uploaded', file_type: 'image' }] });
  }
  if (pathname.startsWith('/cases/') && method === 'PUT') return success({ case: sampleCase });
  if (pathname === `/cases/${sampleCase.id}` && method === 'GET') return success({ case: sampleCase });
  if (pathname === `/cases/${quickCase.id}` && method === 'GET') return success({ case: quickCase });
  if (pathname === `/cases/${sampleCase.id}/judgment` && method === 'GET') return success({ judgment: sampleJudgment });
  if (pathname === `/cases/${quickCase.id}/judgment` && method === 'GET') return success({ judgment: { ...sampleJudgment, id: 'judgment-quick-001', case_id: quickCase.id } });
  if (pathname.startsWith('/judgments/generate/') && method === 'POST') return success({ judgment: sampleJudgment });
  if (pathname === `/judgments/${sampleJudgment.id}` && method === 'GET') return success({ judgment: sampleJudgment });
  if (pathname === `/judgments/${sampleJudgment.id}/accept` && method === 'POST') return success({ judgment: sampleJudgment });
  if (pathname === `/judgments/${sampleJudgment.id}/reconciliation-plans` && method === 'POST') return success({ plans: samplePlans });
  if (pathname === `/judgments/${sampleJudgment.id}/reconciliation-plans` && method === 'GET') return success({ plans: samplePlans });
  if (pathname === `/reconciliation-plans/${samplePlans[0].id}` && method === 'GET') {
    return success({ plan: { ...samplePlans[0], judgment: { case_id: sampleCase.id } } });
  }
  if (pathname === `/reconciliation-plans/${samplePlans[0].id}/select` && method === 'POST') return success({ plan: samplePlans[0] });
  if (pathname === '/chat/rooms' && method === 'POST') return success({ room: sampleRoom });
  if (pathname === `/chat/rooms/${sampleRoom.id}` && method === 'GET') return success({ room: sampleRoom });
  if (pathname === `/chat/rooms/${sampleRoom.id}/messages` && method === 'GET') return success({ messages: sampleMessages, nextCursor: null });
  if (pathname === `/chat/rooms/${sampleRoom.id}/messages` && method === 'POST') return success({ message: sampleMessages[0] });
  if (pathname === `/chat/rooms/${sampleRoom.id}/invites` && method === 'POST') {
    return success({ invite: { id: 'invite-001', room_id: sampleRoom.id, inviter_participant_id: 'part-a', invited_user_id: null, invite_code: 'ROOM2026', status: 'pending', expires_at: NOW, responded_at: null, created_at: NOW } });
  }
  if (pathname === '/chat/invites/ROOM2026/accept' && method === 'POST') return success({ room: sampleRoom });
  if (pathname === '/chat/invites/ROOM2026/decline' && method === 'POST') {
    return success({ invite: { id: 'invite-001', room_id: sampleRoom.id, inviter_participant_id: 'part-a', invited_user_id: null, invite_code: 'ROOM2026', status: 'declined', expires_at: NOW, responded_at: NOW, created_at: NOW } });
  }
  if (pathname === `/chat/rooms/${sampleRoom.id}/request-judgment` && method === 'POST') return success({ roomId: sampleRoom.id, caseId: sampleCase.id, judgmentId: sampleJudgment.id, linkId: 'link-001', status: 'judgment_completed' });
  if (pathname === `/chat/rooms/${sampleRoom.id}/judgment-status` && method === 'GET') {
    return success({
      roomStatus: 'group_active',
      latestLink: {
        id: 'link-001',
        case: { id: sampleCase.id, status: sampleCase.status, mode: sampleCase.mode, submitted_at: NOW, completed_at: NOW },
        judgment: { id: sampleJudgment.id, created_at: NOW, plaintiff_ratio: 55, defendant_ratio: 45 },
      },
    });
  }
  if (pathname === `/chat/rooms/${sampleRoom.id}/leave` && method === 'POST') return success({ room: sampleRoom });
  if (pathname === `/chat/rooms/${sampleRoom.id}/kick-b` && method === 'POST') return success({ room: sampleRoom });
  if (pathname.startsWith('/admin/')) {
    return frontendAdminMockResponse(url, method);
  }
  return notFound(`No mock for ${method} ${pathname}`);
}

function frontendAdminMockResponse(url, method) {
  const pathname = url.pathname.replace('/api/v1', '');
  if (pathname === '/admin/login' && method === 'POST') {
    return success({
      token: ADMIN_TOKEN,
      admin: { id: 'admin-001', email: 'ops@example.com', name: 'Ops Lead', role: 'super_admin', permissions: adminMe.admin.permissions },
    });
  }
  if (pathname === '/admin/me' && method === 'GET') return success(adminMe);
  if (pathname === '/admin/jobs/stats' && method === 'GET') return success(adminJobsStats);
  if (pathname === '/admin/health/detailed' && method === 'GET') return success(adminHealth);
  if (pathname === '/admin/jobs' && method === 'GET') return success(adminJobs);
  if (pathname.startsWith('/admin/jobs/') && pathname.endsWith('/trigger') && method === 'POST') {
    const parts = pathname.split('/');
    const jobKey = parts[3];
    return success({ jobKey, triggeredAt: NOW, status: 'queued', note: 'Snapshot mock trigger accepted' });
  }
  if (pathname === '/admin/configs' && method === 'GET') return success(adminConfigs);
  if (pathname.startsWith('/admin/configs/') && method === 'PUT') return success({ item: adminConfigs.items[0], runtime: { jobsEnabled: true } });
  if (pathname === '/admin/users' && method === 'GET') return success(adminUsers);
  if (pathname === '/admin/users/user-001' && method === 'GET') return success({ user: adminUsers.items[0] });
  if (pathname.startsWith('/admin/users/') && method === 'PATCH') return success({ user: adminUsers.items[0] });
  if (pathname === '/admin/audit-logs' && method === 'GET') return success(adminAuditLogs);
  if (pathname === '/admin/audit-logs.csv' && method === 'GET') return { status: 200, body: 'id,action\n001,update\n', contentType: 'text/csv; charset=utf-8' };
  if (pathname === '/admin/reports/overview' && method === 'GET') return success(adminOverview);
  if (pathname === '/admin/reports/funnel' && method === 'GET') return success(adminFunnel);
  if (pathname === '/admin/reports/costs' && method === 'GET') return success(adminCosts);
  if (pathname === '/admin/reports/custom' && method === 'POST') return success({ metrics: { retention_7d: 42, dispute_resolution_rate: 68 } });
  if (pathname === '/admin/reports/overview.csv' && method === 'GET') return { status: 200, body: 'metric,value\nusers,128\n', contentType: 'text/csv; charset=utf-8' };
  if (pathname === '/admin/runtime/interview' && method === 'GET') return success(adminRuntime);
  if (pathname === '/admin/runtime/interview/alert-rules' && method === 'PUT') return success({ item: adminConfigs.items[0] });
  if (pathname === '/admin/runtime/interview/feature-flags' && method === 'PUT') return success({ item: adminConfigs.items[0] });
  if (pathname === '/admin/admin-users' && method === 'GET') return success(adminAdminUsers);
  if (pathname === '/admin/admin-users' && method === 'POST') return success({ item: adminAdminUsers.items[0] });
  if (pathname.startsWith('/admin/admin-users/') && method === 'PATCH') return success({ item: adminAdminUsers.items[0] });
  if (pathname.startsWith('/admin/admin-users/') && method === 'DELETE') return success({ item: adminAdminUsers.items[0] });
  return notFound(`No admin mock for ${method} ${pathname}`);
}

async function mockApi(route) {
  const request = route.request();
  const url = parseUrl(request.url());
  const method = request.method();
  const pathname = url.pathname;

  if (pathname.endsWith(`/chat/rooms/${sampleRoom.id}/stream`)) {
    return textResponse(
      route,
      [
        'event: ready',
        `data: ${JSON.stringify({ type: 'ready', roomId: sampleRoom.id, at: NOW })}`,
        '',
        'event: ping',
        `data: ${JSON.stringify({ type: 'ping', roomId: sampleRoom.id, at: NOW })}`,
        '',
      ].join('\n'),
      'text/event-stream; charset=utf-8',
    );
  }

  const payload =
    pathname.includes('/admin/')
      ? frontendAdminMockResponse(url, method)
      : frontendMockResponse(url, method);

  if (payload.contentType) {
    return textResponse(route, payload.body, payload.contentType);
  }

  return jsonResponse(route, payload.body ?? payload, payload.status ?? 200);
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

function startViteServer(cwd, port) {
  const child = spawn(
    'npm',
    ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', String(port)],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

function buildStorageState(auth) {
  const init = {
    local: {},
    session: {},
  };

  if (auth === 'user') {
    init.local.token = USER_TOKEN;
    init.local['auth-storage'] = JSON.stringify({ state: { user: sampleUser }, version: 0 });
  }

  if (auth === 'quick') {
    init.local[`pending_evidence_${quickCase.id}`] = 'true';
    init.session.quick_session_id = QUICK_SESSION_ID;
    init.local.quick_session_id = QUICK_SESSION_ID;
  }

  if (auth === 'admin') {
    init.session.admin_token = ADMIN_TOKEN;
  }

  return init;
}

async function preparePage(page, auth) {
  await page.route('**/api/v1/**', mockApi);
  await page.addInitScript(({ auth, sampleUser, userToken, adminToken, quickSessionId }) => {
    const setItem = (storage, key, value) => {
      try {
        storage.setItem(key, value);
      } catch {
        // noop
      }
    };

    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // noop
    }

    setItem(window.localStorage, 'locale', 'zh-TW');

    if (auth === 'user') {
      setItem(window.localStorage, 'token', userToken);
      setItem(window.localStorage, 'auth-storage', JSON.stringify({ state: { user: sampleUser }, version: 0 }));
    }

    if (auth === 'quick') {
      setItem(window.localStorage, 'quick_session_id', quickSessionId);
      setItem(window.sessionStorage, 'quick_session_id', quickSessionId);
      setItem(window.localStorage, `pending_evidence_case-quick-001`, 'true');
    }

    if (auth === 'admin') {
      setItem(window.sessionStorage, 'admin_token', adminToken);
    }
  }, { auth, sampleUser, userToken: USER_TOKEN, adminToken: ADMIN_TOKEN, quickSessionId: QUICK_SESSION_ID });
}

function sanitizeHtml(html, title) {
  return (
    '<!doctype html>\n' +
    html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<link[^>]+rel="icon"[^>]*>/gi, '')
      .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
  );
}

async function exportRoute(browser, { baseUrl, auth, file, outDir, path: routePath, waitFor }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  console.log(`[export] start ${file} <- ${routePath}`);
  try {
    await preparePage(page, auth);
    await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 60000 }).catch(() => undefined);
    }
    await page.waitForTimeout(1800);
    const html = await page.content();
    const output = sanitizeHtml(html, file.replace(/\.html$/, ''));
    await fs.writeFile(path.join(outDir, file), output, 'utf8');
    console.log(`[export] done ${file}`);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(`[export] failed ${file}: ${message}`);
    const fallback = `<!doctype html><html><head><meta charset="utf-8"><title>${file}</title></head><body><pre>${message.replace(/[<&]/g, (m) => (m === '<' ? '&lt;' : '&amp;'))}</pre></body></html>`;
    await fs.writeFile(path.join(outDir, file), fallback, 'utf8');
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function writeManifest() {
  const manifest = {
    generated_at: new Date().toISOString(),
    frontend: FRONTEND_ROUTES.map((item) => ({ file: `frontend/${item.file}`, route: item.path })),
    admin: ADMIN_ROUTES.map((item) => ({ file: `frontend-admin/${item.file}`, route: item.path })),
  };
  await fs.writeFile(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

async function ensureOutputDirs() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(FRONTEND_OUT, { recursive: true });
  await fs.mkdir(ADMIN_OUT, { recursive: true });
}

async function main() {
  await ensureOutputDirs();
  const frontendServer = startViteServer(FRONTEND_DIR, FRONTEND_PORT);
  const adminServer = startViteServer(ADMIN_DIR, ADMIN_PORT);
  const stop = async () => {
    frontendServer.kill('SIGTERM');
    adminServer.kill('SIGTERM');
  };

  process.on('SIGINT', async () => {
    await stop();
    process.exit(130);
  });

  try {
    await waitForServer(FRONTEND_BASE);
    await waitForServer(`${ADMIN_BASE}/admin/login`);

    const browser = await chromium.launch({ headless: true });
    try {
      for (const route of FRONTEND_ROUTES) {
        await exportRoute(browser, { ...route, baseUrl: FRONTEND_BASE, outDir: FRONTEND_OUT });
      }
      for (const route of ADMIN_ROUTES) {
        await exportRoute(browser, { ...route, baseUrl: ADMIN_BASE, outDir: ADMIN_OUT });
      }
    } finally {
      await browser.close();
    }

    await writeManifest();
  } finally {
    await stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
