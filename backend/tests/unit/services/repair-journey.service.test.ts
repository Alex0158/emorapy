import { describe, expect, it } from '@jest/globals';
import { buildRepairJourneyContext, buildRepairStepTitle } from '../../../src/services/repair-journey.service';

const baseInput = {
  judgmentId: 'judgment-1',
  planId: 'plan-1',
  viewerRole: 'initiator' as const,
  trackStatus: 'solo_active' as const,
  currentCommitment: 'committed' as const,
  partnerCommitment: null,
  canInvite: false,
  hasPartner: false,
  isDualCommitted: false,
};

describe('buildRepairJourneyContext', () => {
  it('預設應維持 zh-TW context copy', () => {
    const context = buildRepairJourneyContext(baseInput);

    expect(context.title).toBe('今天只要先做一小步');
    expect(context.body).toBe('你已經開始這一輪了，先把今天這一小步走完，比急著做很多更重要。');
    expect(context.primary_cta.label).toBe('去看今天的一小步');
  });

  it('en-US 應返回英文 title/body/CTA label', () => {
    const context = buildRepairJourneyContext({
      ...baseInput,
      locale: 'en-US',
    });

    expect(context.title).toBe('Today only needs one small step');
    expect(context.body).toBe(
      'You have already started this round. Finishing this small step matters more than rushing to do a lot.'
    );
    expect(context.primary_cta.label).toBe("View today's small step");
  });

  it('invitee pending en-US 應返回英文邀請 context', () => {
    const context = buildRepairJourneyContext({
      ...baseInput,
      viewerRole: 'invitee',
      trackStatus: 'partner_invited',
      currentCommitment: 'not_viewed',
      hasPartner: true,
      partnerCommitment: 'committed',
      locale: 'en-US',
    });

    expect(context.title).toBe('They invited you to try this together');
    expect(context.body).toBe(
      'You can first see what this step involves. You do not need to agree to solve everything at once.'
    );
    expect(context.primary_cta.label).toBe('View this invitation');
    expect(context.secondary_cta?.label).toBe('Just review the current status');
  });
});

describe('buildRepairStepTitle', () => {
  it('預設應維持 zh-TW step title', () => {
    expect(buildRepairStepTitle(0)).toBe('今天的一小步');
    expect(buildRepairStepTitle(1)).toBe('下一步 2');
    expect(buildRepairStepTitle(0, 'zh-TW', 'replanned')).toBe('重新調整後的下一步');
    expect(buildRepairStepTitle(1, 'zh-TW', 'replanned')).toBe('調整後步驟 3');
  });

  it('en-US 應返回英文 step title', () => {
    expect(buildRepairStepTitle(0, 'en-US')).toBe("Today's small step");
    expect(buildRepairStepTitle(1, 'en-US')).toBe('Next step 2');
    expect(buildRepairStepTitle(0, 'en-US', 'replanned')).toBe('Adjusted next step');
    expect(buildRepairStepTitle(1, 'en-US', 'replanned')).toBe('Adjusted step 3');
  });
});
