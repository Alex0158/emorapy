import type { AIStreamEvent, AIStreamSnapshot, AIStreamPhase } from '@/types/aiStream';

export type AIStreamDraftStatus = 'thinking' | 'streaming' | 'persisting' | 'cancelled';

export interface AIStreamDraft {
  streamId: string | null;
  requestId: string | null;
  text: string;
  status: AIStreamDraftStatus;
}

interface BuildLocalDraftInput {
  text?: string | null;
  status?: AIStreamDraftStatus | null;
  streamId?: string | null;
  requestId?: string | null;
}

interface DraftMappingOptions {
  keepCancelled?: boolean;
}

export function appendUniquePhase(history: AIStreamPhase[], phase?: AIStreamPhase | null): AIStreamPhase[] {
  if (!phase) return history;
  return history.includes(phase) ? history : [...history, phase];
}

export function buildLocalDraft(input: BuildLocalDraftInput | null | undefined): AIStreamDraft | null {
  if (!input?.status) return null;
  return {
    streamId: input.streamId ?? null,
    requestId: input.requestId ?? null,
    text: input.text ?? '',
    status: input.status,
  };
}

export function draftFromSnapshot(
  snapshot: AIStreamSnapshot | null | undefined,
  options: DraftMappingOptions = {}
): AIStreamDraft | null {
  if (!snapshot) return null;
  if (snapshot.status === 'persisted' || snapshot.status === 'failed') {
    return null;
  }
  if (snapshot.status === 'cancelled') {
    if (!options.keepCancelled) return null;
    return {
      streamId: snapshot.streamId,
      requestId: snapshot.requestId,
      text: snapshot.text ?? '',
      status: 'cancelled',
    };
  }
  return {
    streamId: snapshot.streamId,
    requestId: snapshot.requestId,
    text: snapshot.text ?? '',
    status:
      snapshot.status === 'streaming'
        ? 'streaming'
        : snapshot.status === 'completed'
          ? 'persisting'
          : 'thinking',
  };
}

export function reduceDraftWithEvent(
  prev: AIStreamDraft | null,
  event: AIStreamEvent,
  options: DraftMappingOptions = {}
): AIStreamDraft | null {
  if (event.eventType === 'stream.created' || event.eventType === 'stream.queued' || event.eventType === 'stream.started' || event.eventType === 'stream.phase') {
    return {
      streamId: event.streamId,
      requestId: event.requestId,
      text: prev?.streamId === event.streamId ? prev.text : '',
      status: 'thinking',
    };
  }

  if (event.eventType === 'stream.delta') {
    if (prev?.streamId && prev.streamId !== event.streamId) {
      return prev;
    }
    return {
      streamId: event.streamId,
      requestId: event.requestId,
      text: `${prev?.streamId === event.streamId ? prev.text : ''}${event.deltaText ?? ''}`,
      status: 'streaming',
    };
  }

  if (event.eventType === 'stream.completed') {
    if (prev?.streamId && prev.streamId !== event.streamId) {
      return prev;
    }
    return {
      streamId: event.streamId,
      requestId: event.requestId,
      text: event.fullText ?? prev?.text ?? '',
      status: 'persisting',
    };
  }

  if (event.eventType === 'stream.cancelled') {
    if (!options.keepCancelled) return null;
    if (prev?.streamId && prev.streamId !== event.streamId) {
      return prev;
    }
    return {
      streamId: event.streamId,
      requestId: event.requestId,
      text: event.fullText ?? prev?.text ?? '',
      status: 'cancelled',
    };
  }

  if (event.eventType === 'stream.persisted' || event.eventType === 'stream.failed') {
    return null;
  }

  return prev;
}
