/**
 * 案件相關類型定義
 */

export type CaseStatus = 'draft' | 'submitted' | 'in_progress' | 'completed' | 'cancelled' | 'judgment_failed';
export type CaseMode = 'remote' | 'collaborative' | 'quick';

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
  mode: CaseMode;
  session_id?: string; // 快速體驗模式
  evidences?: Evidence[];
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  completed_at?: string;
}

export interface CreateCaseDto {
  pairing_id?: string; // 完整模式需要
  title?: string;
  type?: string;
  sub_type?: string;
  plaintiff_statement: string;
  defendant_statement: string;
  evidence_urls?: string[];
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
