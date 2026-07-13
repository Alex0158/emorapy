import { identityScopedQueryKey } from '@/src/providers/identityQueryScope';

export const chatQueryKeys = {
  actor: (epoch: number) => identityScopedQueryKey(epoch, 'm3', 'chat-actor'),
  room: (epoch: number, roomId: string | null) => (
    identityScopedQueryKey(epoch, 'm3', 'chat-room', roomId)
  ),
  messages: (epoch: number, roomId: string | null) => (
    identityScopedQueryKey(epoch, 'm3', 'chat-messages', roomId)
  ),
  channels: (epoch: number, roomId: string | null) => (
    identityScopedQueryKey(epoch, 'm3', 'chat-channels', roomId)
  ),
  contextPreference: (epoch: number, roomId: string | null) => (
    identityScopedQueryKey(epoch, 'm3', 'chat-context-preference', roomId)
  ),
  contextCapsules: (epoch: number, roomId: string | null) => (
    identityScopedQueryKey(epoch, 'm3', 'chat-context-capsules', roomId)
  ),
  analysisRequests: (epoch: number, roomId: string | null) => (
    identityScopedQueryKey(epoch, 'm3', 'chat-analysis-requests', roomId)
  ),
  judgmentStatus: (epoch: number, roomId: string | null) => (
    identityScopedQueryKey(epoch, 'm3', 'chat-judgment-status', roomId)
  ),
} as const;
