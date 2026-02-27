/**
 * Joi 驗證 Schema 測試
 */

import {
  adminJobStatsQuerySchema,
  adminUpsertConfigSchema,
  executionStatusQuerySchema,
  pairingIdParamSchema,
  caseIdParamSchema,
  quickCaseSchema,
  createCaseSchema,
  uuidParamSchema,
  uuidEvidenceParamSchema,
} from '../../../src/utils/validation';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Validation Schemas', () => {
  describe('executionStatusQuerySchema', () => {
    it('應接受有效的 plan_id', () => {
      const { error } = executionStatusQuerySchema.query!.validate({
        plan_id: validUUID,
      });
      expect(error).toBeUndefined();
    });

    it('應拒絕缺失的 plan_id', () => {
      const { error } = executionStatusQuerySchema.query!.validate({});
      expect(error).toBeDefined();
    });

    it('應拒絕無效的 UUID 格式', () => {
      const { error } = executionStatusQuerySchema.query!.validate({
        plan_id: 'invalid',
      });
      expect(error).toBeDefined();
    });
  });

  describe('pairingIdParamSchema', () => {
    it('應接受有效的 pairingId', () => {
      const { error } = pairingIdParamSchema.params!.validate({
        pairingId: validUUID,
      });
      expect(error).toBeUndefined();
    });

    it('應拒絕缺失的 pairingId', () => {
      const { error } = pairingIdParamSchema.params!.validate({});
      expect(error).toBeDefined();
    });

    it('應拒絕無效的 UUID 格式', () => {
      const { error } = pairingIdParamSchema.params!.validate({
        pairingId: 'not-a-uuid',
      });
      expect(error).toBeDefined();
    });
  });

  describe('caseIdParamSchema', () => {
    it('應接受有效的 caseId', () => {
      const { error } = caseIdParamSchema.params!.validate({
        caseId: validUUID,
      });
      expect(error).toBeUndefined();
    });

    it('應拒絕無效的 UUID 格式', () => {
      const { error } = caseIdParamSchema.params!.validate({
        caseId: 'invalid',
      });
      expect(error).toBeDefined();
    });
  });

  describe('quickCaseSchema', () => {
    it('應接受快速體驗有效請求', () => {
      const { error } = quickCaseSchema.body!.validate({
        plaintiff_statement: 'a'.repeat(35),
        defendant_statement: 'b'.repeat(12),
        evidence_urls: ['https://example.com/1.jpg'],
      });
      expect(error).toBeUndefined();
    });

    it('應拒絕 http 證據 URL', () => {
      const { error } = quickCaseSchema.body!.validate({
        plaintiff_statement: 'a'.repeat(35),
        evidence_urls: ['http://example.com/1.jpg'],
      });
      expect(error).toBeDefined();
    });
  });

  describe('createCaseSchema', () => {
    it('應接受完整建立案件有效請求', () => {
      const { error } = createCaseSchema.body!.validate({
        plaintiff_statement: 'a'.repeat(35),
        defendant_statement: '',
        evidence_urls: ['https://example.com/1.jpg'],
        pairing_id: validUUID,
        title: '測試標題',
        type: '生活習慣衝突',
        sub_type: '家務分工',
      });
      expect(error).toBeUndefined();
    });

    it('缺少 pairing_id 應拒絕', () => {
      const { error } = createCaseSchema.body!.validate({
        plaintiff_statement: 'a'.repeat(35),
      });
      expect(error).toBeDefined();
    });
  });

  describe('uuidParamSchema / uuidEvidenceParamSchema', () => {
    it('uuidParamSchema 應允許 evidenceId 可選', () => {
      const { error } = uuidParamSchema.params!.validate({ id: validUUID });
      expect(error).toBeUndefined();
    });

    it('uuidEvidenceParamSchema 應要求 evidenceId', () => {
      const { error } = uuidEvidenceParamSchema.params!.validate({
        id: validUUID,
      });
      expect(error).toBeDefined();
    });
  });

  describe('admin schemas', () => {
    it('adminJobStatsQuerySchema 應接受 1~90 的 days', () => {
      const ok1 = adminJobStatsQuerySchema.query!.validate({ days: 1 });
      const ok2 = adminJobStatsQuerySchema.query!.validate({ days: 90 });
      const ok3 = adminJobStatsQuerySchema.query!.validate({ days: 7, includeRunning: false });
      const ok4 = adminJobStatsQuerySchema.query!.validate({ maxRows: 100 });
      const ok5 = adminJobStatsQuerySchema.query!.validate({ maxRows: 20000 });
      expect(ok1.error).toBeUndefined();
      expect(ok2.error).toBeUndefined();
      expect(ok3.error).toBeUndefined();
      expect(ok4.error).toBeUndefined();
      expect(ok5.error).toBeUndefined();
    });

    it('adminJobStatsQuerySchema 應拒絕超界 days', () => {
      const low = adminJobStatsQuerySchema.query!.validate({ days: 0 });
      const high = adminJobStatsQuerySchema.query!.validate({ days: 91 });
      expect(low.error).toBeDefined();
      expect(high.error).toBeDefined();
    });

    it('adminJobStatsQuerySchema 應拒絕超界 maxRows', () => {
      const low = adminJobStatsQuerySchema.query!.validate({ maxRows: 99 });
      const high = adminJobStatsQuerySchema.query!.validate({ maxRows: 20001 });
      expect(low.error).toBeDefined();
      expect(high.error).toBeDefined();
    });

    it('adminUpsertConfigSchema 應拒絕非白名單 key', () => {
      const { error } = adminUpsertConfigSchema.body!.validate({
        key: 'unknown.key',
        value: true,
      });
      expect(error).toBeDefined();
    });
  });
});
