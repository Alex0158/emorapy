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
export const DEFAULT_JUDGMENT_CONTENT = `## 我聽見你們了

謝謝你們願意把這些寫下來。我知道這些話裡面有很多是積壓了很久的，光是願意說出口，就已經是在為這段關係做一件很勇敢的事。

### 你們之間發生了什麼

角色 A，看起來那頓生日晚餐對你來說不只是一頓飯。你花了整個下午準備——選餐廳、訂位、換衣服、想像他走進來時驚喜的表情。但等來的是一個小時的空座位、一通沒打來的電話、和最後他推門進來時那句輕描淡寫的「不好意思，開會」。也許讓你最心寒的不是遲到本身，而是你覺得：**我精心準備了這一切，你卻連提前五分鐘告訴我一聲都做不到。** 那種感覺不是「生氣」兩個字能概括的——更像是一種孤獨，一種「我在這段關係裡到底重不重要」的恐懼。

角色 B，我猜你看到 A 的這些話時，第一反應可能是委屈——「我每天工作到這麼晚，還不是為了我們？那天的會議是老闆臨時叫的，我能怎麼辦？」你不是不在乎那頓晚餐——也許你當時也很焦急，但不敢打電話，因為怕一打就吵起來。**你的沉默不是冷漠——是一種「我先把能控制的事情做好」的應對方式。** 但在你開會的那一個小時裡，A 是一個人坐在餐廳，每隔幾分鐘看一次手機，從期待到焦慮到失望到心寒。

我注意到你們之間有一個反覆出現的模式：當 A 精心準備了什麼東西卻沒有得到期待的回應時，心裡那個「我是不是不夠重要」的開關就會被打開。她會追問、翻舊帳、想要得到一個確認。而 B 面對這些追問時會覺得「我怎麼解釋你都不信」，於是選擇沉默。A 把沉默讀成了「你果然不在乎」，追得更用力——直到兩個人都筋疲力盡。

### 你們做對了什麼

角色 A 生日那天還是精心準備了晚餐——即使之前已經被放鴿子過。這代表你心裡仍然相信「我們可以有美好的時刻」。角色 B，你開完會還是趕去了——雖然遲到了，但你沒有說「算了不去了」。你們現在坐在這裡把話說開，而不是冷戰或假裝沒事，這本身就已經是很多伴侶做不到的事。

### 各自可以調整的方向

**調整比重**：
- 原告：55% 調整空間
- 被告：45% 調整空間

這個 55:45 非常接近，因為你們都在用自己的方式付出，只是對方沒有接收到。角色 A 有稍多調整空間，是因為「翻舊帳」會讓 B 很難安全地參與對話——當 B 覺得不管怎麼做都會被拿以前的事再打一次，就更傾向關閉。如果 A 能學會把「這一次的事」和「以前的事」分開處理，B 就更可能願意把門打開。

### 可以直接用的對話

**角色 A 可以試著這樣對角色 B 說：**
> 「我想跟你聊聊生日那天的事，但我先說——我不是要翻舊帳。那天你遲到的時候，我一個人坐在餐廳裡，心裡其實不是生氣，是害怕。我怕我在你心裡沒那麼重要。我知道你工作忙，但我真的很需要知道——在你要遲到的時候，你可以打個電話告訴我一聲嗎？」

**角色 B 可以試著這樣對角色 A 說：**
> 「那天的事我一直想說但不知道怎麼開口。開會的時候我真的有看手機，看到時間越來越晚心裡很急。但我不敢打給你，怕你生氣我會更焦慮。我知道這樣不對——以後不管會不會被罵，我都先打一通電話。因為讓你知道我在路上，比什麼都重要。」

### 具體可以嘗試的事

1. 建立「5 分鐘通知規則」：遲到超過 15 分鐘就先發訊息，不是報備，是讓對方知道你心裡有他/她
2. 每次只聊一件事，不翻舊帳——把累積的傷分開處理，一次一件，慢慢來
3. 約定一個「修復暗號」——當追問-沉默的循環快啟動時，主動說出來

### 寫給你們的話

角色 A，你為那頓晚餐付出的心思是真實的，你的失望也是真實的。角色 B，你趕去餐廳的那份急迫也是真實的。你們的感受沒有一個是「錯的」——只是還沒找到一種方式，讓這些感受可以安全地被對方接住。`;

/**
 * 默認的 Mock 判決響應
 */
export const DEFAULT_MOCK_JUDGMENT: MockJudgmentResponse = {
  content: DEFAULT_JUDGMENT_CONTENT,
  responsibilityRatio: { plaintiff: 55, defendant: 45 },
  summary: '這次衝突的核心不是「遲到」，而是「我在你心裡到底重不重要」。角色 A 精心準備的生日晚餐被遲到打破，觸發了累積的「不被重視」的傷；角色 B 不是不在乎，而是不知道怎麼在壓力和伴侶需求之間找到平衡。建議從「5 分鐘通知規則」和每次只聊一件事開始。',
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
    title: '建立「我在路上」的安全訊號',
    description: '從今天開始，如果有任何一方會比約定時間晚超過 15 分鐘，就發一條訊息：「我會晚一點到，但我一定會來。」這不是報備，而是讓對方知道——你心裡有他/她。',
    steps: ['兩人約定一個「通知時間」（遲到 15 分鐘以上就通知）', '選擇通知方式：電話、訊息、或專屬 emoji', '角色 B 今天就找機會主動發「我在想你」', '如果做到了，角色 A 回一個正面回應'],
    expected_effect: '角色 A 不再需要在等待中焦慮猜測；角色 B 會發現報平安其實很簡單',
    time_cost: 1,
    money_cost: 1,
    emotion_cost: 1,
    skill_requirement: 1,
    plan_type: 'communication',
    estimated_duration: 1,
    difficulty_level: 'easy',
  },
  {
    title: '一起重做那頓生日晚餐',
    description: '找一個週末，兩個人一起去買菜、一起下廚，重做那頓被遲到打斷的生日晚餐。穿著睡衣在家裡邊煮邊聊，創造一個新的記憶去覆蓋那個讓兩個人都不舒服的舊記憶。',
    steps: ['角色 B 主動提議時間和菜色', '一起去市場採購——買菜的路上自然就會聊天', '下廚時分工合作，允許搞砸和大笑', '吃飯時一人說一件「我最喜歡我們在一起的某個瞬間」'],
    expected_effect: '用愉快的共同經歷修復那頓晚餐的遺憾，讓角色 B 有機會用行動表達「你對我很重要」',
    time_cost: 3,
    money_cost: 2,
    emotion_cost: 2,
    skill_requirement: 2,
    plan_type: 'activity',
    estimated_duration: 1,
    difficulty_level: 'easy',
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
    content: `## 我聽見你們了

### 各自可以調整的方向

**調整比重**：
- 原告：${plaintiffRatio}% 調整空間
- 被告：${defendantRatio}% 調整空間

### 寫給你們的話
這是一段測試回應，用於驗證系統功能。`,
    responsibilityRatio: { plaintiff: plaintiffRatio, defendant: defendantRatio },
    summary: summary || `測試摘要：角色 A ${plaintiffRatio}%，角色 B ${defendantRatio}%`,
  };
}
