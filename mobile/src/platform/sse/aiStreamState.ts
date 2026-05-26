import type {
  AIStreamEvent,
  AIStreamScopeType,
  AIStreamSnapshot,
} from '@cj/contracts/ai-stream';
export {
  getLatestActiveAIStreamSnapshot,
  getLatestAIStreamSnapshot,
  isTerminalAIStreamEvent,
  isTerminalAIStreamStatus,
} from '@cj/api-client';

export interface AIStreamReadyEvent {
  scopeType: AIStreamScopeType;
  scopeId: string;
  snapshots?: AIStreamSnapshot[];
}

export interface AIStreamCallbacks {
  onReady?: (event: AIStreamReadyEvent) => void;
  onEvent?: (event: AIStreamEvent) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}
