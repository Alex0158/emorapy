import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RecoveryTaskSeverity, RecoveryTaskStatus } from '@prisma/client';

const prismaMock = {
  productStateRecoveryTask: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { ProductStateRecoveryTaskService } from '../../../src/services/product-state-recovery-task.service';

describe('ProductStateRecoveryTaskService', () => {
  let service: ProductStateRecoveryTaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductStateRecoveryTaskService();
  });

  it('listForAdmin 應按人工恢復任務欄位查詢並返回狀態摘要', async () => {
    (prismaMock.productStateRecoveryTask.findMany as any).mockResolvedValue([{ id: 'task-1' }]);
    (prismaMock.productStateRecoveryTask.count as any).mockResolvedValue(1);
    (prismaMock.productStateRecoveryTask.groupBy as any)
      .mockResolvedValueOnce([
        { status: RecoveryTaskStatus.manual_review_required, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { severity: RecoveryTaskSeverity.critical, _count: { _all: 1 } },
      ]);

    const result = await service.listForAdmin({
      status: RecoveryTaskStatus.manual_review_required,
      severity: RecoveryTaskSeverity.critical,
      entityType: 'case',
      entityId: 'case-1',
      productFlow: 'formal_remote',
      source: 'ops_product_state_audit',
      proposalId: 'stuck_case_in_progress',
      limit: 10,
      offset: 5,
    });

    const expectedWhere = {
      status: RecoveryTaskStatus.manual_review_required,
      severity: RecoveryTaskSeverity.critical,
      entity_type: 'case',
      entity_id: 'case-1',
      product_flow: 'formal_remote',
      source: 'ops_product_state_audit',
      proposal_id: 'stuck_case_in_progress',
    };
    expect(prismaMock.productStateRecoveryTask.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: [
        { last_detected_at: 'desc' },
        { created_at: 'desc' },
        { id: 'asc' },
      ],
      skip: 5,
      take: 10,
    });
    expect(prismaMock.productStateRecoveryTask.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(result).toEqual({
      items: [{ id: 'task-1' }],
      total: 1,
      limit: 10,
      offset: 5,
      summary: {
        byStatus: {
          manual_review_required: 1,
          in_review: 0,
          resolved: 0,
          dismissed: 0,
        },
        bySeverity: {
          warning: 0,
          critical: 1,
        },
      },
    });
  });

  it('updateStatusByAdmin 標記 resolved 時只更新任務狀態與 resolved_at', async () => {
    const existing = {
      id: 'task-1',
      status: RecoveryTaskStatus.in_review,
    };
    const updated = {
      ...existing,
      status: RecoveryTaskStatus.resolved,
      resolved_at: new Date('2026-05-04T10:00:00.000Z'),
      dismissed_at: null,
    };
    (prismaMock.productStateRecoveryTask.findUnique as any).mockResolvedValue(existing);
    (prismaMock.productStateRecoveryTask.update as any).mockResolvedValue(updated);

    const result = await service.updateStatusByAdmin('task-1', {
      status: RecoveryTaskStatus.resolved,
    });

    expect(prismaMock.productStateRecoveryTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        status: RecoveryTaskStatus.resolved,
        resolved_at: expect.any(Date),
        dismissed_at: null,
      },
    });
    expect(result).toEqual({
      task: updated,
      previousStatus: RecoveryTaskStatus.in_review,
    });
  });

  it('updateStatusByAdmin 任務不存在時返回 null', async () => {
    (prismaMock.productStateRecoveryTask.findUnique as any).mockResolvedValue(null);

    const result = await service.updateStatusByAdmin('missing-task', {
      status: RecoveryTaskStatus.dismissed,
    });

    expect(result).toBeNull();
    expect(prismaMock.productStateRecoveryTask.update).not.toHaveBeenCalled();
  });
});
