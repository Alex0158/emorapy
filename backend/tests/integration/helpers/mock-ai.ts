/**
 * AI 服務 Mock
 * 
 * 用於集成測試，模擬 OpenAI API 的響應
 */

import { jest } from '@jest/globals';

export interface MockJudgmentResponse {
  content: string;
  responsibilityRatio: { plaintiff: number; defendant: number };
  summary: string;
}

export interface MockReconciliationPlan {
  title: string;
  description: string;
  steps: string[];
  expected_effect: string;
  time_cost: number;
  money_cost: number;
  emotion_cost: number;
  skill_requirement: number;
  plan_type: 'activity' | 'communication' | 'intimacy';
  estimated_duration?: number;
  difficulty_level?: 'easy' | 'medium' | 'hard';
}

/**
 * 默認的 Mock 判決內容
 */
export const DEFAULT_JUDGMENT_CONTENT = `## ⚖️ 判決結果

**責任分比例**：
- 原告：60% 責任
- 被告：40% 責任

### 問題分析

經過仔細審理雙方陳述，本法庭認為這是一個典型的生活習慣衝突問題。

### 具體建議

1. 建議雙方坐下來進行一次深入的溝通
2. 制定一個雙方都能接受的生活作息時間表
3. 互相尊重對方的生活習慣

### 關係修復建議

建議雙方每週安排一次約會時間，增進感情。`;

/**
 * 默認的 Mock 判決響應
 */
export const DEFAULT_MOCK_JUDGMENT: MockJudgmentResponse = {
  content: DEFAULT_JUDGMENT_CONTENT,
  responsibilityRatio: { plaintiff: 60, defendant: 40 },
  summary: '這是一個生活習慣衝突，建議雙方通過溝通和相互理解來解決問題。',
};

/**
 * 默認的案件類型
 */
export const DEFAULT_CASE_TYPE = '生活習慣衝突';

/**
 * 默認的 Mock 和好方案
 */
export const DEFAULT_RECONCILIATION_PLANS: MockReconciliationPlan[] = [
  {
    title: '一起做一頓晚餐',
    description: '共同準備和享用一頓晚餐，增進感情交流',
    steps: ['討論菜單', '一起購買食材', '分工合作做飯', '一起享用晚餐'],
    expected_effect: '增進溝通，創造美好回憶',
    time_cost: 2,
    money_cost: 2,
    emotion_cost: 1,
    skill_requirement: 2,
    plan_type: 'activity',
    estimated_duration: 1,
    difficulty_level: 'easy',
  },
  {
    title: '傾聽練習',
    description: '輪流進行傾聽練習，學習理解對方',
    steps: ['選擇安靜環境', '一方說話另一方傾聽', '傾聽者複述理解內容', '角色互換'],
    expected_effect: '改善溝通技巧，增進理解',
    time_cost: 1,
    money_cost: 1,
    emotion_cost: 3,
    skill_requirement: 3,
    plan_type: 'communication',
    estimated_duration: 1,
    difficulty_level: 'medium',
  },
];

/**
 * AI 服務 Mock 配置選項
 */
export interface MockAIOptions {
  /** 案件類型識別延遲（毫秒） */
  detectCaseTypeDelay?: number;
  /** 判決生成延遲（毫秒） */
  generateJudgmentDelay?: number;
  /** 是否模擬案件類型識別失敗 */
  detectCaseTypeError?: boolean;
  /** 是否模擬判決生成失敗 */
  generateJudgmentError?: boolean;
  /** 是否模擬判決生成超時 */
  generateJudgmentTimeout?: boolean;
  /** 自定義判決內容 */
  customJudgment?: MockJudgmentResponse;
  /** 自定義案件類型 */
  customCaseType?: string;
  /** 自定義和好方案 */
  customReconciliationPlans?: MockReconciliationPlan[];
}

/**
 * AI 服務 Mock 管理器
 */
export class MockAIManager {
  private options: MockAIOptions = {};
  private originalModule: any = null;

  /**
   * 配置 Mock 選項
   */
  configure(options: MockAIOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 重置 Mock 選項
   */
  reset(): void {
    this.options = {};
  }

  /**
   * 獲取當前配置
   */
  getOptions(): MockAIOptions {
    return { ...this.options };
  }

  /**
   * 創建 Mock 的 detectCaseType 函數
   */
  createMockDetectCaseType(): jest.Mock {
    return jest.fn().mockImplementation(async () => {
      const { detectCaseTypeDelay = 100, detectCaseTypeError, customCaseType } = this.options;

      // 模擬延遲
      await new Promise(resolve => setTimeout(resolve, detectCaseTypeDelay));

      // 模擬錯誤
      if (detectCaseTypeError) {
        throw new Error('AI服務暫時不可用');
      }

      return customCaseType || DEFAULT_CASE_TYPE;
    });
  }

  /**
   * 創建 Mock 的 generateJudgment 函數
   */
  createMockGenerateJudgment(): jest.Mock {
    return jest.fn().mockImplementation(async () => {
      const { 
        generateJudgmentDelay = 500, 
        generateJudgmentError,
        generateJudgmentTimeout,
        customJudgment 
      } = this.options;

      // 模擬超時（返回一個永遠不會 resolve 的 Promise）
      if (generateJudgmentTimeout) {
        await new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AI服務響應超時')), 120000);
        });
      }

      // 模擬延遲
      await new Promise(resolve => setTimeout(resolve, generateJudgmentDelay));

      // 模擬錯誤
      if (generateJudgmentError) {
        throw new Error('AI服務暫時不可用');
      }

      return customJudgment || DEFAULT_MOCK_JUDGMENT;
    });
  }

  /**
   * 創建 Mock 的 generateReconciliationPlans 函數
   */
  createMockGenerateReconciliationPlans(): jest.Mock {
    return jest.fn().mockImplementation(async () => {
      const { customReconciliationPlans } = this.options;
      
      // 模擬延遲
      await new Promise(resolve => setTimeout(resolve, 200));

      return customReconciliationPlans || DEFAULT_RECONCILIATION_PLANS;
    });
  }

  /**
   * 創建 Mock 的 generateText 函數
   */
  createMockGenerateText(): jest.MockedFunction<(prompt: string) => Promise<string>> {
    return jest.fn(async (prompt: string) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'Mock AI response for: ' + String(prompt ?? '').substring(0, 50);
    });
  }

  /**
   * 創建 Mock 的 generateSummary 函數
   */
  createMockGenerateSummary(): jest.Mock {
    return jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return DEFAULT_MOCK_JUDGMENT.summary;
    });
  }
}

/**
 * 全局 Mock 管理器實例
 */
export const mockAIManager = new MockAIManager();

/**
 * 設置 AI 服務 Mock
 * 
 * @param options - Mock 選項
 * @returns Mock 函數對象
 */
export function setupAIMock(options: MockAIOptions = {}): {
  detectCaseType: jest.Mock;
  generateJudgment: jest.Mock;
  generateReconciliationPlans: jest.Mock;
  generateText: jest.MockedFunction<(prompt: string) => Promise<string>>;
  generateSummary: jest.Mock;
} {
  mockAIManager.configure(options);

  return {
    detectCaseType: mockAIManager.createMockDetectCaseType(),
    generateJudgment: mockAIManager.createMockGenerateJudgment(),
    generateReconciliationPlans: mockAIManager.createMockGenerateReconciliationPlans(),
    generateText: mockAIManager.createMockGenerateText(),
    generateSummary: mockAIManager.createMockGenerateSummary(),
  };
}

/**
 * 重置所有 AI Mock
 */
export function resetAIMock(): void {
  mockAIManager.reset();
}

/**
 * 創建快速判決響應（用於測試特定場景）
 */
export function createJudgmentResponse(
  plaintiffRatio: number,
  defendantRatio: number,
  summary?: string
): MockJudgmentResponse {
  return {
    content: `## ⚖️ 判決結果

**責任分比例**：
- 原告：${plaintiffRatio}% 責任
- 被告：${defendantRatio}% 責任

### 判決說明
這是一個測試判決結果。`,
    responsibilityRatio: { plaintiff: plaintiffRatio, defendant: defendantRatio },
    summary: summary || `測試判決摘要：原告 ${plaintiffRatio}%，被告 ${defendantRatio}%`,
  };
}
