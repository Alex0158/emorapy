type PrivateStrategySource = {
  participantId: string;
  messages: string[];
};

export type MediationControlExtractionOutcome = 'containment_disabled';

export type MediationControlExtractionResult = {
  controls: null;
  outcome: MediationControlExtractionOutcome;
};

export class MediationStrategyService {
  async extractAggregatedControlsWithOutcome(
    _roomId: string,
    _sources: PrivateStrategySource[],
  ): Promise<MediationControlExtractionResult> {
    // Wave 0 containment is intentionally unconditional. Raw private text must
    // not cross into a shared/formal model call until per-owner compilation,
    // explicit all-participant consent and deterministic merging exist.
    return { controls: null, outcome: 'containment_disabled' };
  }

  async extractAggregatedControls(
    roomId: string,
    sources: PrivateStrategySource[],
  ): Promise<null> {
    return (await this.extractAggregatedControlsWithOutcome(roomId, sources)).controls;
  }
}

export const mediationStrategyService = new MediationStrategyService();
