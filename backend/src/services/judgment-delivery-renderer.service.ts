import type { BackendLocale } from '../i18n';
import type { MediationControls } from './mediation-strategy.service';

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

const RENDERER_VERSION = 'judgment-delivery-renderer@v1.0';

export class JudgmentDeliveryRendererService {
  render<TEmotional>(
    core: JudgmentDecisionCore<TEmotional>,
    controls: MediationControls | null,
    locale: BackendLocale,
  ): JudgmentDeliveryResult<TEmotional> {
    if (!controls) {
      return {
        ...core,
        deliveryReceipt: {
          controlsApplied: false,
          rendererVersion: RENDERER_VERSION,
        },
      };
    }

    const guidance = locale === 'en-US'
      ? [
          controls.pace === 'slower'
            ? 'Read this in small sections; there is no need to respond to everything at once.'
            : null,
          controls.ask_permission_before_depth
            ? 'Before discussing a deeper section, check that both people are ready to continue.'
            : null,
          controls.offer_pause
            ? 'Either person may pause and return when the conversation feels manageable.'
            : null,
        ].filter(Boolean)
      : [
          controls.pace === 'slower'
            ? '以下內容可以分段閱讀，不需要一次回應全部。'
            : null,
          controls.ask_permission_before_depth
            ? '進入較深入的段落前，可以先確認雙方都準備好繼續。'
            : null,
          controls.offer_pause
            ? '任何一方都可以先暫停，待對話較能承受時再回來。'
            : null,
        ].filter(Boolean);
    const prefix = guidance.length > 0 ? `${guidance.join('\n')}\n\n` : '';

    return {
      content: `${prefix}${core.content}`,
      summary: core.summary,
      responsibilityRatio: core.responsibilityRatio,
      emotionalAnalysis: core.emotionalAnalysis,
      deliveryReceipt: {
        controlsApplied: guidance.length > 0,
        rendererVersion: RENDERER_VERSION,
      },
    };
  }
}

export const judgmentDeliveryRendererService = new JudgmentDeliveryRendererService();
