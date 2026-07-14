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
    const result = service.render(core);

    expect(result.content).toBe(core.content);
    expect(result.summary).toBe(core.summary);
    expect(result.responsibilityRatio).toBe(core.responsibilityRatio);
    expect(result.emotionalAnalysis).toBe(core.emotionalAnalysis);
    expect(result.deliveryReceipt.controlsApplied).toBe(false);
  });

  it('stale private-controls caller 也不能改變 Universal Shared Renderer output', () => {
    const withoutPrivateControls = service.render(core);
    const staleRuntimeCaller = service.render as unknown as (
      input: typeof core,
      controls: Record<string, unknown>,
      locale: string,
    ) => ReturnType<typeof service.render>;
    const withPrivateControls = staleRuntimeCaller(core, {
      pace: 'slower',
      ask_permission_before_depth: true,
      offer_pause: true,
      question_style: 'gentle',
      max_questions: 1,
    }, 'zh-TW');

    expect(withPrivateControls).toEqual(withoutPrivateControls);
    expect(withPrivateControls.content).toBe(core.content);
    expect(withPrivateControls.summary).toBe(core.summary);
    expect(withPrivateControls.responsibilityRatio).toBe(core.responsibilityRatio);
    expect(withPrivateControls.emotionalAnalysis).toBe(core.emotionalAnalysis);
    expect(withPrivateControls.deliveryReceipt.controlsApplied).toBe(false);
    expect(withPrivateControls.deliveryReceipt.rendererVersion).toBe(
      'judgment-delivery-renderer@v2.0',
    );
  });
});
