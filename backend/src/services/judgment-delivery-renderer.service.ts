export type JudgmentDecisionCore<TEmotional> = {
  content: string;
  summary: string;
  responsibilityRatio: { plaintiff: number; defendant: number };
  emotionalAnalysis: TEmotional;
};

export type JudgmentDeliveryResult<TEmotional> = JudgmentDecisionCore<TEmotional> & {
  deliveryReceipt: {
    controlsApplied: boolean;
    rendererVersion: string;
  };
};

const RENDERER_VERSION = 'judgment-delivery-renderer@v2.0';

export class JudgmentDeliveryRendererService {
  render<TEmotional>(
    core: JudgmentDecisionCore<TEmotional>,
  ): JudgmentDeliveryResult<TEmotional> {
    return {
      ...core,
      deliveryReceipt: {
        controlsApplied: false,
        rendererVersion: RENDERER_VERSION,
      },
    };
  }
}

export const judgmentDeliveryRendererService = new JudgmentDeliveryRendererService();
