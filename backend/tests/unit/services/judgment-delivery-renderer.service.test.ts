import { JudgmentDeliveryRendererService } from '../../../src/services/judgment-delivery-renderer.service';

describe('JudgmentDeliveryRendererService', () => {
  const service = new JudgmentDeliveryRendererService();
  const core = {
    content: '共同事實與分析內容',
    summary: '不可改變的共同摘要',
    responsibilityRatio: { plaintiff: 45, defendant: 55 },
    emotionalAnalysis: {
      facts: ['只來自共同證據'],
      responsibilityFinding: 'structured-finding',
    },
  };

  it('沒有 controls 時 byte-for-byte 保留 Decision Core 欄位', () => {
    const result = service.render(core, null, 'zh-TW');

    expect(result.content).toBe(core.content);
    expect(result.summary).toBe(core.summary);
    expect(result.responsibilityRatio).toBe(core.responsibilityRatio);
    expect(result.emotionalAnalysis).toBe(core.emotionalAnalysis);
    expect(result.deliveryReceipt.controlsApplied).toBe(false);
  });

  it('controls 只可增加中性閱讀提示，不可改 structured findings', () => {
    const result = service.render(core, {
      pace: 'slower',
      ask_permission_before_depth: true,
      offer_pause: true,
      question_style: 'gentle',
      max_questions: 1,
    }, 'zh-TW');

    expect(result.content).toContain(core.content);
    expect(result.content).toContain('任何一方都可以先暫停');
    expect(result.summary).toBe(core.summary);
    expect(result.responsibilityRatio).toBe(core.responsibilityRatio);
    expect(result.emotionalAnalysis).toBe(core.emotionalAnalysis);
    expect(result.deliveryReceipt.controlsApplied).toBe(true);
  });
});
