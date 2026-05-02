/**
 * 判決相關類型定義
 */

import type { ResponsibilityRatio } from './common';

export interface Judgment {
  id: string;
  case_id: string;
  judgment_content: string; // Markdown格式
  summary?: string;
  plaintiff_ratio: number;
  defendant_ratio: number;
  // 向後兼容舊字段
  responsibility_ratio?: ResponsibilityRatio;
  judgment_route?: 'standard' | 'safety_support' | 'crisis_support';
  ai_model: string;
  prompt_version?: string;
  user1_acceptance?: boolean;
  user2_acceptance?: boolean;
  user1_rating?: number; // 1-5
  user2_rating?: number; // 1-5
  created_at: string;
  updated_at: string;
}

export interface AcceptJudgmentDto {
  accepted: boolean;
  rating?: number; // 1-5
}
