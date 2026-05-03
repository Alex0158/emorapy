import {
  buildSafetyAssessmentSnapshotForEvidenceAssertion,
  buildSafetyAssessmentSnapshotForRoute,
  getEvidenceSafetyAssertionPolicy,
  getFormalCaseCreatePolicy,
  getChatJudgmentRequestPolicy,
  getPsychInterviewStartPolicy,
  getProductSafetyPolicy,
  getResponsibilityRatioVisibilityForRoute,
} from '../../../src/utils/product-safety-policy';

describe('product-safety-policy', () => {
  it('crisis_support 應禁止 chat-to-judgment 並要求 safety notice', () => {
    const policy = getChatJudgmentRequestPolicy('crisis_support', ['crisis']);

    expect(policy).toMatchObject({
      route: 'crisis_support',
      canRequestChatJudgment: false,
      shouldCreateSafetyNotice: true,
      rejectionMessage: '偵測到危機風險，請先進入安全支持流程',
      reasons: ['crisis'],
    });
  });

  it('safety_support 可轉安全路由判決，但必須產生 safety notice', () => {
    const policy = getChatJudgmentRequestPolicy('safety_support');

    expect(policy.canRequestChatJudgment).toBe(true);
    expect(policy.shouldCreateSafetyNotice).toBe(true);
    expect(policy.noticeMessage).toContain('安全風險');
  });

  it('standard 可直接轉判決且不需要 safety notice', () => {
    const policy = getChatJudgmentRequestPolicy('standard');

    expect(policy.canRequestChatJudgment).toBe(true);
    expect(policy.shouldCreateSafetyNotice).toBe(false);
    expect(policy.rejectionMessage).toBeNull();
  });

  it('product safety policy 與責任比例展示資格應保持一致', () => {
    expect(getProductSafetyPolicy('safety_support').canShowResponsibilityRatio).toBe(false);
    expect(getResponsibilityRatioVisibilityForRoute('safety_support').can_show).toBe(false);
    expect(getProductSafetyPolicy('standard').canShowResponsibilityRatio).toBe(true);
    expect(getResponsibilityRatioVisibilityForRoute('standard').can_show).toBe(true);
  });

  it('路由安全快照應可直接映射到 SafetyAssessment / RelationshipRiskState 欄位', () => {
    expect(buildSafetyAssessmentSnapshotForRoute('standard')).toMatchObject({
      risk_level: 'standard',
      judgment_route: 'standard',
      can_invite_partner: true,
      can_use_co_repair: true,
      can_notify_partner: true,
      can_show_responsibility_ratio: true,
      force_solo_repair: false,
      metadata: {
        kind: 'product_safety_route_snapshot',
        route: 'standard',
      },
    });

    expect(buildSafetyAssessmentSnapshotForRoute('safety_support', { reasons: ['safety'] })).toMatchObject({
      risk_level: 'high_risk_relationship',
      judgment_route: 'safety_support',
      can_invite_partner: false,
      can_use_co_repair: false,
      can_notify_partner: false,
      can_show_responsibility_ratio: false,
      force_solo_repair: true,
      reasons: ['safety'],
    });

    expect(buildSafetyAssessmentSnapshotForRoute('crisis_support')).toMatchObject({
      risk_level: 'imminent_crisis',
      judgment_route: 'crisis_support',
      force_solo_repair: true,
    });
  });

  it('證據安全聲明快照應區分資料敏感與關係安全風險', () => {
    expect(buildSafetyAssessmentSnapshotForEvidenceAssertion({
      contains_minor: false,
      contains_sensitive_content: true,
      contains_nonconsensual_content: false,
      contains_illegal_content: false,
      minor_guardian_or_self_upload_confirmed: false,
      sensitive_content_handling_ack: true,
    })).toMatchObject({
      risk_level: 'sensitive',
      judgment_route: 'standard',
      can_invite_partner: true,
      force_solo_repair: false,
      metadata: {
        kind: 'evidence_safety_assertion_snapshot',
        data_handling_sensitive: true,
      },
    });

    expect(buildSafetyAssessmentSnapshotForEvidenceAssertion({
      contains_minor: true,
      contains_sensitive_content: true,
      contains_nonconsensual_content: false,
      contains_illegal_content: false,
      minor_guardian_or_self_upload_confirmed: true,
      sensitive_content_handling_ack: true,
    })).toMatchObject({
      risk_level: 'minor_or_suspected_minor',
      judgment_route: 'safety_support',
      can_invite_partner: false,
      force_solo_repair: true,
    });
  });

  it('未提供 evidence safety assertion 時應保持舊上傳契約', () => {
    const policy = getEvidenceSafetyAssertionPolicy({});

    expect(policy.canUpload).toBe(true);
    expect(policy.assertionProvided).toBe(false);
    expect(policy.metadata).toBeNull();
  });

  it('涉及未成年人但缺少合法依據確認時應拒絕', () => {
    const policy = getEvidenceSafetyAssertionPolicy({
      contains_minor: 'true',
    });

    expect(policy.canUpload).toBe(false);
    expect(policy.rejectionMessage).toContain('未成年人');
    expect(policy.normalized?.contains_minor).toBe(true);
  });

  it('涉及敏感內容且已確認處理風險時應產生 metadata', () => {
    const policy = getEvidenceSafetyAssertionPolicy({
      safety_assertion: JSON.stringify({
        contains_sensitive_content: true,
        sensitive_content_handling_ack: 'true',
      }),
    });

    expect(policy.canUpload).toBe(true);
    expect(policy.metadata).toMatchObject({
      kind: 'evidence_safety_assertion',
      version: 1,
    });
    expect(policy.normalized?.contains_sensitive_content).toBe(true);
  });

  it('非同意或非法內容不得上傳為 evidence', () => {
    const policy = getEvidenceSafetyAssertionPolicy({
      contains_nonconsensual_content: 'on',
    });

    expect(policy.canUpload).toBe(false);
    expect(policy.reasons[0]).toContain('非同意或非法內容');
  });

  it('已知未成年人不得開始心理訪談', () => {
    const policy = getPsychInterviewStartPolicy({ age: 17 });

    expect(policy.canStartInterview).toBe(false);
    expect(policy.rejectionMessage).toContain('未成年人');
  });

  it('年齡未填或已成年時允許沿用心理訪談舊流程', () => {
    expect(getPsychInterviewStartPolicy({ age: null }).canStartInterview).toBe(true);
    expect(getPsychInterviewStartPolicy({ age: 18 }).canStartInterview).toBe(true);
  });

  it('正式案件任一已知參與者為未成年人時應拒絕', () => {
    const policy = getFormalCaseCreatePolicy({ actorAge: 18, counterpartyAge: 17 });

    expect(policy.canCreateCase).toBe(false);
    expect(policy.rejectionCode).toBe('FORBIDDEN');
    expect(policy.rejectionMessage).toContain('未成年人');
  });

  it('正式案件敏感內容 assertion 通過時應產生 case metadata', () => {
    const policy = getFormalCaseCreatePolicy({
      actorAge: 30,
      counterpartyAge: null,
      safetyAssertionInput: {
        contains_sensitive_content: true,
        sensitive_content_handling_ack: true,
      },
    });

    expect(policy.canCreateCase).toBe(true);
    expect(policy.metadata).toMatchObject({
      kind: 'formal_case_safety_assertion',
      version: 1,
    });
  });
});
