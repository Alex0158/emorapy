import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptChatInvite,
  connectChatStream,
  createChatInvite,
  createChatRoom,
  declineChatInvite,
  getChatJudgmentStatus,
  getChatRoom,
  listChatMessages,
  requestChatJudgment,
  sendChatMessage,
} from './chat';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createChatRoom 應 POST /chat/rooms', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: { id: 'r1' } } } });
    const result = await createChatRoom();
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms', {
      history_visibility_mode: 'share_full_history',
    });
    expect(result).toMatchObject({ id: 'r1' });
  });

  it('getChatRoom 應 GET /chat/rooms/:id', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { room: { id: 'r2' } } } });
    const result = await getChatRoom('r2');
    expect(mockGet).toHaveBeenCalledWith('/chat/rooms/r2');
    expect(result).toMatchObject({ id: 'r2' });
  });

  it('createChatInvite 應 POST /chat/rooms/:id/invites', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { invite: { id: 'i1', invite_code: 'ABC123' } } } });
    const result = await createChatInvite('r1', { expires_in_hours: 12 });
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms/r1/invites', { expires_in_hours: 12 });
    expect(result).toMatchObject({ id: 'i1', invite_code: 'ABC123' });
  });

  it('acceptChatInvite 應 POST /chat/invites/:code/accept', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: { id: 'r3' } } } });
    const result = await acceptChatInvite('CODE01');
    expect(mockPost).toHaveBeenCalledWith('/chat/invites/CODE01/accept');
    expect(result).toMatchObject({ id: 'r3' });
  });

  it('API 路徑參數應做 encodeURIComponent', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { room: { id: 'r/a' } } } });
    await getChatRoom('r/a');
    expect(mockGet).toHaveBeenCalledWith('/chat/rooms/r%2Fa');
  });

  it('declineChatInvite 應 POST /chat/invites/:code/decline', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { invite: { id: 'i2', status: 'declined' } } } });
    const result = await declineChatInvite('CODE02');
    expect(mockPost).toHaveBeenCalledWith('/chat/invites/CODE02/decline');
    expect(result).toMatchObject({ id: 'i2', status: 'declined' });
  });

  it('listChatMessages 應返回 messages 與 nextCursor', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: { messages: [{ id: 'm1', content: 'hello' }], nextCursor: 'cursor-1' } },
    });
    const result = await listChatMessages('r1', { limit: 30 });
    expect(mockGet).toHaveBeenCalledWith('/chat/rooms/r1/messages', { params: { limit: 30 } });
    expect(result.messages).toHaveLength(1);
    expect(result.nextCursor).toBe('cursor-1');
  });

  it('sendChatMessage 應 POST /chat/rooms/:id/messages', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { message: { id: 'm2', content: 'ok' } } } });
    const result = await sendChatMessage('r1', { content: 'ok' });
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms/r1/messages', { content: 'ok' });
    expect(result).toMatchObject({ id: 'm2' });
  });

  it('requestChatJudgment 應 POST /chat/rooms/:id/request-judgment', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { roomId: 'r1', caseId: 'c1', status: 'judgment_requested' } } });
    const result = await requestChatJudgment('r1');
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms/r1/request-judgment');
    expect(result).toMatchObject({ roomId: 'r1', caseId: 'c1' });
  });

  it('getChatJudgmentStatus 應 GET /chat/rooms/:id/judgment-status', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { roomStatus: 'judgment_requested' } } });
    const result = await getChatJudgmentStatus('r1');
    expect(mockGet).toHaveBeenCalledWith('/chat/rooms/r1/judgment-status');
    expect(result).toMatchObject({ roomStatus: 'judgment_requested' });
  });

  it('connectChatStream 在串流正常結束時應觸發 onClose', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('event: ready\ndata: {"roomId":"r1"}\n\n') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const onClose = vi.fn();
    await connectChatStream('r1', {
      onClose,
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

