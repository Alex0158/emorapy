/**
 * Joi 驗證 Schema 測試
 */

import {
  executionStatusQuerySchema,
  pairingIdParamSchema,
  caseIdParamSchema,
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
});
