/**
 * Joi 驗證 Schema 測試
 */

import {
  adminAIStreamDetailSchema,
  adminJobStatsQuerySchema,
  adminUpsertConfigSchema,
  claimSessionSchema,
  checkinSchema,
  executionStatusQuerySchema,
  pairingIdParamSchema,
  caseIdParamSchema,
  quickCaseSchema,
  requestChatJudgmentSchema,
  createCaseSchema,
  uuidParamSchema,
  uuidEvidenceParamSchema,
} from '../../../src/utils/validation';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Validation Schemas', () => {
  describe('adminAIStreamDetailSchema', () => {
    it('只接受明確 boolean include_sensitive query', () => {
      expect(adminAIStreamDetailSchema.query!.validate({ include_sensitive: 'true' }).error)
        .toBeUndefined();
      expect(adminAIStreamDetailSchema.query!.validate({ include_sensitive: 'false' }).error)
        .toBeUndefined();
      expect(adminAIStreamDetailSchema.query!.validate({ include_sensitive: 'yes' }).error)
        .toBeDefined();
    });
  });

  describe('requestChatJudgmentSchema', () => {
    it('應接受 exact analysis request reference', () => {
      const { error } = requestChatJudgmentSchema.body!.validate({
        analysis_request_id: validUUID,
      });
      expect(error).toBeUndefined();
    });

    it('應拒絕 legacy caller consent assertion', () => {
      const { error } = requestChatJudgmentSchema.body!.validate({
        participant_consent: {
          role_b_included_messages: true,
        },
      });
      expect(error).toBeDefined();
    });
  });

  describe('checkinSchema', () => {
    it('應接受有效的 plan_id、notes、photos', () => {
      const { error } = checkinSchema.body!.validate({
        plan_id: validUUID,
        notes: '今日完成第一步',
        photos: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      });
      expect(error).toBeUndefined();
    });

    it('應拒絕缺失的 plan_id', () => {
      const { error } = checkinSchema.body!.validate({});
      expect(error).toBeDefined();
    });

    it('應拒絕無效的 plan_id UUID 格式', () => {
      const { error } = checkinSchema.body!.validate({
        plan_id: 'invalid',
      });
      expect(error).toBeDefined();
    });

    it('應拒絕 notes 超過 500 字', () => {
      const { error } = checkinSchema.body!.validate({
        plan_id: validUUID,
        notes: 'a'.repeat(501),
      });
      expect(error).toBeDefined();
    });

    it('應接受 notes 剛好 500 字', () => {
      const { error } = checkinSchema.body!.validate({
        plan_id: validUUID,
        notes: 'a'.repeat(500),
      });
      expect(error).toBeUndefined();
    });

    it('應拒絕 photos 超過 3 個（F05 打卡輸入護欄）', () => {
      const { error } = checkinSchema.body!.validate({
        plan_id: validUUID,
        photos: [
          'https://example.com/1.jpg',
          'https://example.com/2.jpg',
          'https://example.com/3.jpg',
          'https://example.com/4.jpg',
        ],
      });
      expect(error).toBeDefined();
    });

    it('應拒絕 photos 含非 URI 字串', () => {
      const { error } = checkinSchema.body!.validate({
        plan_id: validUUID,
        photos: ['not-a-valid-uri'],
      });
      expect(error).toBeDefined();
    });
  });

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

  describe('claimSessionSchema', () => {
    it('應接受有效 session_id', () => {
      const { error } = claimSessionSchema.body!.validate({ session_id: 'guest_1234567890' });
      expect(error).toBeUndefined();
    });

    it('應拒絕缺失 session_id', () => {
      const { error } = claimSessionSchema.body!.validate({});
      expect(error).toBeDefined();
    });

    it('應拒絕空字串 session_id', () => {
      const { error } = claimSessionSchema.body!.validate({ session_id: '' });
      expect(error).toBeDefined();
    });

    it('應拒絕超過 100 字元的 session_id', () => {
      const { error } = claimSessionSchema.body!.validate({
        session_id: 'a'.repeat(101),
      });
      expect(error).toBeDefined();
    });

    it('應接受剛好 100 字元的 session_id', () => {
      const { error } = claimSessionSchema.body!.validate({
        session_id: 'a'.repeat(100),
      });
      expect(error).toBeUndefined();
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

    it('collaborative 模式缺少 defendant_statement 應拒絕', () => {
      const { error } = createCaseSchema.body!.validate({
        plaintiff_statement: 'a'.repeat(35),
        pairing_id: validUUID,
        mode: 'collaborative',
      });
      expect(error).toBeDefined();
    });

    it('應接受正式案件 safety assertion 欄位', () => {
      const { error } = createCaseSchema.body!.validate({
        plaintiff_statement: 'a'.repeat(35),
        pairing_id: validUUID,
        safety_assertion: {
          contains_sensitive_content: true,
          sensitive_content_handling_ack: true,
        },
        contains_minor: false,
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
