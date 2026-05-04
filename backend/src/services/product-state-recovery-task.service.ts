import {
  Prisma,
  RecoveryTaskSeverity,
  RecoveryTaskStatus,
} from '@prisma/client';
import prisma from '../config/database';

const RECOVERY_TASK_STATUSES = [
  RecoveryTaskStatus.manual_review_required,
  RecoveryTaskStatus.in_review,
  RecoveryTaskStatus.resolved,
  RecoveryTaskStatus.dismissed,
] as const;

const RECOVERY_TASK_SEVERITIES = [
  RecoveryTaskSeverity.warning,
  RecoveryTaskSeverity.critical,
] as const;

export interface ProductStateRecoveryTaskListQuery {
  limit: number;
  offset: number;
  status?: RecoveryTaskStatus;
  severity?: RecoveryTaskSeverity;
  entityType?: string;
  entityId?: string;
  productFlow?: string;
  source?: string;
  proposalId?: string;
}

export interface ProductStateRecoveryTaskStatusUpdate {
  status: RecoveryTaskStatus;
}

function countMap<T extends string>(keys: readonly T[], rows: Array<Record<string, unknown>>, field: string): Record<T, number> {
  const result = keys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<T, number>);

  for (const row of rows) {
    const key = row[field];
    const count = row._count;
    if (typeof key === 'string' && key in result) {
      result[key as T] = typeof count === 'number'
        ? count
        : typeof count === 'object' && count !== null && typeof (count as { _all?: unknown })._all === 'number'
          ? (count as { _all: number })._all
          : 0;
    }
  }

  return result;
}

function statusTimestampUpdate(status: RecoveryTaskStatus, now: Date): Prisma.ProductStateRecoveryTaskUpdateInput {
  return {
    status,
    resolved_at: status === RecoveryTaskStatus.resolved ? now : null,
    dismissed_at: status === RecoveryTaskStatus.dismissed ? now : null,
  };
}

export class ProductStateRecoveryTaskService {
  async listForAdmin(query: ProductStateRecoveryTaskListQuery) {
    const where: Prisma.ProductStateRecoveryTaskWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.entityType) where.entity_type = query.entityType;
    if (query.entityId) where.entity_id = query.entityId;
    if (query.productFlow) where.product_flow = query.productFlow;
    if (query.source) where.source = query.source;
    if (query.proposalId) where.proposal_id = query.proposalId;

    const [items, total, statusRows, severityRows] = await Promise.all([
      prisma.productStateRecoveryTask.findMany({
        where,
        orderBy: [
          { last_detected_at: 'desc' },
          { created_at: 'desc' },
          { id: 'asc' },
        ],
        skip: query.offset,
        take: query.limit,
      }),
      prisma.productStateRecoveryTask.count({ where }),
      prisma.productStateRecoveryTask.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.productStateRecoveryTask.groupBy({
        by: ['severity'],
        where,
        _count: { _all: true },
      }),
    ]);

    return {
      items,
      total,
      limit: query.limit,
      offset: query.offset,
      summary: {
        byStatus: countMap(RECOVERY_TASK_STATUSES, statusRows as Array<Record<string, unknown>>, 'status'),
        bySeverity: countMap(RECOVERY_TASK_SEVERITIES, severityRows as Array<Record<string, unknown>>, 'severity'),
      },
    };
  }

  async updateStatusByAdmin(taskId: string, input: ProductStateRecoveryTaskStatusUpdate) {
    const existing = await prisma.productStateRecoveryTask.findUnique({
      where: { id: taskId },
    });
    if (!existing) return null;

    const task = await prisma.productStateRecoveryTask.update({
      where: { id: taskId },
      data: statusTimestampUpdate(input.status, new Date()),
    });

    return {
      task,
      previousStatus: existing.status,
    };
  }
}

export const productStateRecoveryTaskService = new ProductStateRecoveryTaskService();
