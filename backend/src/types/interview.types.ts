/**
 * v2.0 心理畫像訪談與管道類型定義
 */

// PsychDomain 權重（用於豐富度計算）
export const DOMAIN_WEIGHTS: Record<string, number> = {
  attachment: 2.0,
  family_origin: 2.0,
  life_events: 1.5,
  relationship_history: 1.5,
  belief_values: 1.0,
  cultural_background: 1.0,
  personality: 0.8,
  education_cognition: 0.5,
};
export const TOTAL_WEIGHT = 10.3;

// 豐富度等級（用於判決注入）
export enum RichnessLevel {
  L0 = 'L0', // < 0.05 - no injection
  L1 = 'L1', // 0.05-0.2 - minimal
  L2 = 'L2', // 0.2-0.5 - moderate
  L3 = 'L3', // >= 0.5 - deep
}

export function getRichnessLevel(score: number): RichnessLevel {
  if (score < 0.05) return RichnessLevel.L0;
  if (score < 0.2) return RichnessLevel.L1;
  if (score < 0.5) return RichnessLevel.L2;
  return RichnessLevel.L3;
}

// 訪談 AI 回應結構
export interface InterviewAIResponse {
  text: string;
  intent?: string;
  target_domains?: string[];
  should_end?: boolean;
  safety_flag?: boolean;
  safety_message?: string;
  key_facts?: string[];
}

// 敘事萃取結果
export interface NarrativeExtractionResult {
  domain: string;
  raw_narrative: string;
  ai_summary: string;
  word_count: number;
  completeness: number;
}

// 洞見萃取結果
export interface InsightExtractionResult {
  domain: string;
  insight_type: string;
  key: string;
  value: string;
  confidence: number;
  evidence: string;
  clinical_note?: string;
}

// 管道步驟 (0-6)
export enum PipelineStep {
  NOT_STARTED = 0,
  NARRATIVE_EXTRACTION = 1,
  NARRATIVE_SUMMARY = 2,
  INSIGHT_EXTRACTION = 3,
  RICHNESS_CALCULATION = 4,
  FEEDBACK_GENERATION = 5,
  COMPLETED = 6,
}

// SSE 事件類型
export interface SSETokenEvent {
  text: string;
}
export interface SSEMetadataEvent {
  turn_order: number;
  intent?: string;
  target_domains?: string[];
  domains_touched?: string[];
  total_turns?: number;
  should_end?: boolean;
}
export interface SSESafetyAlertEvent {
  message: string;
  severity: 'info' | 'warning' | 'critical';
}
export interface SSECompleteEvent {
  session_id: string;
  status: string;
  total_turns: number;
  domains_touched: string[];
  feedback_card?: string;
}
export interface SSEErrorEvent {
  code: string;
  message: string;
}

// 反饋卡結構
export interface FeedbackCard {
  summary: string;
  domains_explored: string[];
  domains_unexplored: string[];
  key_insights: string[];
  richness_score: number;
  encouragement: string;
  continuation_hint: string;
}

// 判決用快照資料
export interface SnapshotData {
  narratives: Array<{
    domain: string;
    summary: string;
    completeness: number;
  }>;
  insights: Array<{
    domain: string;
    type: string;
    key: string;
    value: string;
    confidence: number;
  }>;
  richness_score: number;
  generated_at: string;
}

// 依觸發場景分類的種子問題（每個場景隨機選一句）
export const SEED_QUESTIONS: Record<'zh-TW' | 'en-US', Record<string, string[]>> = {
  'zh-TW': {
    organic: [
      '嗨！最近的生活中，有沒有什麼事情讓你特別有感觸的？不管是開心的、煩心的都可以。',
      '嗨！好久沒聊了。最近過得怎麼樣？有什麼想說的嗎？',
      '嗨！今天有什麼想聊的嗎？生活裡的大小事，或者心裡想著的事，都可以。',
    ],
    pre_case: [
      '嗨！在我們開始整理事情之前，我想先了解一下你。最近的心情怎麼樣？',
      '嗨！待會我們要一起處理一些事情。不過先放鬆一下——你最近有什麼讓你在意的事嗎？',
    ],
    post_judgment: [
      '嗨！剛看完結果，你現在的感覺是什麼？不管是什麼感受，都可以說說看。',
      '嗨！看完判決之後，有沒有什麼讓你特別在意、或者一直在心裡轉的想法？',
    ],
    onboarding: [
      '嗨！很高興認識你。我們先從輕鬆的開始——你平時有什麼讓自己放鬆的方式嗎？',
      '嗨！歡迎你來。我想先隨意聊聊，認識一下你。最近生活中有什麼讓你印象深刻的事嗎？',
    ],
  },
  'en-US': {
    organic: [
      'Hi. Has anything in your life felt especially meaningful lately? It can be something good, stressful, or anything in between.',
      'Hi. It has been a while. How have you been lately? Is there anything you want to talk about?',
      'Hi. What would you like to talk about today? Everyday moments or things on your mind are both welcome.',
    ],
    pre_case: [
      'Hi. Before we start organizing the situation, I would like to understand you a little. How have you been feeling lately?',
      'Hi. We are about to work through something together. Before that, let us slow down a little. What has been on your mind lately?',
    ],
    post_judgment: [
      'Hi. After reading the analysis, what are you feeling right now? Whatever comes up is okay to share.',
      'Hi. After reading the analysis, is there anything that still feels important or keeps circling in your mind?',
    ],
    onboarding: [
      'Hi. I am glad to meet you. Let us start gently. What usually helps you relax?',
      'Hi. Welcome. I would like to get to know you through an easy conversation. What has stood out in your life recently?',
    ],
  },
};

export function getSeedQuestion(trigger: string, locale: 'zh-TW' | 'en-US' = 'zh-TW'): string {
  const localizedQuestions = SEED_QUESTIONS[locale] ?? SEED_QUESTIONS['zh-TW'];
  const pool = localizedQuestions[trigger] || localizedQuestions.organic;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** @deprecated Use getSeedQuestion(trigger) instead */
export const SEED_QUESTION = SEED_QUESTIONS['zh-TW'].organic[0];
