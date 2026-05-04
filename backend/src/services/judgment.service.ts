import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { normalizeJudgmentWithSafetyState } from './judgment-normalization.service';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { aiService } from './ai.service';
import { AI_CONFIG } from '../config/openai';
import { sessionService } from './session.service';
import { lockService } from '../utils/lock';
import { isResponsibilityRatio } from '../types/ai.types';
import { AI_TIMEOUT, CASE_STATUS, CASE_MODE } from '../utils/constants';
import { cacheService, CacheService } from '../utils/cache';
import { profileSnapshotService } from './profile-snapshot.service';
import { profileRichnessService } from './profile-richness.service';
import { getRichnessLevel, RichnessLevel } from '../types/interview.types';
import { caseContextService } from './case-context.service';
import { safetyRoutingService } from './safety-routing.service';
import { ruptureRepairService } from './rupture-repair.service';
import { clinicalQualityService } from './clinical-quality.service';
import { env } from '../config/env';
import { aiStreamService } from './ai-stream.service';
import {
  buildCaseSourceTrackingForRead,
  canAccessSessionBoundCase,
  isCaseParticipant,
  isSessionBoundCase,
  isUserBoundProductCase,
} from '../utils/case-classifier';
import {
  getJudgmentMetricsPromptVersion,
  getStoredJudgmentPromptVersion,
} from '../utils/ai-prompt-version';

// ─── 關係互動層模板匹配（Step 4B）──────────────────
// 使用雙方洞察的 key/value 查表生成，零額外 AI 成本

interface InsightRow {
  domain: string;
  insight_type: string;
  key: string;
  value: string;
  confidence: number;
}

type AttachmentTendency = 'anxious' | 'avoidant' | 'secure' | 'disorganized' | 'unknown';

const ANXIOUS_PATTERN = /焦慮|追求確認|追逐|不安全|害怕被拋棄|需要回應|黏|過度敏感|已讀不回/i;
const AVOIDANT_PATTERN = /迴避|逃避|獨處|撤退|空間|退縮|情緒淹沒|自我保護|冷處理/i;
const SECURE_PATTERN = /安全|穩定|信任|自在|彈性|平衡/i;
const DISORGANIZED_PATTERN = /混亂|矛盾|又推又拉|反覆|不穩定|既想靠近又想逃/i;

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(new RegExp(pattern.source, 'gi'));
  return matches ? matches.length : 0;
}

function classifyAttachment(insights: InsightRow[]): AttachmentTendency {
  const attachmentInsights = insights.filter(i => i.domain === 'attachment');
  if (attachmentInsights.length === 0) return 'unknown';

  const combined = attachmentInsights.map(i => `${i.key} ${i.value}`).join(' ');

  const disorganizedHits = countMatches(combined, DISORGANIZED_PATTERN);
  const anxiousHits = countMatches(combined, ANXIOUS_PATTERN);
  const avoidantHits = countMatches(combined, AVOIDANT_PATTERN);
  const secureHits = countMatches(combined, SECURE_PATTERN);

  if (disorganizedHits > 0) return 'disorganized';
  if (anxiousHits > 0 && avoidantHits > 0) {
    return anxiousHits >= avoidantHits ? 'anxious' : 'avoidant';
  }

  const ranked: [AttachmentTendency, number][] = [
    ['anxious', anxiousHits],
    ['avoidant', avoidantHits],
    ['secure', secureHits],
  ];
  ranked.sort((a, b) => b[1] - a[1]);

  if (ranked[0][1] === 0) return 'unknown';
  return ranked[0][0];
}

interface PairTemplate {
  prediction: string;
  clinicalNotes: string[];
}

const ATTACHMENT_PAIR_TEMPLATES: Record<string, PairTemplate> = {
  'anxious+avoidant': {
    prediction: 'A 的追求確認 + B 的需要空間 = 可能形成「追逐-撤退」循環：A 越追 → B 越退 → A 更焦慮 → 循環升級。這不是任何一方的「錯」，而是兩種應對模式的碰撞。',
    clinicalNotes: [
      '不要建議 A「不要想太多」「給對方空間」→ 會被感知為「你的感受不重要」',
      '不要建議 B「你應該多表達感受」→ 在情緒淹沒時強迫表達會適得其反',
      '可以建議：建立「暫停協議」— B 撤退前說一句「我需要時間，但我沒有要離開你」',
    ],
  },
  'avoidant+anxious': {
    prediction: 'A 需要空間 + B 追求確認 = 可能形成「撤退-追逐」循環：A 越退 → B 越追 → A 更需要空間 → 循環升級。雙方都在用自己的方式保護關係。',
    clinicalNotes: [
      '不要建議 B「不要那麼敏感」→ 否定了 B 的情感需求',
      '不要建議 A「你就不能多說幾句嗎」→ 增加 A 的壓力感',
      '可以建議：約定「冷靜信號」，A 表達需要空間時附上安慰語',
    ],
  },
  'anxious+anxious': {
    prediction: '雙方都傾向追求確認，可能在衝突中形成「情緒升級」循環：雙方都急於表達自己的焦慮，可能忽略傾聽。但好處是雙方都渴望連結，有共同的情感基礎。',
    clinicalNotes: [
      '雙方可能都會急於表達感受，建議設立「輪流表達」的溝通規則',
      '避免在情緒高漲時同時傾訴，一方先傾聽再回應',
    ],
  },
  'avoidant+avoidant': {
    prediction: '雙方都傾向在衝突時退縮，可能導致問題被擱置而非解決。表面平靜可能掩蓋了未處理的議題。',
    clinicalNotes: [
      '不要只建議「好好坐下來談」→ 雙方都可能抗拒深入對話',
      '可以建議：書面溝通（例如寫信）作為面對面對話的替代或前奏',
    ],
  },
  'secure+anxious': {
    prediction: 'A 較為穩定 + B 需要更多確認 = 關係有穩定的基礎，但 B 可能需要比 A 預期的更多確認和保證。A 的穩定能為 B 提供安全感。',
    clinicalNotes: [
      '不要假設 B 的需要確認是「沒安全感」或「控制」→ 每個人需要確認的程度不同',
      '可以建議 A 主動提供適量的確認，這不是「遷就」而是「愛的語言匹配」',
    ],
  },
  'secure+avoidant': {
    prediction: 'A 較為穩定 + B 需要空間 = A 能給予 B 需要的空間而不感到威脅，但可能對 B 的退縮感到困惑。',
    clinicalNotes: [
      '可以建議 A 給予空間的同時保持「我在這裡」的訊號',
      '幫助 B 理解 A 的穩定不是漠不關心',
    ],
  },
  'anxious+secure': {
    prediction: 'A 需要更多確認 + B 較為穩定 = B 的穩定能安撫 A 的焦慮，但 B 可能有時不理解 A 為什麼需要這麼多保證。',
    clinicalNotes: [
      '幫助 B 理解 A 的確認需求背後的原因（可能與早期經歷有關）',
      '不要要求 A「學 B 一樣淡定」→ 依附模式不是說改就改的',
    ],
  },
  'avoidant+secure': {
    prediction: 'A 需要空間 + B 較為穩定 = B 能包容 A 的退縮而不過度反應，但 A 需要學習在 B 的安全感中逐漸打開。',
    clinicalNotes: [
      '可以建議漸進式的情感分享，而非期望 A 一次性敞開',
    ],
  },
  'secure+secure': {
    prediction: '雙方都有相對穩定的依附模式，這為處理衝突提供了良好基礎。雙方更可能以建設性的方式面對分歧。',
    clinicalNotes: [],
  },
};

const DISORGANIZED_FALLBACK: PairTemplate = {
  prediction: '其中一方的依附模式較為複雜，可能在親密和疏離之間擺盪。這使得衝突中的反應較難預測，雙方都需要更多耐心去理解彼此的模式。',
  clinicalNotes: [
    '避免簡單歸因——複雜的依附模式通常源自早期經歷，不是「故意找麻煩」',
    '不要要求立即改變依附模式，建議漸進式的安全感建立',
  ],
};

const COMM_PATTERN_FEEL = /感受|情緒|共情|情感|溫暖|感性/i;
const COMM_PATTERN_LOGIC = /邏輯|理性|分析|步驟|具體|框架|方案|思維型/i;

function buildInteractionLayer(
  insightsA: InsightRow[],
  insightsB: InsightRow[],
  labelA: string,
  labelB: string
): string | null {
  const parts: string[] = [];

  // 1. 依附配對預測
  const attachA = classifyAttachment(insightsA);
  const attachB = classifyAttachment(insightsB);

  if (attachA !== 'unknown' && attachB !== 'unknown') {
    const pairKey = `${attachA}+${attachB}`;
    const hasDisorganized = attachA === 'disorganized' || attachB === 'disorganized';
    const template = ATTACHMENT_PAIR_TEMPLATES[pairKey] ?? (hasDisorganized ? DISORGANIZED_FALLBACK : null);
    if (template) {
      const prediction = template.prediction.replace(/\bA\b/g, labelA).replace(/\bB\b/g, labelB);
      parts.push(`### 雙方互動模式預測\n${prediction}`);
    }
  }

  // 2. 文化差異點
  const culturalA = insightsA.filter(i => i.domain === 'cultural_background').map(i => `${i.key}：${i.value}`);
  const culturalB = insightsB.filter(i => i.domain === 'cultural_background').map(i => `${i.key}：${i.value}`);
  if (culturalA.length > 0 && culturalB.length > 0) {
    parts.push(`### 文化背景差異\n- ${labelA}：${culturalA.join('；')}\n- ${labelB}：${culturalB.join('；')}\n請注意雙方文化背景差異可能影響對「對錯」和「公平」的理解。`);
  }

  // 3. 溝通風格衝突點（限縮至 personality / education_cognition / relationship_history 域）
  const commDomains = new Set(['personality', 'education_cognition', 'relationship_history']);
  const allA = insightsA.filter(i => commDomains.has(i.domain)).map(i => `${i.key} ${i.value}`).join(' ');
  const allB = insightsB.filter(i => commDomains.has(i.domain)).map(i => `${i.key} ${i.value}`).join(' ');
  const aFeels = COMM_PATTERN_FEEL.test(allA);
  const aLogic = COMM_PATTERN_LOGIC.test(allA);
  const bFeels = COMM_PATTERN_FEEL.test(allB);
  const bLogic = COMM_PATTERN_LOGIC.test(allB);

  if ((aFeels && !aLogic && bLogic && !bFeels) || (aLogic && !aFeels && bFeels && !bLogic)) {
    const feeler = aFeels ? labelA : labelB;
    const thinker = aLogic ? labelA : labelB;
    parts.push(`### 溝通風格差異\n${feeler} 偏好感受層面的連結，${thinker} 偏好邏輯框架式的建議。給予建議時應兼顧雙方偏好：先共情再給方案。`);
  }

  // 4. 臨床注意事項
  const clinicalNotes: string[] = [];
  if (attachA !== 'unknown' && attachB !== 'unknown') {
    const pairKey = `${attachA}+${attachB}`;
    const hasDisorganized = attachA === 'disorganized' || attachB === 'disorganized';
    const template = ATTACHMENT_PAIR_TEMPLATES[pairKey] ?? (hasDisorganized ? DISORGANIZED_FALLBACK : null);
    if (template?.clinicalNotes.length) {
      clinicalNotes.push(...template.clinicalNotes.map(n => n.replace(/\bA\b/g, labelA).replace(/\bB\b/g, labelB)));
    }
  }

  const triggerA = insightsA.filter(i => i.key.includes('觸發') || i.key.includes('雷區') || i.key.includes('敏感'));
  const triggerB = insightsB.filter(i => i.key.includes('觸發') || i.key.includes('雷區') || i.key.includes('敏感'));
  for (const t of triggerA) {
    clinicalNotes.push(`避免對 ${labelA} 說出可能觸發「${t.key}」的建議`);
  }
  for (const t of triggerB) {
    clinicalNotes.push(`避免對 ${labelB} 說出可能觸發「${t.key}」的建議`);
  }

  if (clinicalNotes.length > 0) {
    parts.push(`### 臨床注意事項\n${clinicalNotes.map(n => `- ${n}`).join('\n')}`);
  }

  if (parts.length === 0) return null;
  return parts.join('\n\n');
}

// ─── Token 預算控制（Section 6.4）──────────────────
const PROFILE_TOKEN_BUDGET = 2500;

enum ProfilePriority {
  ALWAYS_KEEP = 1,   // 互動層預測
  HIGH = 2,          // 核心依附 + 觸發點
  MEDIUM = 3,        // 溝通偏好 + 家庭摘要
  LOW = 4,           // 人格/文化/教育
  FIRST_CUT = 5,     // 低 confidence 非核心洞察 + v1 回退
}

interface PrioritizedText {
  text: string;
  priority: ProfilePriority;
}

interface ContextGovernanceAudit {
  profileContext: {
    enabled: boolean;
    injected: boolean;
    reason: string;
    requireConsent: boolean;
    profileMaxAgeDays: number;
    sources: string[];
    droppedParts: number;
    totalTokens: number;
    keptTokens: number;
  };
  caseContext: {
    enabled: boolean;
    injected: boolean;
    reason: string;
  };
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const nonCjkTokens = Math.ceil((text.length - cjkChars) / 4);
  return Math.ceil(cjkChars * 1.5) + nonCjkTokens;
}

function truncateProfileParts(parts: PrioritizedText[]): {
  text: string;
  droppedParts: number;
  totalTokens: number;
  keptTokens: number;
} {
  const totalTokens = parts.reduce((sum, p) => sum + estimateTokens(p.text), 0);
  if (totalTokens <= PROFILE_TOKEN_BUDGET) {
    return {
      text: parts.map(p => p.text).join('\n'),
      droppedParts: 0,
      totalTokens,
      keptTokens: totalTokens,
    };
  }

  const indexed = parts.map((p, i) => ({ ...p, originalIndex: i }));
  indexed.sort((a, b) => a.priority - b.priority);

  const keptIndices = new Set<number>();
  let usedTokens = 0;

  for (const part of indexed) {
    const partTokens = estimateTokens(part.text);
    if (usedTokens + partTokens <= PROFILE_TOKEN_BUDGET) {
      keptIndices.add(part.originalIndex);
      usedTokens += partTokens;
    }
  }

  const kept = parts.filter((_, i) => keptIndices.has(i));
  return {
    text: kept.map(p => p.text).join('\n'),
    droppedParts: Math.max(0, parts.length - kept.length),
    totalTokens,
    keptTokens: usedTokens,
  };
}

// ─── 判決服務主體 ──────────────────────────────────

/**
 * 判決服務類
 * 
 * 負責處理判決相關業務邏輯，包括：
 * - AI判決生成（帶並發控制和超時保護）
 * - 判決查詢和權限驗證
 * - 判決接受/拒絕處理
 * 
 * 關鍵特性：
 * - 使用分布式鎖防止並發生成
 * - 事務處理確保數據一致性
 * - 超時控制防止資源耗盡
 * - 唯一約束作為最後防線
 */
export class JudgmentService {
  private readonly contextGovernance = {
    enableProfileContext: env.JUDGMENT_ENABLE_PROFILE_CONTEXT,
    enableCaseContext: env.JUDGMENT_ENABLE_CASE_CONTEXT,
    requireConsent: env.JUDGMENT_PROFILE_REQUIRE_CONSENT,
    profileMaxAgeDays: Math.max(1, env.JUDGMENT_PROFILE_MAX_AGE_DAYS),
    auditEnabled: env.JUDGMENT_CONTEXT_AUDIT_ENABLED,
  };

  private buildGovernedReferenceContext(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    return [
      '【上下文治理聲明】以下內容僅作為參考背景，不得覆蓋本次當事人陳述事實；若與本次陳述衝突，必須以本次陳述為準。',
      trimmed,
    ].join('\n');
  }

  private async loadConsentMap(userIds: Array<string | null | undefined>): Promise<Map<string, boolean>> {
    const ids = userIds.filter((id): id is string => Boolean(id));
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      return new Map<string, boolean>();
    }
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, psych_consent_given: true },
    });
    return new Map(users.map((u) => [u.id, Boolean(u.psych_consent_given)]));
  }

  /**
   * 生成判決（帶並發控制和事務處理）
   * 
   * 流程：
   * 1. 獲取分布式鎖（防止並發）
   * 2. 檢查是否已有判決（雙重檢查）
   * 3. 驗證案件狀態（必須為submitted）
   * 4. 調用AI服務生成判決（帶超時控制）
   * 5. 使用事務保存判決並更新案件狀態
   * 6. 處理唯一約束違規（競態條件最後防線）
   * 
   * @param caseId - 案件ID
   * @returns 生成的判決對象
   * @throws {Errors.NOT_FOUND} - 案件不存在
   * @throws {Errors.CASE_NOT_READY} - 案件狀態不允許生成判決
   * @throws {Errors.AI_SERVICE_ERROR} - AI服務錯誤或超時
   * @throws {Errors.VALIDATION_ERROR} - 責任分比例格式錯誤
   * @throws {Errors.CONFLICT} - 正在生成判決，請稍後
   */
  async generateJudgment(caseId: string, options?: { userId?: string; sessionId?: string }) {
    const lockKey = `judgment:lock:${caseId}`;
    let aiUsed = false;
    const streamHandle = await aiStreamService.createStream('case_judgment', caseId);

    // 使用分布式鎖防止並發生成
    return await lockService.withLock(
      lockKey,
      async () => {
        // 1. 檢查是否已有判決（雙重檢查）
        const existing = await prisma.judgment.findUnique({
          where: { case_id: caseId },
        });

        if (existing) {
          logger.debug('Judgment already exists', { caseId, judgmentId: existing.id });
          await aiStreamService.completed(streamHandle, {
            actorRole: 'ai',
            phase: 'completed',
            fullText: existing.judgment_content,
            metadata: { judgmentId: existing.id, caseId },
          });
          await aiStreamService.persisted(streamHandle, {
            actorRole: 'ai',
            phase: 'completed',
            fullText: existing.judgment_content,
            messageId: existing.id,
            metadata: { judgmentId: existing.id, caseId, summary: existing.summary },
          });
          return existing;
        }

        // 2. 獲取案件信息
        const case_ = await prisma.case.findUnique({
          where: { id: caseId },
          include: {
            chat_to_case_links: { select: { id: true }, take: 1 },
            quick_sessions: { select: { id: true } },
          },
        });

        if (!case_) {
          throw Errors.NOT_FOUND('案件不存在');
        }

        // 權限校驗：匿名 quick/collaborative 需匹配 Session；完整模式需當事人
        if (isSessionBoundCase(case_)) {
          if (!canAccessSessionBoundCase(case_, options?.sessionId)) {
            throw Errors.FORBIDDEN('無權限生成判決');
          }
        } else {
          const uid = options?.userId;
          if (!isCaseParticipant(case_, uid)) {
            throw Errors.FORBIDDEN('無權限生成判決');
          }
        }

        // 允許重試：submitted / judgment_failed / in_progress（用於崩潰恢復）
        const allowedStatuses: string[] = [CASE_STATUS.SUBMITTED, CASE_STATUS.JUDGMENT_FAILED, CASE_STATUS.IN_PROGRESS];
        if (!allowedStatuses.includes(case_.status)) {
          throw Errors.CASE_NOT_READY();
        }

        // judgment_failed 增加冷卻時間，避免頻繁重試耗費 AI
        if (case_.status === CASE_STATUS.JUDGMENT_FAILED && case_.updated_at) {
          const cooldownMs = parseInt(process.env.JUDGMENT_RETRY_COOLDOWN_MS || '60000', 10);
          const sinceFail = Date.now() - new Date(case_.updated_at).getTime();
          if (sinceFail < cooldownMs) {
            throw Errors.CONFLICT('請稍後再重試生成判決');
          }
        }

        // 2.1 將狀態設為 in_progress（避免長時間停留在 submitted / judgment_failed）
        // 注意：如果服務在生成中崩潰，狀態可能停留 in_progress；允許再次調用進行恢復。
        if (case_.status !== CASE_STATUS.IN_PROGRESS) {
          await prisma.case.update({
            where: { id: caseId },
            data: { status: CASE_STATUS.IN_PROGRESS },
          }).catch((err: unknown) => {
            logger.warn('Failed to set case status to in_progress', { caseId, error: err });
          });
        }

        await aiStreamService.start(streamHandle, {
          actorRole: 'ai',
          phase: 'collecting_context',
          metadata: {
            caseId,
            caseType: case_.type,
            caseMode: case_.mode,
          },
        });

        // 2.2/2.3 個人化與案件上下文治理：以 consent + feature flag + 可追溯審計控制注入
        const consentMap = this.contextGovernance.requireConsent
          ? await this.loadConsentMap([case_.plaintiff_id, case_.defendant_id])
          : new Map<string, boolean>();
        const hasConsent = (userId: string | null | undefined): boolean => {
          if (!userId) return false;
          if (!this.contextGovernance.requireConsent) return true;
          return Boolean(consentMap.get(userId));
        };

        const governanceAudit: ContextGovernanceAudit = {
          profileContext: {
            enabled: this.contextGovernance.enableProfileContext,
            injected: false,
            reason: 'not_applicable',
            requireConsent: this.contextGovernance.requireConsent,
            profileMaxAgeDays: this.contextGovernance.profileMaxAgeDays,
            sources: [],
            droppedParts: 0,
            totalTokens: 0,
            keptTokens: 0,
          },
          caseContext: {
            enabled: this.contextGovernance.enableCaseContext,
            injected: false,
            reason: 'not_applicable',
          },
        };

        let profileContext: string | undefined;
        let emotionalAnalysisHint: string | undefined;
        let responsibilityHint: string | undefined;
        let summaryBrief: string | undefined;

        const shouldInjectUserBoundContext = isUserBoundProductCase(case_);

        if (!shouldInjectUserBoundContext) {
          governanceAudit.profileContext.reason = 'session_bound_product_no_profile_context';
          governanceAudit.caseContext.reason = 'session_bound_product_no_case_context';
        } else {
          if (!this.contextGovernance.enableProfileContext) {
            governanceAudit.profileContext.reason = 'feature_flag_disabled';
          } else if (!case_.plaintiff_id) {
            governanceAudit.profileContext.reason = 'missing_plaintiff';
          } else if (!hasConsent(case_.plaintiff_id)) {
            governanceAudit.profileContext.reason = 'plaintiff_consent_missing';
          } else {
            try {
              const HIGH_PRIORITY_DOMAINS = new Set(['attachment', 'family_origin']);
              const MEDIUM_PRIORITY_DOMAINS = new Set(['relationship_history', 'life_events']);
              const profileCutoffDate = new Date(Date.now() - this.contextGovernance.profileMaxAgeDays * 24 * 60 * 60 * 1000);

              function insightPriority(insight: InsightRow): ProfilePriority {
                const isTrigger = /觸發|雷區|敏感/.test(insight.key);
                if (HIGH_PRIORITY_DOMAINS.has(insight.domain) || isTrigger) {
                  return insight.confidence >= 0.6 ? ProfilePriority.HIGH : ProfilePriority.FIRST_CUT;
                }
                if (MEDIUM_PRIORITY_DOMAINS.has(insight.domain)) {
                  return insight.confidence >= 0.6 ? ProfilePriority.MEDIUM : ProfilePriority.FIRST_CUT;
                }
                return insight.confidence >= 0.6 ? ProfilePriority.LOW : ProfilePriority.FIRST_CUT;
              }

              function narrativePriority(domain: string): ProfilePriority {
                if (HIGH_PRIORITY_DOMAINS.has(domain)) return ProfilePriority.HIGH;
                if (MEDIUM_PRIORITY_DOMAINS.has(domain)) return ProfilePriority.MEDIUM;
                return ProfilePriority.LOW;
              }

              const loadPsychProfile = async (userId: string, label: string): Promise<{ parts: PrioritizedText[]; insights: InsightRow[]; sources: string[] }> => {
                const parts: PrioritizedText[] = [];
                const sources: string[] = [];
                const richness = await profileRichnessService.calculateRichness(userId);
                const level = getRichnessLevel(richness);
                if (level === RichnessLevel.L0) {
                  return { parts: [], insights: [], sources };
                }
                await profileSnapshotService.createSnapshot(userId, caseId).catch(err => {
                  logger.warn('Failed to create profile snapshot', { userId, caseId, error: err });
                });
                const narratives = await prisma.profileNarrative.findMany({
                  where: { user_id: userId, is_latest: true, created_at: { gte: profileCutoffDate } },
                  select: { domain: true, ai_summary: true, completeness: true },
                });
                const insights = await prisma.profileInsight.findMany({
                  where: { user_id: userId, is_active: true, confidence: { gte: 0.4 }, created_at: { gte: profileCutoffDate } },
                  select: { domain: true, insight_type: true, key: true, value: true, confidence: true },
                });
                if (narratives.length > 0) sources.push('profile_narratives');
                if (insights.length > 0) sources.push('profile_insights');

                if (level === RichnessLevel.L1) {
                  const topInsights = insights.filter(i => i.confidence >= 0.7);
                  if (topInsights.length > 0) {
                    parts.push({
                      text: `${label}的核心特質：${topInsights.map(i => `${i.key}：${i.value}`).join('；')}`,
                      priority: ProfilePriority.HIGH,
                    });
                  }
                } else if (level === RichnessLevel.L2) {
                  for (const n of narratives) {
                    if (n.ai_summary && n.completeness > 0.2) {
                      parts.push({ text: `${label}（${n.domain}）：${n.ai_summary}`, priority: narrativePriority(n.domain) });
                    }
                  }
                  const keyInsights = insights.filter(i => i.confidence >= 0.5);
                  if (keyInsights.length > 0) {
                    parts.push({ text: `${label}的洞察：${keyInsights.map(i => `${i.key}=${i.value}`).join('；')}`, priority: ProfilePriority.MEDIUM });
                  }
                } else {
                  for (const n of narratives) {
                    if (n.ai_summary) {
                      parts.push({
                        text: `${label}（${n.domain}，完整度 ${Math.round(n.completeness * 100)}%）：${n.ai_summary}`,
                        priority: narrativePriority(n.domain),
                      });
                    }
                  }
                  for (const i of insights) {
                    parts.push({
                      text: `${label}洞察[${i.domain}/${i.insight_type}] ${i.key}：${i.value}（信心 ${Math.round(i.confidence * 100)}%）`,
                      priority: insightPriority(i),
                    });
                  }
                }

                return { parts, insights, sources };
              };

              const allParts: PrioritizedText[] = [];
              const allSources = new Set<string>();
              const plaintiffResult = await loadPsychProfile(case_.plaintiff_id, '角色A');
              plaintiffResult.sources.forEach((s) => allSources.add(s));
              allParts.push(...plaintiffResult.parts);

              let defendantResult: { parts: PrioritizedText[]; insights: InsightRow[]; sources: string[] } | null = null;
              if (case_.defendant_id && shouldInjectUserBoundContext) {
                if (hasConsent(case_.defendant_id)) {
                  defendantResult = await loadPsychProfile(case_.defendant_id, '角色B');
                  defendantResult.sources.forEach((s) => allSources.add(s));
                  allParts.push(...defendantResult.parts);
                } else {
                  governanceAudit.profileContext.reason = 'defendant_consent_missing_partial_injection';
                }
              }

              if (defendantResult && plaintiffResult.insights.length > 0 && defendantResult.insights.length > 0) {
                const interactionLayer = buildInteractionLayer(
                  plaintiffResult.insights,
                  defendantResult.insights,
                  '角色A',
                  '角色B'
                );
                if (interactionLayer) {
                  allParts.push({ text: interactionLayer, priority: ProfilePriority.ALWAYS_KEEP });
                  allSources.add('interaction_layer');
                }
              }

              const [plaintiffBasic, relationshipProfile] = await Promise.all([
                prisma.userProfile.findUnique({ where: { user_id: case_.plaintiff_id } }),
                case_.pairing_id ? prisma.relationshipProfile.findUnique({ where: { pairing_id: case_.pairing_id } }) : null,
              ]);
              if (plaintiffBasic) {
                if (plaintiffBasic.mbti_type && !allParts.some(p => p.text.includes('MBTI'))) {
                  allParts.push({ text: `角色A的MBTI：${plaintiffBasic.mbti_type}`, priority: ProfilePriority.FIRST_CUT });
                }
                if (plaintiffBasic.communication_style) {
                  allParts.push({ text: `角色A的溝通風格：${plaintiffBasic.communication_style}`, priority: ProfilePriority.FIRST_CUT });
                }
                allSources.add('user_profile');
              }
              if (case_.defendant_id && hasConsent(case_.defendant_id) && shouldInjectUserBoundContext) {
                const defBasic = await prisma.userProfile.findUnique({ where: { user_id: case_.defendant_id } });
                if (defBasic?.mbti_type && !allParts.some(p => p.text.includes('角色B') && p.text.includes('MBTI'))) {
                  allParts.push({ text: `角色B的MBTI：${defBasic.mbti_type}`, priority: ProfilePriority.FIRST_CUT });
                  allSources.add('user_profile');
                }
              }
              if (relationshipProfile) {
                const rpParts: string[] = [];
                if (relationshipProfile.relationship_duration_days) rpParts.push(`交往天數：${relationshipProfile.relationship_duration_days}天`);
                if (relationshipProfile.relationship_stage) rpParts.push(`關係階段：${relationshipProfile.relationship_stage}`);
                if (relationshipProfile.is_long_distance) rpParts.push('遠距離關係');
                if (relationshipProfile.conflict_communication_style) rpParts.push(`衝突溝通風格：${relationshipProfile.conflict_communication_style}`);
                if (rpParts.length > 0) {
                  allParts.push({ text: rpParts.join('；'), priority: ProfilePriority.MEDIUM });
                  allSources.add('relationship_profile');
                }
              }

              if (allParts.length > 0) {
                const truncated = truncateProfileParts(allParts);
                profileContext = this.buildGovernedReferenceContext(truncated.text);
                governanceAudit.profileContext.injected = Boolean(profileContext);
                governanceAudit.profileContext.reason = governanceAudit.profileContext.reason === 'not_applicable'
                  ? 'ok'
                  : governanceAudit.profileContext.reason;
                governanceAudit.profileContext.sources = Array.from(allSources);
                governanceAudit.profileContext.droppedParts = truncated.droppedParts;
                governanceAudit.profileContext.totalTokens = truncated.totalTokens;
                governanceAudit.profileContext.keptTokens = truncated.keptTokens;
              } else if (governanceAudit.profileContext.reason === 'not_applicable') {
                governanceAudit.profileContext.reason = 'no_eligible_profile_sources';
              }
            } catch (err) {
              governanceAudit.profileContext.reason = 'profile_context_load_failed';
              logger.warn('Failed to load profile context for judgment', { caseId, error: err });
            }
          }

          if (!this.contextGovernance.enableCaseContext) {
            governanceAudit.caseContext.reason = 'feature_flag_disabled';
          } else if (!case_.plaintiff_id || !hasConsent(case_.plaintiff_id)) {
            governanceAudit.caseContext.reason = 'plaintiff_consent_missing';
          } else {
            try {
              const caseCtx = await caseContextService.loadCaseContext(caseId, {
                type: case_.type,
                mode: case_.mode,
                session_id: case_.session_id,
                plaintiff_id: case_.plaintiff_id,
                defendant_id: case_.defendant_id,
                pairing_id: case_.pairing_id,
                chat_to_case_links: case_.chat_to_case_links,
              });
              if (caseCtx) {
                emotionalAnalysisHint = this.buildGovernedReferenceContext(
                  caseContextService.formatForEmotionalAnalysis(caseCtx) || ''
                ) || undefined;
                responsibilityHint = this.buildGovernedReferenceContext(
                  caseContextService.formatForResponsibilityRatio(caseCtx) || ''
                ) || undefined;
                summaryBrief = this.buildGovernedReferenceContext(
                  caseContextService.formatForSummary(caseCtx) || ''
                ) || undefined;
                governanceAudit.caseContext.injected = Boolean(
                  emotionalAnalysisHint || responsibilityHint || summaryBrief
                );
                governanceAudit.caseContext.reason = governanceAudit.caseContext.injected
                  ? 'ok'
                  : 'case_context_empty_after_filter';
              } else {
                governanceAudit.caseContext.reason = 'case_context_not_available';
              }
            } catch (err) {
              governanceAudit.caseContext.reason = 'case_context_load_failed';
              logger.warn('Failed to load case context for sub-prompts', { caseId, error: err });
            }
          }
        }

        // 3. 調用AI服務生成判決（帶超時控制）
        let judgmentContent: string;
        let responsibilityRatio: { plaintiff: number; defendant: number };
        let summary: string;
        let emotionalAnalysisData: unknown = null;
        let routeDecision: { route: 'standard' | 'safety_support' | 'crisis_support'; reasons: string[]; detectedFlags: string[] } = {
          route: 'standard',
          reasons: ['default route'],
          detectedFlags: [],
        };
        const caseSourceTracking = buildCaseSourceTrackingForRead(case_);
        const aiLedgerBase = {
          streamId: streamHandle.streamId,
          scopeType: streamHandle.scopeType,
          scopeId: streamHandle.scopeId,
          productFlow: caseSourceTracking.product_flow,
          sourceChannel: caseSourceTracking.source_channel,
          entryPoint: caseSourceTracking.entry_point,
          metadata: {
            parent_request_id: streamHandle.requestId,
            case_id: caseId,
            case_mode: case_.mode,
            case_type: case_.type,
          },
        };
        let timedOut = false;
        const abortController = new AbortController();
        const timeoutHandle = setTimeout(() => {
          timedOut = true;
          abortController.abort();
        }, AI_TIMEOUT.JUDGMENT_GENERATION);

        try {
          await aiStreamService.phase(streamHandle, 'analyzing_emotion', {
            actorRole: 'ai',
            metadata: { caseId },
          });
          const prefetchedAnalysis = await aiService.analyzeEmotionalDynamics(
            case_.plaintiff_statement,
            case_.defendant_statement || '',
            abortController.signal,
            emotionalAnalysisHint,
            {
              ...aiLedgerBase,
              requestKind: 'judgment_emotional_analysis',
            }
          );

          routeDecision = safetyRoutingService.decideRoute({
            analysis: prefetchedAnalysis,
            plaintiffStatement: case_.plaintiff_statement,
            defendantStatement: case_.defendant_statement || '',
          });

          await aiStreamService.phase(streamHandle, 'building_responsibility', {
            actorRole: 'ai',
            metadata: {
              route: routeDecision.route,
              detectedFlags: routeDecision.detectedFlags,
            },
          });
          const response = await aiService.generateJudgment(
            case_.type,
            case_.plaintiff_statement,
            case_.defendant_statement || '',
            {
              signal: abortController.signal,
              profileContext,
              emotionalAnalysisHint,
              responsibilityHint,
              summaryBrief,
              routeType: routeDecision.route,
              prefetchedAnalysis,
              ledger: {
                ...aiLedgerBase,
                metadata: {
                  ...aiLedgerBase.metadata,
                  route: routeDecision.route,
                },
              },
            }
          );

          await aiStreamService.phase(streamHandle, 'drafting_judgment', {
            actorRole: 'ai',
            metadata: {
              route: routeDecision.route,
            },
          });
          judgmentContent = response.content;
          responsibilityRatio = response.responsibilityRatio;
          summary = response.summary;
          if (this.contextGovernance.auditEnabled) {
            logger.info('Judgment context governance audit', {
              caseId,
              profileContext: governanceAudit.profileContext,
              caseContext: governanceAudit.caseContext,
            });
          }
          emotionalAnalysisData = response.emotionalAnalysis
            ? {
              ...(JSON.parse(JSON.stringify(response.emotionalAnalysis)) as Record<string, unknown>),
              route: routeDecision.route,
              route_reasons: routeDecision.reasons,
              route_detected_flags: routeDecision.detectedFlags,
              ...(this.contextGovernance.auditEnabled
                ? { context_governance: governanceAudit }
                : {}),
            }
            : {
              route: routeDecision.route,
              route_reasons: routeDecision.reasons,
              route_detected_flags: routeDecision.detectedFlags,
              ...(this.contextGovernance.auditEnabled
                ? { context_governance: governanceAudit }
                : {}),
            };
          aiUsed = true;
        } catch (error: unknown) {
          const errObj = error as { message?: string; status?: number } | undefined;
          const normalizedError = errObj?.message || String(error || '');
          logger.error('AI service error', { caseId, error: normalizedError });

          const msg = String(normalizedError);
          let failureReason = 'AI 服務暫時不可用，請稍後重試';
          if (timedOut || msg.includes('超時') || msg.includes('timeout') || msg.includes('AbortError') || msg.includes('aborted')) {
            failureReason = 'AI 服務響應超時，請稍後再試';
          } else if (msg.includes('認證') || errObj?.status === 401) {
            failureReason = 'AI 服務認證失敗（請檢查 OPENAI_API_KEY）';
          } else if (msg.includes('過於頻繁') || errObj?.status === 429) {
            failureReason = 'AI 請求過於頻繁，請稍後再試';
          } else if (msg.includes('已達上限')) {
            failureReason = '今日 AI 調用已達上限';
          } else if (msg.includes('空內容')) {
            failureReason = 'AI 返回內容異常，請重試';
          }
          const reasonToStore = failureReason.slice(0, 500);

          try {
            await prisma.case.update({
              where: { id: caseId },
              data: {
                status: CASE_STATUS.JUDGMENT_FAILED,
                judgment_failure_reason: reasonToStore,
                updated_at: new Date(),
              },
            });
            logger.info('Case status set to judgment_failed', { caseId, reason: reasonToStore });
          } catch (updateError: unknown) {
            logger.error('Failed to update case status to judgment_failed', {
              caseId,
              error: updateError,
            });
          }

          logger.error('Judgment generation failed', {
            caseId,
            error: normalizedError,
            status: CASE_STATUS.JUDGMENT_FAILED,
            routeDecision,
          });

          await aiStreamService.failed(
            streamHandle,
            {
              code: timedOut || msg.includes('超時') || msg.includes('timeout') || msg.includes('AbortError') || msg.includes('aborted')
                ? 'JUDGMENT_STREAM_TIMEOUT'
                : 'JUDGMENT_STREAM_FAILED',
              message: reasonToStore,
              retryable: true,
            },
            {
              actorRole: 'ai',
              phase: 'finalizing',
              metadata: {
                caseId,
                route: routeDecision.route,
              },
            }
          );

          if (timedOut || msg.includes('超時') || msg.includes('timeout') || msg.includes('AbortError') || msg.includes('aborted')) {
            throw Errors.AI_SERVICE_ERROR('AI服務響應超時，請稍後再試');
          }
          throw Errors.AI_SERVICE_ERROR('AI服務暫時不可用，請稍後重試');
        } finally {
          clearTimeout(timeoutHandle);
        }

        // 4-6. 使用事務確保數據一致性
        // 4.1 檢查責任比例合法性（避免 DB 約束報錯）
        const ratioSum = responsibilityRatio.plaintiff + responsibilityRatio.defendant;
        if (Math.abs(ratioSum - 100) > 0.01 || responsibilityRatio.plaintiff < 0 || responsibilityRatio.defendant < 0) {
          throw Errors.VALIDATION_ERROR('責任分比例必須為非負且總和 100');
        }

        await aiStreamService.phase(streamHandle, 'finalizing', {
          actorRole: 'ai',
          metadata: {
            caseId,
            plaintiffRatio: responsibilityRatio.plaintiff,
            defendantRatio: responsibilityRatio.defendant,
          },
        });

        const judgment = await prisma.$transaction(async (tx) => {
          // 再次檢查（防止在生成過程中其他進程已創建）
          const existing2 = await tx.judgment.findUnique({
            where: { case_id: caseId },
          });
          if (existing2) {
            await aiStreamService.completed(streamHandle, {
              actorRole: 'ai',
              phase: 'completed',
              fullText: existing2.judgment_content,
              metadata: { judgmentId: existing2.id, caseId },
            });
            await aiStreamService.persisted(streamHandle, {
              actorRole: 'ai',
              phase: 'completed',
              fullText: existing2.judgment_content,
              messageId: existing2.id,
              metadata: { judgmentId: existing2.id, caseId, summary: existing2.summary },
            });
            return existing2;
          }

          // 4. 驗證並保存判決
          if (!isResponsibilityRatio(responsibilityRatio)) {
            throw Errors.VALIDATION_ERROR('無效的責任分比例格式');
          }

          // AI 輸出清洗：限制長度、移除潛在 HTML/script
          const sanitizeAIOutput = (text: string, maxLen: number): string => {
            return text
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
              .replace(/on\w+="[^"]*"/gi, '')
              .slice(0, maxLen);
          };
          const safeContent = sanitizeAIOutput(judgmentContent, 50000);
          const safeSummary = sanitizeAIOutput(summary, 2000);

          try {
          const newJudgment = await tx.judgment.create({
            data: {
              case_id: caseId,
              judgment_content: safeContent,
              summary: safeSummary,
              plaintiff_ratio: responsibilityRatio.plaintiff,
              defendant_ratio: responsibilityRatio.defendant,
              emotional_analysis: (emotionalAnalysisData ?? undefined) as Prisma.InputJsonValue | undefined,
              ai_model: AI_CONFIG.model,
              prompt_version: getStoredJudgmentPromptVersion(),
            },
          });

          // 5. 更新案件狀態
          await tx.case.update({
            where: { id: caseId },
            data: {
              status: CASE_STATUS.COMPLETED,
              completed_at: new Date(),
            },
          });

          return newJudgment;
          } catch (error: unknown) {
            const prismaErr = error as { code?: string; meta?: { target?: string[] } };
            if (prismaErr.code === 'P2002' && prismaErr.meta?.target?.includes('case_id')) {
              // 如果違反唯一約束，說明在事務期間其他進程已創建判決
              // 重新查詢並返回已存在的判決
              const existingJudgment = await tx.judgment.findUnique({
                where: { case_id: caseId },
              });
              if (existingJudgment) {
                logger.info('Judgment was created by another process', { caseId });
                return existingJudgment;
              }
            }
            throw error;
          }
        });

        // 6. Session-bound 體驗：標記 Session 為已完成（異步，不阻塞）
        const completedSessionId = isSessionBoundCase(case_) ? options?.sessionId ?? case_.session_id : null;
        if (completedSessionId) {
          sessionService.markSessionCompleted(completedSessionId).catch(err => {
            logger.warn('Failed to mark session completed', {
              error: err,
            });
          });
        }

        logger.info('Judgment generated', { caseId, judgmentId: judgment.id });

        await aiStreamService.completed(streamHandle, {
          actorRole: 'ai',
          phase: 'completed',
          fullText: judgment.judgment_content,
          metadata: {
            judgmentId: judgment.id,
            caseId,
          },
        });
        await aiStreamService.persisted(streamHandle, {
          actorRole: 'ai',
          phase: 'completed',
          fullText: judgment.judgment_content,
          messageId: judgment.id,
          metadata: {
            judgmentId: judgment.id,
            caseId,
            summary: judgment.summary,
            plaintiffRatio: judgment.plaintiff_ratio,
            defendantRatio: judgment.defendant_ratio,
          },
        });

        return normalizeJudgmentWithSafetyState(judgment, { caseId });
      },
      120 // 鎖定時間：120秒（足夠AI生成判決）
    ).catch(async (err) => {
      // 如果AI已調用但後續失敗，回補配額
      if (aiUsed) {
        const today = new Date().toISOString().split('T')[0];
        const countKey = CacheService.generateKey('ai:daily:count', today);
        await lockService.withLock(`lock:${countKey}`, async () => {
          const count = (await cacheService.get<number>(countKey)) || 0;
          await cacheService.set(countKey, Math.max(0, count - 1), 24 * 60 * 60);
        }, 5).catch((e) => { logger.warn('Failed to rollback AI daily quota', { error: e }); });
      }
      throw err;
    });
  }

  async repairJudgmentResponse(
    judgmentId: string,
    feedback: string,
    options?: { userId?: string; sessionId?: string }
  ): Promise<{ repairedContent: string; repairType: 'validation' | 'apology_tone_fix' | 'strategy_reset' }> {
    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: { case: { include: { quick_sessions: { select: { id: true } } } } },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('判決不存在');
    }

    if (isSessionBoundCase(judgment.case)) {
      if (!canAccessSessionBoundCase(judgment.case, options?.sessionId)) {
        throw Errors.FORBIDDEN('無權限修復此判決');
      }
    } else {
      const uid = options?.userId;
      if (!uid || (judgment.case.plaintiff_id !== uid && judgment.case.defendant_id !== uid)) {
        throw Errors.FORBIDDEN('無權限修復此判決');
      }
    }

    const trimmedFeedback = (feedback || '').trim();
    if (trimmedFeedback.length < 3) {
      throw Errors.VALIDATION_ERROR('回饋內容過短');
    }

    const emotional = (judgment.emotional_analysis || {}) as Record<string, unknown>;
    const route = (typeof emotional.route === 'string' ? emotional.route : 'standard') as 'standard' | 'safety_support' | 'crisis_support';

    return ruptureRepairService.repair({
      judgmentContent: judgment.judgment_content,
      userFeedback: trimmedFeedback,
      caseType: judgment.case.type,
      route,
    });
  }

  async recordClinicalMetrics(
    judgmentId: string,
    metrics: {
      felt_understood: number;
      felt_blamed: number;
      willing_to_try: number;
    },
    options?: { userId?: string; sessionId?: string }
  ): Promise<{ recorded: true }> {
    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: { case: { include: { quick_sessions: { select: { id: true } } } } },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('判決不存在');
    }

    if (isSessionBoundCase(judgment.case)) {
      if (!canAccessSessionBoundCase(judgment.case, options?.sessionId)) {
        throw Errors.FORBIDDEN('無權限提交此判決指標');
      }
    } else {
      const uid = options?.userId;
      if (!uid || (judgment.case.plaintiff_id !== uid && judgment.case.defendant_id !== uid)) {
        throw Errors.FORBIDDEN('無權限提交此判決指標');
      }
    }

    const emotional = (judgment.emotional_analysis || {}) as Record<string, unknown>;
    const route = (typeof emotional.route === 'string' ? emotional.route : 'standard') as 'standard' | 'safety_support' | 'crisis_support';

    await clinicalQualityService.recordPostResponseMetrics({
      judgmentId: judgment.id,
      promptVersion: getJudgmentMetricsPromptVersion(judgment.prompt_version),
      caseType: judgment.case.type,
      route,
      feltUnderstood: metrics.felt_understood,
      feltBlamed: metrics.felt_blamed,
      willingToTry: metrics.willing_to_try,
    });

    return { recorded: true };
  }

  /**
   * 獲取判決詳情（優化查詢）
   */
  async getJudgmentByCaseId(caseId: string, userId?: string, sessionId?: string) {
    // 1. 獲取案件（驗證權限，優化查詢）
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        quick_sessions: {
          select: { id: true },
        },
        pairing: {
          select: {
            user1_id: true,
            user2_id: true,
          },
        },
      },
    });

    if (!case_) {
      throw Errors.NOT_FOUND('案件不存在');
    }

    // session-bound 模式（quick / collaborative with session_id）：驗證 Session ID
    if (isSessionBoundCase(case_)) {
      if (!sessionId || !canAccessSessionBoundCase(case_, sessionId)) {
        throw Errors.FORBIDDEN('無權限訪問此判決');
      }

      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw Errors.SESSION_EXPIRED();
      }

      if (case_.status === CASE_STATUS.JUDGMENT_FAILED) {
        throw Errors.JUDGMENT_FAILED('判決生成失敗，請點擊重試');
      }
    } else {
      // 完整模式：驗證用戶權限
      if (!userId) {
        throw Errors.UNAUTHORIZED('需要認證');
      }

      if (case_.plaintiff_id !== userId && case_.defendant_id !== userId) {
        throw Errors.FORBIDDEN('無權限訪問此判決');
      }
    }

    // 2. 獲取判決（包含關聯數據）
    const judgment = await prisma.judgment.findUnique({
      where: { case_id: caseId },
      include: {
        reconciliation_plans: {
          orderBy: { created_at: 'desc' },
          take: 10, // 限制返回數量
        },
      },
    });

    if (!judgment) {
      // 如果判決尚未生成，返回null（前端可以顯示"生成中"）
      return null;
    }

    return normalizeJudgmentWithSafetyState(judgment, { caseId });
  }

  /**
   * 接受/拒絕判決（僅完整模式）
   */
  async acceptJudgment(
    judgmentId: string,
    userId: string,
    accepted: boolean,
    rating?: number
  ) {
    const judgment = await prisma.judgment.findUnique({
      where: { id: judgmentId },
      include: {
        case: true,
      },
    });

    if (!judgment) {
      throw Errors.NOT_FOUND('判決不存在');
    }

    // 驗證用戶權限
    if (judgment.case.plaintiff_id !== userId && judgment.case.defendant_id !== userId) {
      throw Errors.FORBIDDEN('無權限操作此判決');
    }

    // 確定是user1還是user2
    const isUser1 = judgment.case.plaintiff_id === userId;

    // 更新判決
    const updatedJudgment = await prisma.judgment.update({
      where: { id: judgmentId },
      data: {
        ...(isUser1
          ? {
              user1_acceptance: accepted,
              user1_rating: rating,
            }
          : {
              user2_acceptance: accepted,
              user2_rating: rating,
            }),
      },
    });

    return normalizeJudgmentWithSafetyState(updatedJudgment);
  }
}

export const judgmentService = new JudgmentService();
