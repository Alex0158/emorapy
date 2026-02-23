/**
 * 案件相關類型定義
 */

export type CaseStatus = 'draft' | 'submitted' | 'in_progress' | 'completed' | 'cancelled' | 'judgment_failed';
export type CaseMode = 'remote' | 'collaborative' | 'quick';

export interface CaseJudgmentSummary {
  id: string;
  summary?: string;
  plaintiff_ratio?: number;
  defendant_ratio?: number;
}

export interface CasePairingUser {
  id: string;
  nickname?: string;
  avatar_url?: string;
}

export interface CasePairing {
  id: string;
  user1?: CasePairingUser;
  user2?: CasePairingUser;
}

export interface Case {
  id: string;
  pairing_id: string;
  title: string;
  type: string;
  sub_type?: string;
  plaintiff_id?: string;
  defendant_id?: string;
  plaintiff_statement: string;
  defendant_statement?: string;
  status: CaseStatus;
  judgment_failure_reason?: string;
  mode: CaseMode;
  session_id?: string;
  evidences?: Evidence[];
  judgment?: CaseJudgmentSummary | null;
  pairing?: CasePairing | null;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  completed_at?: string;
}

export interface CreateCaseDto {
  pairing_id: string;
  title?: string;
  plaintiff_statement: string;
  defendant_statement?: string;
  evidence_urls?: string[];
  mode?: 'remote' | 'collaborative';
}

export interface UpdateCaseDto {
  title?: string;
  plaintiff_statement?: string;
  defendant_statement?: string;
}

export interface QuickCaseDto {
  plaintiff_statement: string;
  defendant_statement: string;
  evidence_urls?: string[];
}

export interface Evidence {
  id: string;
  case_id: string;
  file_url: string;
  file_type: 'image' | 'video';
  file_size: number;
  description?: string;
  created_at: string;
}
