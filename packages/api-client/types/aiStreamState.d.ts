import type { AIStreamEvent, AIStreamPhase, AIStreamSnapshot, AIStreamStatus } from '@emorapy/contracts/ai-stream';
export type AIStreamDraftStatus = 'thinking' | 'streaming' | 'persisting' | 'cancelled';
export interface AIStreamDraft {
    streamId: string | null;
    requestId: string | null;
    text: string;
    status: AIStreamDraftStatus;
}
export interface BuildLocalDraftInput {
    text?: string | null;
    status?: AIStreamDraftStatus | null;
    streamId?: string | null;
    requestId?: string | null;
}
export interface DraftMappingOptions {
    keepCancelled?: boolean;
}
export declare function appendUniquePhase(history: AIStreamPhase[], phase?: AIStreamPhase | null): AIStreamPhase[];
export declare function buildLocalDraft(input: BuildLocalDraftInput | null | undefined): AIStreamDraft | null;
export declare function draftFromSnapshot(snapshot: AIStreamSnapshot | null | undefined, options?: DraftMappingOptions): AIStreamDraft | null;
export declare function reduceDraftWithEvent(prev: AIStreamDraft | null, event: AIStreamEvent, options?: DraftMappingOptions): AIStreamDraft | null;
export declare function isTerminalAIStreamStatus(status?: AIStreamStatus): boolean;
export declare function isTerminalAIStreamEvent(event: AIStreamEvent): boolean;
export declare function getLatestAIStreamSnapshot(snapshots?: AIStreamSnapshot[]): AIStreamSnapshot | null;
export declare function getLatestActiveAIStreamSnapshot(snapshots?: AIStreamSnapshot[]): AIStreamSnapshot | null;
//# sourceMappingURL=aiStreamState.d.ts.map