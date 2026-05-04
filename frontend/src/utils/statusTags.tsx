/**
 * 狀態與標籤文案共用工具
 *
 * 遷移: Ant Tag/Icons → shadcn Badge + Lucide
 */

import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, Flame, RefreshCw, XCircle, AlertCircle } from 'lucide-react';
import { t } from '@/utils/i18n';
import type { CaseStatus } from '@/types/case';

const CASE_STATUS_KEYS: Record<CaseStatus, string> = {
  draft: 'caseList.statusDraft',
  submitted: 'caseList.statusSubmitted',
  in_progress: 'caseList.statusInProgress',
  judgment_failed: 'caseList.statusJudgmentFailed',
  completed: 'caseList.statusCompleted',
  cancelled: 'caseList.statusCancelled',
};

const CASE_STATUS_STYLES: Record<CaseStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-primary/10 text-primary',
  in_progress: 'bg-primary/10 text-primary',
  judgment_failed: 'bg-destructive/10 text-destructive',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

const CASE_STATUS_ICONS: Record<CaseStatus, React.ReactNode> = {
  draft: <Clock className="size-3" />,
  submitted: <RefreshCw className="size-3" />,
  in_progress: <RefreshCw className="size-3" />,
  judgment_failed: <AlertCircle className="size-3" />,
  completed: <CheckCircle className="size-3" />,
  cancelled: <XCircle className="size-3" />,
};

const EXECUTION_STATUS_KEYS: Record<string, string> = {
  pending: 'statusTags.execPending',
  in_progress: 'statusTags.execInProgress',
  completed: 'statusTags.execCompleted',
};

const EXECUTION_STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="size-3" />,
  in_progress: <Flame className="size-3" />,
  completed: <CheckCircle className="size-3" />,
};

const DIFFICULTY_KEYS: Record<string, string> = {
  easy: 'reconList.difficultyEasy',
  medium: 'reconList.difficultyMedium',
  hard: 'reconList.difficultyHard',
};

const PLAN_TYPE_KEYS: Record<string, string> = {
  activity: 'reconList.typeActivity',
  communication: 'reconList.typeCommunication',
  intimacy: 'reconList.typeIntimacy',
  gift: 'reconList.typeGift',
  service: 'reconList.typeService',
};

export function getCaseStatusTag(status: CaseStatus) {
  const key = CASE_STATUS_KEYS[status];
  const style = CASE_STATUS_STYLES[status] ?? '';
  const icon = CASE_STATUS_ICONS[status];
  const text = key ? t(key) : String(status);
  return (
    <Badge variant="secondary" className={`gap-1 text-[11px] ${style}`}>
      {icon}{text}
    </Badge>
  );
}

export function getExecutionStatusTag(status: string) {
  const key = EXECUTION_STATUS_KEYS[status];
  const icon = EXECUTION_STATUS_ICONS[status];
  const text = key ? t(key) : status;
  return (
    <Badge variant="secondary" className="gap-1 text-[11px]">
      {icon}{text}
    </Badge>
  );
}

export function getDifficultyText(level: string): string {
  const key = DIFFICULTY_KEYS[level];
  return key ? t(key) : level;
}

export function getPlanTypeText(type: string): string {
  const key = PLAN_TYPE_KEYS[type];
  return key ? t(key) : type;
}

export function getDifficultyTagColor(difficulty: string): string {
  const map: Record<string, string> = { easy: 'success', medium: 'warning', hard: 'error' };
  return map[difficulty] ?? 'default';
}

export function getPlanTypeTagColor(type: string): string {
  const map: Record<string, string> = { activity: 'blue', communication: 'purple', intimacy: 'pink', gift: 'cyan', service: 'green' };
  return map[type] ?? 'default';
}

export function getCaseTypeTag(type: string): React.ReactNode {
  const i18nMap: Record<string, string> = {
    '生活習慣衝突': 'caseList.typeLife',
    '消費決策衝突': 'caseList.typeConsumption',
    '社交關係衝突': 'caseList.typeSocial',
    '價值觀衝突': 'caseList.typeValues',
    '情感需求衝突': 'caseList.typeEmotion',
    '其他衝突': 'caseList.typeOther',
  };
  const label = i18nMap[type] ? t(i18nMap[type]) : type;
  return <Badge variant="outline" className="text-[11px]">{label}</Badge>;
}
