/**
 * ChatService 單元測試（權限、可見性、安全分流）
 */

const prismaMock: any = {
  chatRoom: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  chatMessage: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  chatToCaseLink: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  chatInvite: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  chatParticipant: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  case: {
    create: jest.fn(),
  },
  pairing: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
};

const sessionServiceMock = {
  getSession: jest.fn(),
};

const pairingServiceMock = {
  getPairingBySessionId: jest.fn(),
  createTempPairing: jest.fn(),
};

const aiServiceMock = {
  detectCaseType: jest.fn(),
};

const judgmentServiceMock = {
  generateJudgment: jest.fn(),
};

const lockServiceMock = {
  withLock: jest.fn(async (_key: string, fn: any) => fn()),
};

const safetyRoutingServiceMock = {
  decideRoute: jest.fn(),
};

const safetyAssessmentServiceMock = {
  recordRouteAssessment: jest.fn(),
  getActiveRiskState: jest.fn(),
};

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../src/services/session.service', () => ({
  __esModule: true,
  sessionService: sessionServiceMock,
}));

jest.mock('../../../src/services/pairing.service', () => ({
  __esModule: true,
  pairingService: pairingServiceMock,
}));

jest.mock('../../../src/services/ai.service', () => ({
  __esModule: true,
  aiService: aiServiceMock,
}));

jest.mock('../../../src/services/judgment.service', () => ({
  __esModule: true,
  judgmentService: judgmentServiceMock,
}));

jest.mock('../../../src/utils/lock', () => ({
  __esModule: true,
  lockService: lockServiceMock,
}));

jest.mock('../../../src/services/safety-routing.service', () => ({
  __esModule: true,
  safetyRoutingService: safetyRoutingServiceMock,
}));

jest.mock('../../../src/services/safety-assessment.service', () => ({
  __esModule: true,
  safetyAssessmentService: safetyAssessmentServiceMock,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: loggerMock,
}));

import { ChatService } from '../../../src/services/chat.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ChatService();
    lockServiceMock.withLock.mockImplementation(async (_key: string, fn: any) => fn());
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.chatMessage.count.mockResolvedValue(0);
    prismaMock.chatInvite.findFirst.mockResolvedValue(null);
    prismaMock.chatRoom.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.chatParticipant.findFirst.mockResolvedValue(null);
    safetyAssessmentServiceMock.recordRouteAssessment.mockResolvedValue({ id: 'assessment-1' });
    prismaMock.chatParticipant.findUnique.mockResolvedValue({
      id: 'p-a',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatParticipant.findMany.mockImplementation(async (args: any) => ([
      {
        id: 'p-a',
        room_id: args?.where?.room_id ?? 'room-default',
        role_in_room: 'roleA',
        is_active: true,
        user_id: 'u1',
      },
    ]));
    prismaMock.chatRoom.findUnique.mockResolvedValue({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    safetyAssessmentServiceMock.getActiveRiskState.mockResolvedValue(null);
  });

  it('listMessages 無訊息時應返回 messages 空陣列與 nextCursor null（F07 邊界）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      ],
    });
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([]);

    const result = await service.listMessages('room-1', { userId: 'u1' }, { limit: 20 });

    expect(result.messages).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('getJudgmentStatus 應套用 case active safety state 隱藏責任比例', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      owner_user_id: 'u1',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }],
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-1',
      case: {
        id: 'case-1',
        status: 'completed',
        mode: 'remote',
        submitted_at: null,
        completed_at: null,
      },
      judgment: {
        id: 'j1',
        created_at: new Date('2026-05-03T00:00:00.000Z'),
        plaintiff_ratio: 60,
        defendant_ratio: 40,
      },
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({ status: 'judgment_completed' });
    safetyAssessmentServiceMock.getActiveRiskState.mockResolvedValueOnce({
      id: 'state-1',
      judgment_route: 'safety_support',
      can_show_responsibility_ratio: false,
      reasons: ['active case risk'],
    });

    const result = await service.getJudgmentStatus('room-1', { userId: 'u1' });

    expect(result.latestLink?.judgment).toMatchObject({
      judgment_route: 'safety_support',
      responsibility_ratio_visibility: {
        can_show: false,
        reason: '安全支持路由不得展示責任比例，避免把安全風險對稱化',
      },
    });
  });

  it('listMessages: roleB + share_from_join_time 應只取加入後訊息', async () => {
    const joinedAt = new Date('2026-02-25T10:00:00.000Z');
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      status: 'group_active',
      history_visibility_mode: 'share_from_join_time',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true, joined_at: new Date('2026-02-25T09:00:00.000Z') },
        { id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true, joined_at: joinedAt },
      ],
    });
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([]);

    await service.listMessages('room-1', { userId: 'u2' }, { limit: 20 });

    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          room_id: 'room-1',
          AND: expect.arrayContaining([
            expect.objectContaining({
              visibility_scope: { in: ['all', 'summary_only'] },
            }),
            expect.objectContaining({
              created_at: { gte: joinedAt },
            }),
          ]),
        }),
      })
    );
  });

  it('requestJudgment: roleB 直接觸發應被拒絕', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-2',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });

    await expect(service.requestJudgment('room-2', { userId: 'u2' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('requestJudgment: archived 房間應拒絕觸發', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-archived',
      status: 'archived',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'archived',
      history_visibility_mode: 'share_summary_only',
    });

    await expect(service.requestJudgment('room-archived', { userId: 'u1' })).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('requestJudgment: crisis_support 應先中止並寫 safety_notice', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-3',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-a', room_id: 'room-3', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      { id: 'p-ai', room_id: 'room-3', role_in_room: 'aiMediator', user_id: null, is_active: true },
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm1',
        content: '我最近真的很痛苦，想傷害自己',
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'crisis_support',
      reasons: ['hit'],
      detectedFlags: ['自傷/自殺風險'],
    });
    prismaMock.chatMessage.create.mockResolvedValueOnce({ id: 'safety-msg-1' });

    await expect(service.requestJudgment('room-3', { userId: 'u1' })).rejects.toMatchObject({
      code: 'CASE_NOT_READY',
    });

    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          room_id: 'room-3',
          message_type: 'safety_notice',
          safety_flag: true,
        }),
      })
    );
    expect(safetyAssessmentServiceMock.recordRouteAssessment).toHaveBeenCalledWith(
      { subjectType: 'chat_room', subjectId: 'room-3' },
      'crisis_support',
      expect.objectContaining({
        source: 'chat_judgment_policy',
        reasons: ['hit'],
        assessedByUserId: 'u1',
        updateActiveRiskState: true,
        metadata: expect.objectContaining({
          outcome: 'blocked',
          room_id: 'room-3',
          case_id: null,
          link_id: null,
          judgment_id: null,
          detected_flags: ['自傷/自殺風險'],
          source_message_range: expect.objectContaining({
            first_message_id: 'm1',
            last_message_id: 'm1',
            total_user_messages: 1,
          }),
        }),
      })
    );
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('acceptInvite: 指定邀請人不匹配應拒絕', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-1',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: 'u-target',
      room_id: 'room-4',
      room: {
        id: 'room-4',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });

    await expect(service.acceptInvite('ABC123', { userId: 'u-other' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(prismaMock.chatInvite.updateMany).not.toHaveBeenCalled();
  });

  it('acceptInvite: 競態下 updateMany=0 應回 INVALID_CODE', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-2',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-5',
      room: {
        id: 'room-5',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.acceptInvite('ABC124', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'INVALID_CODE',
    });
  });

  it('acceptInvite: 房間非 invite_pending 應拒絕', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-x',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-x',
      room: {
        id: 'room-x',
        status: 'group_active',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });

    await expect(service.acceptInvite('ABC888', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('declineInvite: 成功拒絕後無 pending 應回退房間狀態', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-3',
      room_id: 'room-7',
      status: 'pending',
      invited_user_id: 'u-b',
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-7', status: 'invite_pending' },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatInvite.count.mockResolvedValueOnce(0);
    prismaMock.chatInvite.findUnique.mockResolvedValueOnce({
      id: 'inv-3',
      room_id: 'room-7',
      status: 'declined',
    });

    const invite = await service.declineInvite('ABC125', { userId: 'u-b' });
    expect(invite?.status).toBe('declined');
    expect(prismaMock.chatRoom.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'room-7' }),
        data: { status: 'solo_active' },
      })
    );
  });

  it('declineInvite: 房間非 invite_pending 應拒絕', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-y',
      room_id: 'room-y',
      status: 'pending',
      invited_user_id: 'u-b',
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-y', status: 'group_active' },
    });

    await expect(service.declineInvite('ABC777', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('declineInvite: 指定邀請不可由匿名 session 處理', async () => {
    const sessionId = 'guest_1700000000002_cdefghijklmnopq';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: sessionId });
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-spec-anon',
      room_id: 'room-spec-anon',
      status: 'pending',
      invited_user_id: 'u-target',
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-spec-anon', status: 'invite_pending', owner_user_id: 'u-owner' },
    });

    await expect(service.declineInvite('ABC778', { sessionId })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('declineInvite: 公開邀請僅房主可撤回（第三方應拒絕）', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-z',
      room_id: 'room-z',
      status: 'pending',
      invited_user_id: null,
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-z', status: 'invite_pending', owner_user_id: 'u-owner' },
    });

    await expect(service.declineInvite('ABC776', { userId: 'u-other' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('declineInvite: 公開邀請房主可撤回', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-owner',
      room_id: 'room-owner',
      status: 'pending',
      invited_user_id: null,
      expires_at: new Date(Date.now() + 60000),
      room: { id: 'room-owner', status: 'invite_pending', owner_user_id: 'u-owner' },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatInvite.count.mockResolvedValueOnce(0);
    prismaMock.chatInvite.findUnique.mockResolvedValueOnce({
      id: 'inv-owner',
      room_id: 'room-owner',
      status: 'revoked',
    });

    const invite = await service.declineInvite('ABC775', { userId: 'u-owner' });
    expect(invite?.status).toBe('revoked');
    expect(prismaMock.chatInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'revoked',
          invited_user_id: null,
        }),
      })
    );
  });

  it('declineInvite: 匿名房主（session）可撤回公開邀請', async () => {
    const ownerSessionId = 'guest_1700000000000_abcdefghijklmnop';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: ownerSessionId });
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-anon-owner',
      room_id: 'room-anon-owner',
      status: 'pending',
      invited_user_id: null,
      expires_at: new Date(Date.now() + 60000),
      room: {
        id: 'room-anon-owner',
        status: 'invite_pending',
        owner_user_id: null,
        session_id: ownerSessionId,
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatInvite.count.mockResolvedValueOnce(0);
    prismaMock.chatInvite.findUnique.mockResolvedValueOnce({
      id: 'inv-anon-owner',
      room_id: 'room-anon-owner',
      status: 'revoked',
    });

    const invite = await service.declineInvite('ABC774', { sessionId: ownerSessionId });
    expect(invite?.status).toBe('revoked');
  });

  it('declineInvite: 匿名非房主（session）不可撤回公開邀請', async () => {
    const ownerSessionId = 'guest_1700000000000_abcdefghijklmnop';
    const otherSessionId = 'guest_1700000000001_bcdefghijklmnop';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: otherSessionId });
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-anon-other',
      room_id: 'room-anon-other',
      status: 'pending',
      invited_user_id: null,
      expires_at: new Date(Date.now() + 60000),
      room: {
        id: 'room-anon-other',
        status: 'invite_pending',
        owner_user_id: null,
        session_id: ownerSessionId,
      },
    });

    await expect(service.declineInvite('ABC773', { sessionId: otherSessionId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('acceptInvite: 房間狀態 CAS 失敗時應拒絕（避免競態）', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-cas-0',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-cas-0',
      room: {
        id: 'room-cas-0',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.acceptInvite('CAS000', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('acceptInvite: 交易內若已存在其他 active roleB 應拒絕（避免覆寫）', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-roleb-conflict',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-roleb-conflict',
      room: {
        id: 'room-roleb-conflict',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatParticipant.findFirst.mockResolvedValueOnce({
      id: 'p-roleb-existing',
      room_id: 'room-roleb-conflict',
      role_in_room: 'roleB',
      is_active: true,
      user_id: 'u-other',
    });

    await expect(service.acceptInvite('CAS001', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prismaMock.chatParticipant.create).not.toHaveBeenCalled();
  });

  it('acceptInvite: 交易內找到歷史 roleB 記錄時應復用而非新建', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-roleb-reuse',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-roleb-reuse',
      room: {
        id: 'room-roleb-reuse',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatParticipant.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'p-roleb-old',
        room_id: 'room-roleb-reuse',
        role_in_room: 'roleB',
        is_active: false,
        user_id: null,
      });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      id: 'room-roleb-reuse',
      status: 'group_active',
      participants: [],
    });

    const room = await service.acceptInvite('CAS002', { userId: 'u-b' });
    expect(room.status).toBe('group_active');
    expect(prismaMock.chatParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-roleb-old' },
      })
    );
    expect(prismaMock.chatParticipant.create).not.toHaveBeenCalled();
  });

  it('acceptInvite: 命中資料庫唯一鍵衝突時應映射為 CONFLICT', async () => {
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-roleb-p2002',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      invited_user_id: null,
      room_id: 'room-roleb-p2002',
      room: {
        id: 'room-roleb-p2002',
        status: 'invite_pending',
        owner_user_id: 'u-owner',
        participants: [],
      },
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.chatParticipant.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const p2002Error = Object.assign(new Error('unique conflict'), { code: 'P2002' });
    prismaMock.chatParticipant.create.mockRejectedValueOnce(p2002Error);

    await expect(service.acceptInvite('CAS003', { userId: 'u-b' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('requestJudgment: completed 且短時間重試應命中冪等返回既有 link', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-8',
      status: 'judgment_completed',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_completed',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a',
      room_id: 'room-8',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-8',
      room_id: 'room-8',
      case_id: 'case-8',
      created_at: new Date(),
      judgment: { id: 'judgment-8' },
    });

    const result = await service.requestJudgment('room-8', { userId: 'u1' });
    expect(result).toMatchObject({
      roomId: 'room-8',
      caseId: 'case-8',
      judgmentId: 'judgment-8',
      linkId: 'link-8',
      status: 'judgment_completed',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: completed 且無新訊息（超過短窗）仍應復用既有結果', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-8b',
      status: 'judgment_completed',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_completed',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a',
      room_id: 'room-8b',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-8b',
      room_id: 'room-8b',
      case_id: 'case-8b',
      created_at: new Date(Date.now() - 10 * 60_000),
      judgment: { id: 'judgment-8b' },
      case: { id: 'case-8b', status: 'completed' },
    });
    prismaMock.chatMessage.count.mockResolvedValueOnce(0);

    const result = await service.requestJudgment('room-8b', { userId: 'u1' });
    expect(result).toMatchObject({
      roomId: 'room-8b',
      caseId: 'case-8b',
      judgmentId: 'judgment-8b',
      linkId: 'link-8b',
      status: 'judgment_completed',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: completed 但有新訊息（即使短窗內）應進入新流程', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-8c',
      status: 'judgment_completed',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-8c',
      room_id: 'room-8c',
      case_id: 'case-8c-old',
      created_at: new Date(Date.now() - 5_000),
      judgment: { id: 'judgment-8c-old' },
      case: { id: 'case-8c-old', status: 'completed' },
    });
    prismaMock.chatMessage.count.mockResolvedValueOnce(1);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-new-1',
        content: '我還有新補充，昨天又發生一次',
        created_at: new Date('2026-02-26T11:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.create.mockResolvedValueOnce({ id: 'pair-8c' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-8c', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-8c-new' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-8c-new' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-8c-new' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-8c-new', judgment_id: 'judgment-8c-new' });

    const result = await service.requestJudgment('room-8c', { userId: 'u1' });

    expect(result.caseId).toBe('case-8c-new');
    expect(prismaMock.case.create).toHaveBeenCalled();
  });

  it('requestJudgment: 單人登入房應復用 owner 既有 active/pending normal pairing', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-solo-pairing-reuse',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a',
      room_id: 'room-solo-pairing-reuse',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce(null);
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-a', room_id: 'room-solo-pairing-reuse', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      { id: 'p-ai', room_id: 'room-solo-pairing-reuse', role_in_room: 'aiMediator', user_id: null, is_active: true },
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      { id: 'm-a', content: '我希望把這段聊天整理成判決建議', created_at: new Date(), sender_participant: { role_in_room: 'roleA' } },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.findFirst.mockResolvedValueOnce({
      id: 'pair-solo-existing',
      user1_id: 'u1',
      user2_id: 'u2',
      status: 'active',
    });
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-solo-reuse' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-solo-reuse' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-solo-reuse' });
    prismaMock.chatRoom.update.mockResolvedValueOnce({ id: 'room-solo-pairing-reuse', status: 'judgment_completed' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-solo-reuse', judgment_id: 'judgment-solo-reuse' });

    const result = await service.requestJudgment('room-solo-pairing-reuse', { userId: 'u1' });

    expect(result.caseId).toBe('case-solo-reuse');
    expect(prismaMock.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pairing_id: 'pair-solo-existing' }),
      })
    );
    expect(prismaMock.pairing.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 單人 live pairing 建立遇 P2002 時應復查並復用', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-solo-pairing-race',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a',
      room_id: 'room-solo-pairing-race',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce(null);
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-a', room_id: 'room-solo-pairing-race', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      { id: 'p-ai', room_id: 'room-solo-pairing-race', role_in_room: 'aiMediator', user_id: null, is_active: true },
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      { id: 'm-a', content: '我希望把這段聊天整理成判決建議', created_at: new Date(), sender_participant: { role_in_room: 'roleA' } },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'pair-solo-raced', user1_id: 'u1', user2_id: 'u2', status: 'active' });
    prismaMock.pairing.create.mockRejectedValueOnce(Object.assign(new Error('unique conflict'), { code: 'P2002' }));
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-solo-race' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-solo-race' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-solo-race' });
    prismaMock.chatRoom.update.mockResolvedValueOnce({ id: 'room-solo-pairing-race', status: 'judgment_completed' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-solo-race', judgment_id: 'judgment-solo-race' });

    const result = await service.requestJudgment('room-solo-pairing-race', { userId: 'u1' });

    expect(result.caseId).toBe('case-solo-race');
    expect(prismaMock.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pairing_id: 'pair-solo-raced' }),
      })
    );
  });

  it('requestJudgment: judgment_failed 時應復用既有 case/link 重試，不重複建案', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-retry',
      status: 'judgment_failed',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_failed',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a',
      room_id: 'room-retry',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-retry',
      room_id: 'room-retry',
      case_id: 'case-retry',
      created_at: new Date(Date.now() - 30_000),
      judgment: null,
      case: { id: 'case-retry', status: 'submitted' },
    });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-retry', status: 'judgment_requested' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-retry' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-retry', judgment_id: 'judgment-retry' });

    const result = await service.requestJudgment('room-retry', { userId: 'u1' });

    expect(result).toEqual({
      roomId: 'room-retry',
      caseId: 'case-retry',
      judgmentId: 'judgment-retry',
      linkId: 'link-retry',
      status: 'judgment_completed',
    });
    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledWith('case-retry', {
      userId: 'u1',
      sessionId: undefined,
      locale: undefined,
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: judgment_failed 但有新訊息時應走新建案流程', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-retry-new',
      status: 'judgment_failed',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      session_id: null,
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-old',
      room_id: 'room-retry-new',
      case_id: 'case-old',
      created_at: new Date(Date.now() - 60_000),
      judgment: null,
      case: { id: 'case-old', status: 'judgment_failed' },
    });
    prismaMock.chatMessage.count.mockResolvedValueOnce(2);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      { id: 'm-a', content: '昨天我們又吵了', sender_participant: { role_in_room: 'roleA' } },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.create.mockResolvedValueOnce({ id: 'pair-new' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-retry-new', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-new' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-new' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-new' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-new', judgment_id: 'judgment-new' });

    const result = await service.requestJudgment('room-retry-new', { userId: 'u1' });
    expect(result.caseId).toBe('case-new');
    expect(prismaMock.case.create).toHaveBeenCalled();
  });

  it('requestJudgment: safety_support 應寫入 pre_route 與分層分析到 snapshot', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-6',
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-a', room_id: 'room-6', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      { id: 'p-b', room_id: 'room-6', role_in_room: 'roleB', user_id: 'u2', is_active: true },
      { id: 'p-ai', room_id: 'room-6', role_in_room: 'aiMediator', user_id: null, is_active: true },
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm1',
        content: '昨天你對我大吼，我真的很害怕也很難過',
        created_at: new Date('2026-02-26T10:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
      {
        id: 'm2',
        content: '我承認那天語氣很差，但我當時也很焦慮',
        created_at: new Date('2026-02-26T10:05:00.000Z'),
        sender_participant: { role_in_room: 'roleB' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'safety_support',
      reasons: ['IPV-like signal'],
      detectedFlags: ['控制/暴力/威脅風險'],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('情感需求衝突');
    prismaMock.pairing.findFirst.mockResolvedValueOnce({
      id: 'pair-1',
      status: 'active',
    });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-6', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-6' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-6' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-6' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-6', judgment_id: 'judgment-6' });
    prismaMock.chatMessage.create.mockResolvedValue({ id: 'notice-6' });

    const result = await service.requestJudgment('room-6', { userId: 'u1' }, {
      participantConsent: { roleBIncludedMessages: true },
    });

    expect(result.caseId).toBe('case-6');
    expect(prismaMock.chatToCaseLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversion_snapshot: expect.objectContaining({
            pre_route: 'safety_support',
            pre_route_flags: expect.arrayContaining(['控制/暴力/威脅風險']),
            safety_gate: expect.objectContaining({
              can_request_chat_judgment: true,
              should_create_safety_notice: true,
              reasons: ['IPV-like signal'],
            }),
            source_message_range: expect.objectContaining({
              first_message_id: 'm1',
              last_message_id: 'm2',
              total_user_messages: 2,
            }),
            emotion_highlights: expect.any(Array),
            fact_highlights: expect.any(Array),
            information_gaps: expect.any(Array),
            transform_confidence: expect.stringMatching(/low|medium|high/),
            layer_usability: expect.objectContaining({
              emotion: expect.objectContaining({
                level: expect.stringMatching(/insufficient|partial|usable|rich/),
              }),
              fact: expect.objectContaining({
                level: expect.stringMatching(/insufficient|partial|usable|rich/),
              }),
              interaction: expect.objectContaining({
                level: expect.stringMatching(/insufficient|partial|usable|rich/),
              }),
            }),
            gap_details: expect.any(Array),
            signal_stats: expect.objectContaining({
              totalUserMessages: 2,
              roleAMessages: 1,
              roleBMessages: 1,
            }),
            participant_consent: expect.objectContaining({
              role_b_messages_included: true,
              role_b_inclusion_consent_asserted: true,
              role_b_consent_required: true,
              role_b_participant_id: 'p-b',
              role_b_user_id: 'u2',
            }),
            conversion_version: 'v2-layered-2026-02',
          }),
        }),
      })
    );
    expect(safetyAssessmentServiceMock.recordRouteAssessment).toHaveBeenCalledWith(
      { subjectType: 'chat_room', subjectId: 'room-6' },
      'safety_support',
      expect.objectContaining({
        source: 'chat_judgment_policy',
        reasons: ['IPV-like signal'],
        assessedByUserId: 'u1',
        updateActiveRiskState: true,
        metadata: expect.objectContaining({
          outcome: 'judgment_completed',
          room_id: 'room-6',
          case_id: 'case-6',
          link_id: 'link-6',
          judgment_id: 'judgment-6',
          detected_flags: ['控制/暴力/威脅風險'],
          participant_consent: expect.objectContaining({
            role_b_messages_included: true,
            role_b_inclusion_consent_asserted: true,
            role_b_consent_required: true,
            role_b_participant_id: 'p-b',
            role_b_user_id: 'u2',
          }),
          layer_summary: expect.objectContaining({
            role_a_messages: 1,
            role_b_messages: 1,
          }),
        }),
      })
    );
  });

  it('requestJudgment: 納入 B 方訊息時必須先帶 B 方明示同意', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-b-consent',
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-a', room_id: 'room-b-consent', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      { id: 'p-b', room_id: 'room-b-consent', role_in_room: 'roleB', user_id: 'u2', is_active: true },
      { id: 'p-ai', room_id: 'room-b-consent', role_in_room: 'aiMediator', user_id: null, is_active: true },
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-a-consent',
        content: '我想整理我們的對話',
        created_at: new Date('2026-02-26T10:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
      {
        id: 'm-b-consent',
        content: '我也說一下我的看法',
        created_at: new Date('2026-02-26T10:05:00.000Z'),
        sender_participant: { role_in_room: 'roleB' },
      },
    ]);

    await expect(service.requestJudgment('room-b-consent', { userId: 'u1' })).rejects.toMatchObject({
      code: 'CASE_NOT_READY',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(prismaMock.chatToCaseLink.create).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('requestJudgment: 單邊陳述時應標記 interaction/fact 高風險缺口', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-gap',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-a', room_id: 'room-gap', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      { id: 'p-ai', room_id: 'room-gap', role_in_room: 'aiMediator', user_id: null, is_active: true },
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-gap-1',
        content: '我真的很難過',
        created_at: new Date('2026-02-26T15:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.create.mockResolvedValueOnce({ id: 'pair-gap' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-gap', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-gap' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-gap' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-gap' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-gap', judgment_id: 'judgment-gap' });
    safetyAssessmentServiceMock.recordRouteAssessment.mockRejectedValueOnce(new Error('missing safety table'));

    await service.requestJudgment('room-gap', { userId: 'u1' });

    expect(prismaMock.chatToCaseLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversion_snapshot: expect.objectContaining({
            layer_usability: expect.objectContaining({
              interaction: expect.objectContaining({ level: 'insufficient' }),
            }),
            gap_details: expect.arrayContaining([
              expect.objectContaining({ code: 'MISSING_ROLE_B_STATEMENT', severity: 'high' }),
              expect.objectContaining({ code: 'INSUFFICIENT_EVENT_CHAIN', severity: 'high' }),
            ]),
          }),
        }),
      })
    );
    expect(safetyAssessmentServiceMock.recordRouteAssessment).toHaveBeenCalledWith(
      { subjectType: 'chat_room', subjectId: 'room-gap' },
      'standard',
      expect.objectContaining({
        source: 'chat_judgment_policy',
        updateActiveRiskState: false,
        metadata: expect.objectContaining({
          outcome: 'judgment_completed',
          case_id: 'case-gap',
          link_id: 'link-gap',
          judgment_id: 'judgment-gap',
        }),
      })
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Chat route safety assessment persistence failed',
      expect.objectContaining({
        roomId: 'room-gap',
        route: 'standard',
        outcome: 'judgment_completed',
      })
    );
  });

  it('requestJudgment: 英文訊息也應被分層規則辨識（避免語言偏差）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-en',
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-a', room_id: 'room-en', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      { id: 'p-b', room_id: 'room-en', role_in_room: 'roleB', user_id: 'u2', is_active: true },
      { id: 'p-ai', room_id: 'room-en', role_in_room: 'aiMediator', user_id: null, is_active: true },
    ]);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-en-1',
        content:
          'Yesterday at 9pm you said I was overreacting, I felt sad and anxious because this happened again. I need to feel understood.',
        created_at: new Date('2026-02-27T09:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
      {
        id: 'm-en-2',
        content: 'I did ignore your message. Last week we argued again after work.',
        created_at: new Date('2026-02-27T09:05:00.000Z'),
        sender_participant: { role_in_room: 'roleB' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.findFirst.mockResolvedValueOnce({
      id: 'pair-en',
      status: 'active',
    });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-en', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-en' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-en' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-en' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({ id: 'link-en', judgment_id: 'judgment-en' });

    await service.requestJudgment('room-en', { userId: 'u1' }, {
      locale: 'en-US',
      participantConsent: { roleBIncludedMessages: true },
    });

    const createCallArg = prismaMock.chatToCaseLink.create.mock.calls[0][0];
    const snapshot = createCallArg.data.conversion_snapshot;
    expect(snapshot.signal_stats.emotionSignalCount).toBeGreaterThan(0);
    expect(snapshot.signal_stats.needSignalCount).toBeGreaterThan(0);
    expect(snapshot.signal_stats.timeSignalCount).toBeGreaterThan(0);
    expect(snapshot.signal_stats.eventSignalCount).toBeGreaterThan(0);
    expect(snapshot.signal_stats.causalSignalCount).toBeGreaterThan(0);
    expect(snapshot.layer_usability.emotion.level).toMatch(/partial|usable|rich/);
    expect(snapshot.layer_usability.fact.level).toMatch(/partial|usable|rich/);
    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledWith('case-en', {
      userId: 'u1',
      sessionId: undefined,
      locale: 'en-US',
    });
    expect(snapshot.gap_details).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_EMOTION_SIGNAL' }),
        expect.objectContaining({ code: 'MISSING_TIME_ANCHOR' }),
        expect.objectContaining({ code: 'MISSING_CAUSAL_LINK' }),
      ])
    );
  });

  it('requestJudgment: 完成後重複觸發（2分鐘內）應走冪等返回', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-7',
      status: 'judgment_completed',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_completed',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a',
      room_id: 'room-7',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-7',
      room_id: 'room-7',
      case_id: 'case-7',
      created_at: new Date(Date.now() - 10_000),
      judgment: { id: 'judgment-7' },
    });

    const result = await service.requestJudgment('room-7', { userId: 'u1' });

    expect(result).toEqual({
      roomId: 'room-7',
      caseId: 'case-7',
      judgmentId: 'judgment-7',
      linkId: 'link-7',
      status: 'judgment_completed',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
    expect(judgmentServiceMock.generateJudgment).not.toHaveBeenCalled();
  });

  it('createInvite: 匿名房主 canonical session 匹配時可建立邀請', async () => {
    const ownerSessionId = 'guest_1700000000000_abcdefghijklmnop';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: ownerSessionId });
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-anon-owner',
      status: 'solo_active',
      owner_user_id: null,
      session_id: ownerSessionId,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.chatInvite.create.mockResolvedValueOnce({
      id: 'inv-anon-owner',
      room_id: 'room-anon-owner',
      status: 'pending',
      invite_code: 'ANON123',
    });

    const invite = await service.createInvite(
      'room-anon-owner',
      { sessionId: ownerSessionId },
      { expiresInHours: 12 }
    );

    expect(invite.invite_code).toBe('ANON123');
  });

  it('createInvite: 匿名房主 canonical session 不匹配時應拒絕', async () => {
    const otherSessionId = 'guest_1700000000001_bcdefghijklmnop';
    sessionServiceMock.getSession.mockResolvedValueOnce({ id: otherSessionId });
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createInvite('room-anon-owner', { sessionId: otherSessionId }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(prismaMock.chatRoom.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'room-anon-owner',
          session_id: otherSessionId,
        }),
      })
    );
  });

  it('createInvite: 匿名 actor 缺少 session 時應拒絕', async () => {
    await expect(
      service.createInvite('room-anon-owner', {}, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'SESSION_ID_REQUIRED',
    });
  });

  it('createInvite: 房間已有 active roleB 應拒絕重複邀請', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-8',
      status: 'group_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-b', role_in_room: 'roleB', user_id: 'u2', is_active: true },
      ],
    });

    await expect(
      service.createInvite('room-8', { userId: 'u1' }, { expiresInHours: 24 })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('createInvite: 發新邀請前應回收同房 pending 邀請', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-9',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      ],
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 2 });
    prismaMock.chatInvite.create.mockResolvedValueOnce({
      id: 'inv-new',
      room_id: 'room-9',
      status: 'pending',
      invite_code: 'ABC999',
    });

    const invite = await service.createInvite('room-9', { userId: 'u1' }, { expiresInHours: 12 });

    expect(invite.id).toBe('inv-new');
    expect(prismaMock.chatInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          room_id: 'room-9',
          status: 'pending',
        }),
        data: expect.objectContaining({
          status: 'revoked',
        }),
      })
    );
  });

  it('createInvite: 同房間短時間重複邀請應被限流', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-invite-cooldown',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      ],
    });
    prismaMock.chatInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-recent',
      created_at: new Date(),
    });

    await expect(
      service.createInvite('room-invite-cooldown', { userId: 'u1' }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
    });
    expect(prismaMock.chatInvite.create).not.toHaveBeenCalled();
  });

  it('createInvite: B 方剛拒絕邀請後應禁止 A 立即再邀', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-declined-cooldown',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      ],
    });
    prismaMock.chatInvite.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'inv-declined',
        responded_at: new Date(Date.now() - 60_000),
      });

    await expect(
      service.createInvite('room-declined-cooldown', { userId: 'u1' }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.chatInvite.create).not.toHaveBeenCalled();
  });

  it('createInvite: 房間狀態 CAS 失敗時應拒絕（避免競態）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-cas-invite',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }],
    });
    prismaMock.chatInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.createInvite('room-cas-invite', { userId: 'u1' }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'CASE_NOT_EDITABLE',
    });
  });

  it('createInvite: 交易內若已出現 active roleB 應拒絕（避免併發誤邀請）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-tx-race',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }],
    });
    prismaMock.chatParticipant.findFirst.mockResolvedValueOnce({
      id: 'p-b',
      room_id: 'room-tx-race',
      role_in_room: 'roleB',
      is_active: true,
    });

    await expect(
      service.createInvite('room-tx-race', { userId: 'u1' }, { expiresInHours: 12 })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('createInvite: 邀請碼唯一鍵衝突時應自動重試並成功', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-code-retry',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }],
    });
    prismaMock.chatInvite.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValue({ count: 1 });
    const p2002Error = Object.assign(new Error('unique conflict'), { code: 'P2002' });
    prismaMock.chatInvite.create
      .mockRejectedValueOnce(p2002Error)
      .mockResolvedValueOnce({
        id: 'inv-code-retry',
        room_id: 'room-code-retry',
        status: 'pending',
        invite_code: 'ABC777',
      });

    const invite = await service.createInvite('room-code-retry', { userId: 'u1' }, { expiresInHours: 12 });
    expect(invite.id).toBe('inv-code-retry');
    expect(prismaMock.chatInvite.create).toHaveBeenCalledTimes(2);
  });

  it('requestJudgment: 同房間並發請求應共用 in-flight 任務（僅建一次案）', async () => {
    const room = {
      id: 'room-concurrent',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    };
    prismaMock.chatRoom.findFirst.mockResolvedValue(room);
    prismaMock.chatToCaseLink.findFirst.mockResolvedValue(null);
    prismaMock.chatMessage.count.mockResolvedValue(0);
    prismaMock.chatMessage.findMany.mockResolvedValue([
      {
        id: 'm-c1',
        content: '昨天我們又吵架，我希望有一個明確建議。',
        created_at: new Date('2026-02-26T12:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValue({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValue('其他衝突');
    prismaMock.pairing.create.mockResolvedValue({ id: 'pair-c' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-concurrent', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValue({ id: 'case-c' });
    prismaMock.chatToCaseLink.create.mockResolvedValue({ id: 'link-c' });
    judgmentServiceMock.generateJudgment.mockResolvedValue({ id: 'judgment-c' });
    prismaMock.chatToCaseLink.update.mockResolvedValue({ id: 'link-c', judgment_id: 'judgment-c' });

    const [r1, r2] = await Promise.all([
      service.requestJudgment('room-concurrent', { userId: 'u1' }),
      service.requestJudgment('room-concurrent', { userId: 'u1' }),
    ]);

    expect(r1.caseId).toBe('case-c');
    expect(r2.caseId).toBe('case-c');
    expect(prismaMock.case.create).toHaveBeenCalledTimes(1);
    expect(judgmentServiceMock.generateJudgment).toHaveBeenCalledTimes(1);
  });

  it('requestJudgment: in-flight 存在時未授權用戶不可搭車獲取結果', async () => {
    let resolveJudgment: ((value: { id: string }) => void) | undefined;
    const judgmentPromise = new Promise<{ id: string }>((resolve) => {
      resolveJudgment = resolve;
    });

    const roomForOwner = {
      id: 'room-race-auth',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-ai', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    };

    prismaMock.chatRoom.findFirst.mockImplementation(async (args: any) => {
      const isOwnerQuery = Boolean(
        args?.where?.OR?.some?.((c: any) => c.owner_user_id === 'u1') ||
        args?.where?.owner_user_id === 'u1'
      );
      if (isOwnerQuery) return roomForOwner;
      return null;
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValue(null);
    prismaMock.chatMessage.count.mockResolvedValue(0);
    prismaMock.chatMessage.findMany.mockResolvedValue([
      {
        id: 'm-r1',
        content: '我希望重新判決',
        created_at: new Date('2026-02-26T12:30:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValue({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValue('其他衝突');
    prismaMock.pairing.create.mockResolvedValue({ id: 'pair-race-auth' });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-race-auth', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValue({ id: 'case-race-auth' });
    prismaMock.chatToCaseLink.create.mockResolvedValue({ id: 'link-race-auth' });
    judgmentServiceMock.generateJudgment.mockReturnValue(judgmentPromise);
    prismaMock.chatToCaseLink.update.mockResolvedValue({ id: 'link-race-auth', judgment_id: 'judgment-race-auth' });

    const ownerRequest = service.requestJudgment('room-race-auth', { userId: 'u1' });
    const unauthorizedRequest = service.requestJudgment('room-race-auth', { userId: 'uX' });

    await expect(unauthorizedRequest).rejects.toMatchObject({ code: 'FORBIDDEN' });

    if (resolveJudgment) {
      resolveJudgment({ id: 'judgment-race-auth' });
    }
    const ownerResult = await ownerRequest;
    expect(ownerResult.caseId).toBe('case-race-auth');
  });

  it('requestJudgment: 鎖內若狀態已更新為 completed 應走冪等返回，避免重複建案', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-stale',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a', role_in_room: 'roleA', user_id: 'u1', is_active: true }],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'judgment_completed',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a',
      room_id: 'room-stale',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce({
      id: 'link-stale',
      room_id: 'room-stale',
      case_id: 'case-stale',
      created_at: new Date(Date.now() - 30_000),
      judgment: { id: 'judgment-stale' },
      case: { id: 'case-stale', status: 'completed' },
    });
    prismaMock.chatMessage.count.mockResolvedValueOnce(0);

    const result = await service.requestJudgment('room-stale', { userId: 'u1' });
    expect(result).toMatchObject({
      roomId: 'room-stale',
      caseId: 'case-stale',
      judgmentId: 'judgment-stale',
      linkId: 'link-stale',
      status: 'judgment_completed',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 鎖內若觸發者已失效應拒絕（避免排隊期間權限漂移）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-participant-stale',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a-stale', role_in_room: 'roleA', user_id: 'u1', is_active: true }],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a-stale',
      room_id: 'room-participant-stale',
      role_in_room: 'roleA',
      is_active: false,
    });

    await expect(service.requestJudgment('room-participant-stale', { userId: 'u1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 鎖內若觸發者房間不匹配應拒絕（避免極端資料漂移越權）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-participant-room-mismatch',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a-mismatch', role_in_room: 'roleA', user_id: 'u1', is_active: true }],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a-mismatch',
      room_id: 'room-other',
      role_in_room: 'roleA',
      is_active: true,
    });

    await expect(service.requestJudgment('room-participant-room-mismatch', { userId: 'u1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 鎖內無 active participants 時應拒絕（避免使用鎖外舊快照）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-no-active',
      status: 'solo_active',
      owner_user_id: 'u1',
      history_visibility_mode: 'share_summary_only',
      participants: [{ id: 'p-a-no-active', role_in_room: 'roleA', user_id: 'u1', is_active: true }],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'solo_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a-no-active',
      room_id: 'room-no-active',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([]);

    await expect(service.requestJudgment('room-no-active', { userId: 'u1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('requestJudgment: 鎖內 participants 已更新時應採用新快照（含 roleB）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-participants-refresh',
      status: 'solo_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a-old', role_in_room: 'roleA', user_id: 'u1', is_active: true },
        { id: 'p-ai-old', role_in_room: 'aiMediator', user_id: null, is_active: true },
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'group_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a-old',
      room_id: 'room-participants-refresh',
      role_in_room: 'roleA',
      is_active: true,
      user_id: 'u1',
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-a-new', room_id: 'room-participants-refresh', role_in_room: 'roleA', is_active: true, user_id: 'u1' },
      { id: 'p-b-new', room_id: 'room-participants-refresh', role_in_room: 'roleB', is_active: true, user_id: 'u2' },
      { id: 'p-ai-new', room_id: 'room-participants-refresh', role_in_room: 'aiMediator', is_active: true, user_id: null },
    ]);
    prismaMock.chatToCaseLink.findFirst.mockResolvedValueOnce(null);
    prismaMock.chatMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-a',
        content: '我希望好好解決',
        created_at: new Date('2026-02-26T13:00:00.000Z'),
        sender_participant: { role_in_room: 'roleA' },
      },
      {
        id: 'm-b',
        content: '我願意聽建議',
        created_at: new Date('2026-02-26T13:01:00.000Z'),
        sender_participant: { role_in_room: 'roleB' },
      },
    ]);
    safetyRoutingServiceMock.decideRoute.mockReturnValueOnce({
      route: 'standard',
      reasons: ['ok'],
      detectedFlags: [],
    });
    aiServiceMock.detectCaseType.mockResolvedValueOnce('其他衝突');
    prismaMock.pairing.findFirst.mockResolvedValueOnce({
      id: 'pair-existing-u1-u2',
      status: 'active',
    });
    prismaMock.chatRoom.update.mockResolvedValue({ id: 'room-participants-refresh', status: 'judgment_completed' });
    prismaMock.case.create.mockResolvedValueOnce({ id: 'case-participants-refresh' });
    prismaMock.chatToCaseLink.create.mockResolvedValueOnce({ id: 'link-participants-refresh' });
    judgmentServiceMock.generateJudgment.mockResolvedValueOnce({ id: 'judgment-participants-refresh' });
    prismaMock.chatToCaseLink.update.mockResolvedValueOnce({
      id: 'link-participants-refresh',
      judgment_id: 'judgment-participants-refresh',
    });

    const result = await service.requestJudgment('room-participants-refresh', { userId: 'u1' }, {
      participantConsent: { roleBIncludedMessages: true },
    });
    expect(result.caseId).toBe('case-participants-refresh');
    expect(prismaMock.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defendant_id: 'u2',
        }),
      })
    );
  });

  it('requestJudgment: 鎖內若存在多個 active roleA 應拒絕（避免角色歧義）', async () => {
    prismaMock.chatRoom.findFirst.mockResolvedValueOnce({
      id: 'room-rolea-duplicate',
      status: 'group_active',
      owner_user_id: 'u1',
      session_id: null,
      history_visibility_mode: 'share_summary_only',
      participants: [
        { id: 'p-a1', role_in_room: 'roleA', user_id: 'u1', is_active: true },
      ],
    });
    prismaMock.chatRoom.findUnique.mockResolvedValueOnce({
      status: 'group_active',
      history_visibility_mode: 'share_summary_only',
    });
    prismaMock.chatParticipant.findUnique.mockResolvedValueOnce({
      id: 'p-a1',
      room_id: 'room-rolea-duplicate',
      role_in_room: 'roleA',
      is_active: true,
    });
    prismaMock.chatParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-a1', room_id: 'room-rolea-duplicate', role_in_room: 'roleA', is_active: true, user_id: 'u1' },
      { id: 'p-a2', room_id: 'room-rolea-duplicate', role_in_room: 'roleA', is_active: true, user_id: 'u1' },
      { id: 'p-ai', room_id: 'room-rolea-duplicate', role_in_room: 'aiMediator', is_active: true, user_id: null },
    ]);

    await expect(service.requestJudgment('room-rolea-duplicate', { userId: 'u1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });
});
