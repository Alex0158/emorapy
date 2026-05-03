import { describe, expect, it } from '@jest/globals';
import { getRepairEligibilityForCase } from '../../../src/services/repair-eligibility.service';

describe('repair-eligibility.service', () => {
  it('session-bound quick case 應強制 solo 並禁止伴侶邀請與通知', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'quick',
      session_id: 'guest_1',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    });

    expect(policy.flow).toBe('session_bound');
    expect(policy.canGeneratePlans).toBe(true);
    expect(policy.forceSoloRepair).toBe(true);
    expect(policy.canInvitePartner).toBe(false);
    expect(policy.canNotifyPartner).toBe(false);
  });

  it('session-bound collaborative case 應強制 solo', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'collaborative',
      session_id: 'guest_1',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    });

    expect(policy.flow).toBe('session_bound');
    expect(policy.forceSoloRepair).toBe(true);
    expect(policy.canUseCoRepair).toBe(false);
  });

  it('正式單方案件可生成方案但不可共同修復', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: null,
    });

    expect(policy.flow).toBe('formal_solo');
    expect(policy.canGeneratePlans).toBe(true);
    expect(policy.forceSoloRepair).toBe(true);
    expect(policy.canInvitePartner).toBe(false);
  });

  it('正式雙方案件可共同修復與通知伴侶', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    });

    expect(policy.flow).toBe('formal_dual');
    expect(policy.canGeneratePlans).toBe(true);
    expect(policy.forceSoloRepair).toBe(false);
    expect(policy.canInvitePartner).toBe(true);
    expect(policy.canNotifyPartner).toBe(true);
  });

  it('沒有任何已登入當事人時不能生成修復方案', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: null,
      defendant_id: null,
    });

    expect(policy.canGeneratePlans).toBe(false);
    expect(policy.forceSoloRepair).toBe(true);
  });
});
