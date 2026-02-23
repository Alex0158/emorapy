/**
 * 狀態與標籤文案共用工具（案件狀態、執行狀態、和好方案難度/類型）
 * 供 Case/Detail、Case/List、Execution/Dashboard、Reconciliation/List 使用
 */

import { Tag } from 'antd';
import { t } from '@/utils/i18n';
import type { CaseStatus } from '@/types/case';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  FireOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

/** 案件狀態 → 標籤配置（文案由 i18n 提供） */
const CASE_STATUS_KEYS: Record<CaseStatus, string> = {
  draft: 'caseList.statusDraft',
  submitted: 'caseList.statusSubmitted',
  in_progress: 'caseList.statusInProgress',
  judgment_failed: 'caseList.statusJudgmentFailed',
  completed: 'caseList.statusCompleted',
  cancelled: 'caseList.statusCancelled',
};

const CASE_STATUS_COLORS: Record<CaseStatus, string> = {
  draft: 'default',
  submitted: 'processing',
  in_progress: 'processing',
  judgment_failed: 'error',
  completed: 'success',
  cancelled: 'default',
};

const CASE_STATUS_ICONS: Record<CaseStatus, React.ReactNode> = {
  draft: <ClockCircleOutlined />,
  submitted: <SyncOutlined spin />,
  in_progress: <SyncOutlined spin />,
  judgment_failed: <ExclamationCircleOutlined />,
  completed: <CheckCircleOutlined />,
  cancelled: <CloseCircleOutlined />,
};

/** 執行狀態 → 標籤配置（文案由 i18n 提供） */
const EXECUTION_STATUS_KEYS: Record<string, string> = {
  pending: 'statusTags.execPending',
  in_progress: 'statusTags.execInProgress',
  completed: 'statusTags.execCompleted',
};

const EXECUTION_STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
};

const EXECUTION_STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  in_progress: <FireOutlined />,
  completed: <CheckCircleOutlined />,
};

/** 難度 → i18n key */
const DIFFICULTY_KEYS: Record<string, string> = {
  easy: 'reconList.difficultyEasy',
  medium: 'reconList.difficultyMedium',
  hard: 'reconList.difficultyHard',
};

/** 和好方案類型 → i18n key */
const PLAN_TYPE_KEYS: Record<string, string> = {
  activity: 'reconList.typeActivity',
  communication: 'reconList.typeCommunication',
  intimacy: 'reconList.typeIntimacy',
  gift: 'reconList.typeGift',
  service: 'reconList.typeService',
};

/**
 * 案件狀態標籤（用於 Case/Detail、Case/List）
 */
export function getCaseStatusTag(status: CaseStatus) {
  const key = CASE_STATUS_KEYS[status];
  const color = CASE_STATUS_COLORS[status] ?? 'default';
  const icon = CASE_STATUS_ICONS[status];
  const text = key ? t(key) : String(status);
  return (
    <Tag color={color} icon={icon}>
      {text}
    </Tag>
  );
}

/**
 * 執行狀態標籤（用於 Execution/Dashboard）
 */
export function getExecutionStatusTag(status: string) {
  const key = EXECUTION_STATUS_KEYS[status];
  const color = EXECUTION_STATUS_COLORS[status] ?? 'default';
  const icon = EXECUTION_STATUS_ICONS[status];
  const text = key ? t(key) : status;
  return (
    <Tag color={color} icon={icon}>
      {text}
    </Tag>
  );
}

/**
 * 難度文案（用於 Execution/Dashboard、Reconciliation/List）
 */
export function getDifficultyText(level: string): string {
  const key = DIFFICULTY_KEYS[level];
  return key ? t(key) : level;
}

/**
 * 和好方案類型文案（用於 Execution/Dashboard、Reconciliation/List）
 */
export function getPlanTypeText(type: string): string {
  const key = PLAN_TYPE_KEYS[type];
  return key ? t(key) : type;
}

/**
 * 難度標籤顏色（用於 Reconciliation/List Tag color）
 */
export function getDifficultyTagColor(difficulty: string): string {
  const map: Record<string, string> = {
    easy: 'success',
    medium: 'warning',
    hard: 'error',
  };
  return map[difficulty] ?? 'default';
}

/**
 * 類型標籤顏色（用於 Reconciliation/List、Execution/Dashboard Tag color）
 */
export function getPlanTypeTagColor(type: string): string {
  const map: Record<string, string> = {
    activity: 'blue',
    communication: 'purple',
    intimacy: 'pink',
    gift: 'cyan',
    service: 'green',
  };
  return map[type] ?? 'default';
}

/**
 * 案件類型標籤（用於 Case/List，顯示 type 字串）
 */
export function getCaseTypeTag(type: string): React.ReactNode {
  const colorMap: Record<string, string> = {
    '生活習慣衝突': 'green',
    '消費決策衝突': 'blue',
    '社交關係衝突': 'purple',
    '價值觀衝突': 'orange',
    '情感需求衝突': 'magenta',
    '其他衝突': 'default',
  };
  const i18nMap: Record<string, string> = {
    '生活習慣衝突': 'caseList.typeLife',
    '消費決策衝突': 'caseList.typeConsumption',
    '社交關係衝突': 'caseList.typeSocial',
    '價值觀衝突': 'caseList.typeValues',
    '情感需求衝突': 'caseList.typeEmotion',
    '其他衝突': 'caseList.typeOther',
  };
  const color = colorMap[type] ?? 'default';
  const label = i18nMap[type] ? t(i18nMap[type]) : type;
  return <Tag color={color}>{label}</Tag>;
}
