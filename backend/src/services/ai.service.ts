import { openai, AI_CONFIG } from '../config/openai';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { env } from '../config/env';
import { retryWithBackoff } from '../utils/retry';
import { cacheService, CacheService } from '../utils/cache';
import { lockService } from '../utils/lock';

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemPrompt?: string;
}

export interface JudgmentResponse {
  content: string;
  responsibilityRatio: { plaintiff: number; defendant: number };
  summary: string;
}

export interface ReconciliationPlan {
  title: string;
  description: string;
  steps: string[];
  expected_effect: string;
  time_cost: number;
  money_cost: number;
  emotion_cost: number;
  skill_requirement: number;
  plan_type: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
  estimated_duration?: number;
  difficulty_level?: 'easy' | 'medium' | 'hard';
}

export class AIService {
  private dailyLimit = env.OPENAI_DAILY_LIMIT;
  private cache: CacheService = cacheService;
  private useMock = env.AI_MOCK || env.OPENAI_API_KEY.includes('sk-dev-') || env.OPENAI_API_KEY.includes('your-openai-api-key');

  /**
   * 生成文本（通用方法，帶重試機制）
   */
  async generateText(
    prompt: string,
    options: GenerateOptions = {}
  ): Promise<string> {
    if (this.useMock) {
      return 'Mock AI response for: ' + String(prompt ?? '').substring(0, 50);
    }
    // 檢查並預留每日配額（分布式鎖確保原子性）
    await this.reserveDailyQuota();

    // 使用指數退避重試機制
    return await retryWithBackoff(
      async () => {
        const abortController = new AbortController();
        const timeoutMs = 45000;
        const timeout = setTimeout(() => abortController.abort(), timeoutMs);

        const response = await openai.chat.completions.create(
          {
            model: options.model || AI_CONFIG.model,
            messages: [
              {
                role: 'system',
                content: options.systemPrompt || '你是一個有用的助手。',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: options.maxTokens || AI_CONFIG.maxTokens,
            temperature: options.temperature ?? AI_CONFIG.temperature,
            top_p: options.topP ?? AI_CONFIG.topP,
            frequency_penalty: options.frequencyPenalty ?? AI_CONFIG.frequencyPenalty,
            presence_penalty: options.presencePenalty ?? AI_CONFIG.presencePenalty,
          },
          { signal: abortController.signal as any }
        );
        clearTimeout(timeout);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw Errors.AI_SERVICE_ERROR('AI返回空內容');
        }

        return content;
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        shouldRetry: (error: any) => {
          // 4xx錯誤不重試（認證失敗、限額超標等）
          if (error.status >= 400 && error.status < 500) {
            return false;
          }
          // 網絡錯誤和5xx錯誤重試
          return true;
        },
      }
    ).catch((error: any) => {
      // 回補配額（生成失敗時，並防止計數變負）
      const today = new Date().toISOString().split('T')[0];
      const countKey = CacheService.generateKey('ai:daily:count', today);
      lockService.withLock(`lock:${countKey}`, async () => {
        const count = (await this.cache.get<number>(countKey)) || 0;
        const next = Math.max(0, count - 1);
        await this.cache.set(countKey, next, 24 * 60 * 60);
      }, 5).catch(() => {});

      logger.error('OpenAI API error after retries', {
        error: error.message,
        prompt: prompt.substring(0, 100),
      });

      if (error.status === 429) {
        throw Errors.AI_SERVICE_ERROR('AI服務請求過於頻繁，請稍後再試');
      } else if (error.status === 401) {
        throw Errors.AI_SERVICE_ERROR('AI服務認證失敗');
      } else {
        throw Errors.AI_SERVICE_ERROR('AI服務暫時不可用');
      }
    });
  }

  /**
   * 預留每日配額（分布式鎖確保原子性）
   */
  private async reserveDailyQuota(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const countKey = CacheService.generateKey('ai:daily:count', today);

    await lockService.withLock(`lock:${countKey}`, async () => {
      const count = (await this.cache.get<number>(countKey)) || 0;
      if (count >= this.dailyLimit) {
        throw Errors.AI_SERVICE_ERROR('今日AI服務調用已達上限');
      }
      await this.cache.set(countKey, count + 1, 24 * 60 * 60);
    }, 5);
  }

  /**
   * 識別案件類型（帶緩存）
   */
  async detectCaseType(
    plaintiffStatement: string,
    defendantStatement: string
  ): Promise<string> {
    if (this.useMock) {
      return '其他衝突';
    }
    // 生成緩存鍵
    const cacheKey = CacheService.generateHashKey(
      'caseType',
      plaintiffStatement + defendantStatement
    );

    // 檢查緩存（7天有效期）
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) {
      logger.debug('Case type cache hit', { cacheKey });
      return cached;
    }

    const prompt = `請分析以下兩個陳述，判斷案件類型。

案件類型包括：
1. 生活習慣衝突（如：作息時間、飲食習慣、衛生習慣等）
2. 消費決策衝突（如：購物決策、理財方式、消費觀念等）
3. 社交關係衝突（如：朋友關係、家庭關係、社交活動等）
4. 價值觀衝突（如：人生觀、價值觀、信仰等）
5. 情感需求衝突（如：陪伴需求、情感表達、親密需求等）
6. 其他衝突

原告陳述：${plaintiffStatement}
被告陳述：${defendantStatement}

請只返回案件類型名稱（如：生活習慣衝突），不要返回其他內容。`;

    try {
      const response = await this.generateText(prompt, {
        maxTokens: 10,
        temperature: 0.3, // 低溫度，更確定性
        systemPrompt: '你是一個專業的衝突分析師。',
      });

      // 清理響應，提取案件類型
      const caseType = response.trim().replace(/[。.，,]/g, '');

      // 驗證案件類型
      const validTypes = [
        '生活習慣衝突',
        '消費決策衝突',
        '社交關係衝突',
        '價值觀衝突',
        '情感需求衝突',
        '其他衝突',
      ];

      const finalType = validTypes.includes(caseType) ? caseType : '其他衝突';

      // 保存緩存（7天）
      await this.cache.set(cacheKey, finalType, 7 * 24 * 60 * 60);

      return finalType;
    } catch (error) {
      logger.error('Failed to detect case type', { error });
      return '其他衝突'; // 默認類型
    }
  }

  /**
   * 生成判決書
   */
  async generateJudgment(
    caseType: string,
    plaintiffStatement: string,
    defendantStatement: string
  ): Promise<JudgmentResponse> {
    if (this.useMock) {
      const content = '## ⚖️ 判決結果\n\n**責任分比例**：\n- 原告：60% 責任\n- 被告：40% 責任\n\n### 問題分析\n\n經過分析，這是一個生活習慣相關的衝突。請在尊重彼此的前提下制定可執行的分工與溝通規則。\n\n### 具體建議\n\n1. 共同制定家務分工表\n2. 每週一次檢視與調整\n3. 約定遲到與溝通規則\n4. 為對方留出彈性與理解\n\n### 關係修復建議\n\n安排固定的高品質相處時間，練習傾聽與共情，逐步修復摩擦帶來的情緒。';
      const responsibilityRatio = { plaintiff: 60, defendant: 40 };
      const summary = '建議透過溝通與分工機制改善生活習慣衝突，原告60%、被告40%。';
      return { content, responsibilityRatio, summary };
    }
    const prompt = this.buildJudgmentPrompt(caseType, plaintiffStatement, defendantStatement);

    try {
      const content = await this.generateText(prompt, {
        maxTokens: 2000,
        temperature: 0.7,
        systemPrompt: '你是一位溫暖、公正的母熊法官。',
      });

      // 提取責任分比例
      const responsibilityRatio = this.extractResponsibilityRatio(content);

      // 生成摘要
      const summary = await this.generateSummary(content);

      return {
        content,
        responsibilityRatio,
        summary,
      };
    } catch (error) {
      logger.error('Failed to generate judgment', { error });
      throw error;
    }
  }

  /**
   * 構建判決Prompt
   */
  private buildJudgmentPrompt(
    caseType: string,
    plaintiffStatement: string,
    defendantStatement: string
  ): string {
    return `角色設定：
你是一位溫暖、公正的母熊法官，你的使命是保護和呵護每一對情侶。
即使是在法庭，你也會用大愛、包容、保護的方式幫助他們解決衝突。

任務：
基於以下案件信息，生成一份溫暖、公正、實用的判決書。

案件信息：
- 案件類型：${caseType}
- 原告陳述：${plaintiffStatement}
- 被告陳述：${defendantStatement || '暫無'}

判決書要求：
1. 問題分析（200-300字）：
   - 識別核心問題
   - 分析雙方立場
   - 理解雙方需求

2. 判決結果（100-200字）：
   - 明確判決（支持原告/支持被告/雙方各承擔責任）
   - **責任分比例**（必須）：
     - 以百分比形式明確雙方責任（如：原告60%，被告40%）
     - 說明責任分配的理由
   - 簡要說明理由
   - 強調理解和包容

3. 具體建議（300-500字）：
   - 提供3-5條具體行動建議
   - 每條建議要可執行
   - 建議要溫暖、實用

4. 關係修復建議（200-300字）：
   - 如何修復關係
   - 如何重建信任
   - 如何預防類似衝突

語言風格：
- 溫暖、親和
- 專業但不冷漠
- 鼓勵而非指責
- 體現「保護和呵護」的理念

輸出格式：Markdown格式，必須包含責任分比例，格式如下：
## ⚖️ 判決結果
**責任分比例**：
- 原告：[X]% 責任
- 被告：[Y]% 責任
...`;
  }

  /**
   * 提取責任分比例
   */
  private extractResponsibilityRatio(
    content: string
  ): { plaintiff: number; defendant: number } {
    // 使用正則表達式提取
    const regex = /原告[：:]\s*(\d+)%\s*責任|被告[：:]\s*(\d+)%\s*責任/g;
    const matches = Array.from(content.matchAll(regex));

    let plaintiffRatio = 50; // 默認
    let defendantRatio = 50;

    for (const match of matches) {
      if (match[1]) {
        plaintiffRatio = parseInt(match[1], 10);
      }
      if (match[2]) {
        defendantRatio = parseInt(match[2], 10);
      }
    }

    // 確保總和為100
    const total = plaintiffRatio + defendantRatio;
    if (total !== 100) {
      plaintiffRatio = Math.round((plaintiffRatio / total) * 100);
      defendantRatio = 100 - plaintiffRatio;
    }

    return { plaintiff: plaintiffRatio, defendant: defendantRatio };
  }

  /**
   * 生成摘要
   */
  async generateSummary(content: string): Promise<string> {
    if (this.useMock) {
      return '這是一份針對生活習慣衝突的溫暖判決摘要，提供具體建議與修復方向。';
    }
    const prompt = `請為以下判決書生成一個簡短的摘要（50-100字）：

${content}

請只返回摘要內容，不要返回其他內容。`;

    try {
      const summary = await this.generateText(prompt, {
        maxTokens: 150,
        temperature: 0.5,
      });
      return summary.trim();
    } catch (error) {
      logger.error('Failed to generate summary', { error });
      return content.substring(0, 100) + '...'; // 如果生成失敗，返回前100字
    }
  }

  /**
   * 生成和好方案
   */
  async generateReconciliationPlans(
    caseType: string,
    responsibilityRatio: { plaintiff: number; defendant: number },
    judgmentSummary: string
  ): Promise<ReconciliationPlan[]> {
    if (this.useMock) {
      return [
        {
          title: '一起做晚餐',
          description: '共同準備並享用一頓晚餐，透過合作增進溝通與理解。',
          steps: ['討論菜單', '購買食材', '分工做飯', '一起享用'],
          expected_effect: '增進交流、建立共同目標',
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
          description: '輪流說話與傾聽，練習複述對方重點，提升理解與共情。',
          steps: ['選擇安靜環境', '一方說話另一方傾聽', '傾聽者複述理解內容', '角色互換'],
          expected_effect: '改善溝通技巧，減少誤解',
          time_cost: 1,
          money_cost: 1,
          emotion_cost: 3,
          skill_requirement: 3,
          plan_type: 'communication',
          estimated_duration: 1,
          difficulty_level: 'medium',
        },
      ];
    }
    const prompt = this.buildReconciliationPlanPrompt(
      caseType,
      responsibilityRatio,
      judgmentSummary
    );

    try {
      const content = await this.generateText(prompt, {
        maxTokens: 3000,
        temperature: 0.8, // 更高的創造性
        systemPrompt: '你是一位溫暖的母熊法官，專門設計和好方案。',
      });

      // 解析JSON響應
      let plans: ReconciliationPlan[];
      try {
        plans = JSON.parse(content);
      } catch (error) {
        // 如果JSON解析失敗，嘗試提取JSON部分
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          plans = JSON.parse(jsonMatch[0]);
        } else {
          throw Errors.AI_SERVICE_ERROR('無法解析AI響應');
        }
      }

      // 驗證和處理方案
      return plans.map(plan => ({
        ...plan,
        difficulty_level: this.calculateDifficulty(plan),
        estimated_duration: plan.estimated_duration || this.estimateDuration(plan),
      }));
    } catch (error) {
      logger.error('Failed to generate reconciliation plans', { error });
      throw error;
    }
  }

  /**
   * 構建和好方案Prompt
   */
  private buildReconciliationPlanPrompt(
    caseType: string,
    responsibilityRatio: { plaintiff: number; defendant: number },
    judgmentSummary: string
  ): string {
    return `角色設定：
你是一位溫暖的母熊法官，專門為情侶設計和好方案。

任務：
基於以下判決信息，生成3-5個和好方案，幫助雙方修復關係。

判決信息：
- 案件類型：${caseType}
- 責任分比例：原告${responsibilityRatio.plaintiff}%，被告${responsibilityRatio.defendant}%
- 判決摘要：${judgmentSummary}

方案要求：
1. 每個方案包含：
   - 方案標題
   - 方案描述（100-200字）
   - 執行步驟（3-5步）
   - 預期效果
   - 難度評估（時間成本1-5、金錢成本1-5、情感成本1-5、技能要求1-5）

2. 方案類型多樣化：
   - 日常活動（一起做飯、看電影等）
   - 溝通練習（傾聽練習、共情練習等）
   - 親密互動（擁抱、約會等）
   - 禮物/驚喜（小禮物、手寫卡片等）
   - 服務/幫忙（分擔家務、代辦事項等）

3. 根據案件類型推薦：
   - 生活習慣衝突 → 習慣養成活動
   - 價值觀衝突 → 理解尊重活動
   - 情感需求衝突 → 親密互動活動

4. 難度分級：
   - 簡單（總分4-8）：1-2天可完成
   - 中等（總分9-12）：3-7天可完成
   - 困難（總分13-20）：1-4週可完成

輸出格式：JSON數組，每個方案包含：
{
  "title": "方案標題",
  "description": "方案描述",
  "steps": ["步驟1", "步驟2", ...],
  "expected_effect": "預期效果",
  "time_cost": 1-5,
  "money_cost": 1-5,
  "emotion_cost": 1-5,
  "skill_requirement": 1-5,
  "plan_type": "activity|communication|intimacy|gift|service",
  "estimated_duration": 天數
}`;
  }

  /**
   * 計算難度等級
   */
  private calculateDifficulty(plan: ReconciliationPlan): 'easy' | 'medium' | 'hard' {
    const totalScore =
      plan.time_cost +
      plan.money_cost +
      plan.emotion_cost +
      plan.skill_requirement;

    if (totalScore <= 8) return 'easy';
    if (totalScore <= 12) return 'medium';
    return 'hard';
  }

  /**
   * 估算持續時間
   */
  private estimateDuration(plan: ReconciliationPlan): number {
    const totalScore =
      plan.time_cost +
      plan.money_cost +
      plan.emotion_cost +
      plan.skill_requirement;

    if (totalScore <= 8) return 1; // 1-2天
    if (totalScore <= 12) return 5; // 3-7天
    return 14; // 1-4週
  }

  /**
   * 重置每日調用計數（定時任務）
   */
  async resetDailyCallCount(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const countKey = CacheService.generateKey('ai:daily:count', today);
    await this.cache.set(countKey, 0, 24 * 60 * 60);
    logger.info('AI service daily call count reset');
  }
}

export const aiService = new AIService();
