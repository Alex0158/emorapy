import { aiService } from './ai.service';
import type { JudgmentRoute } from './safety-routing.service';

export interface RuptureRepairResult {
  repairedContent: string;
  repairType: 'validation' | 'apology_tone_fix' | 'strategy_reset';
}

/**
 * 聯盟破裂修復：當用戶回饋「沒被理解/被責備」時，先修復承接，再重建建議。
 */
export class RuptureRepairService {
  async repair(input: {
    judgmentContent: string;
    userFeedback: string;
    caseType?: string;
    route?: JudgmentRoute;
  }): Promise<RuptureRepairResult> {
    const feedback = (input.userFeedback || '').trim();
    const lower = feedback.toLowerCase();
    const repairType: RuptureRepairResult['repairType'] =
      /責備|說教|judge|blame/.test(lower)
        ? 'apology_tone_fix'
        : /沒懂|聽不懂|不貼切|不適用|沒幫助/.test(lower)
          ? 'strategy_reset'
          : 'validation';

    const prompt = `你是 Emorapy 的 AI 關係梳理助手，正在修復一次「回應失配」。

任務目標：
1) 先承接對方的受傷感與失落感（1-2段）
2) 用更低防衛、更不說教的語氣重寫建議（2-4段）
3) 保留安全原則：若涉及控制/暴力/自傷，優先安全，不要求危險互動

案件類型：${input.caseType || '未提供'}
當前路徑：${input.route || 'standard'}
修復類型：${repairType}

原始回應（節錄）：
${input.judgmentContent.substring(0, 4000)}

用戶最新反饋：
${feedback}

輸出要求：
- 使用繁體中文
- 不要辯解「為什麼之前那樣寫」
- 不要提及 AI、模型、系統提示
- 給出可立即嘗試的低門檻下一步
- 只返回修復後內容（Markdown）`;

    const repairedContent = await aiService.generateText(prompt, {
      maxTokens: 1500,
      temperature: 0.55,
      systemPrompt: '你是擅長修復互信與承接感的 AI 關係梳理助手，風格溫暖、真誠、去防衛。',
    });

    return {
      repairedContent: repairedContent.trim(),
      repairType,
    };
  }
}

export const ruptureRepairService = new RuptureRepairService();
