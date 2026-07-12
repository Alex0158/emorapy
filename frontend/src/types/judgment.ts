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
  responsibility_ratio_visibility?: {
    can_show: boolean;
    reason: string | null;
  };
  reconciliation_policy?: {
    defaultReconciliationIntent: 'repair' | 'cool_down' | 'graceful_exit' | 'safety_support';
    allowedReconciliationIntents: Array<'repair' | 'cool_down' | 'graceful_exit' | 'safety_support'>;
    canInvitePartner: boolean;
    canUseCoRepair: boolean;
    forceSoloRepair: boolean;
  };
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
