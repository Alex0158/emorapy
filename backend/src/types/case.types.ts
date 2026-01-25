/**
 * 案件相關類型定義
 */

export interface QuickCaseDto {
  plaintiff_statement: string;
  defendant_statement: string;
  evidence_urls?: string[];
}

export interface CreateCaseDto {
  pairing_id: string;
  title?: string;
  plaintiff_statement: string;
  defendant_statement?: string;
  evidence_urls?: string[];
}

export type CaseStatus = 'draft' | 'submitted' | 'in_progress' | 'completed' | 'cancelled';
export type CaseMode = 'remote' | 'collaborative' | 'quick';
export type CaseType = 
  | '生活習慣衝突'
  | '消費決策衝突'
  | '社交關係衝突'
  | '價值觀衝突'
  | '情感需求衝突'
  | '其他衝突';

