import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale, t } from '@/utils/i18n';
import type { ChatMessage } from '@/types/chat';
import {
  buildMessageAnchorHash,
  buildSendMessagePayload,
  getAnchorHandledKey,
  getAnchorOrigin,
  getFirstItemIndexAfterPrepend,
  getHistoryStateAfterLatestRefresh,
  getInitialMessageWindow,
  getJudgmentPollingDecision,
  getInviteHistoryVisibilityMode,
  getPendingAnchorResolution,
  getRouteStateRoom,
  getRoomStatusNoticeFeedback,
  getRoomStreamCloseRetryText,
  getRoomStreamRetryDelayMs,
  getRoomStreamRetryErrorText,
  getRoomStreamTerminalErrorText,
  getRoomMutationErrorFeedback,
  getSendMessageErrorFeedback,
  getUniqueHistoryMessages,
  hasMessageAnchorHash,
  INITIAL_FIRST_ITEM_INDEX,
  JUDGMENT_POLLING_MAX_ATTEMPTS,
  isRoomStreamReadyEvent,
  isRoomActionBlocked,
  parseMessageAnchorHash,
  shouldApplyRoomRefresh,
  shouldAllowMessageCacheTrim,
  shouldRefreshRoomForStreamEvent,
  shouldShowHistoryCacheFullNotice,
  trimMessagesToCacheLimit,
} from './chatRoomUtils';

const message = (id: string): ChatMessage => ({
  id,
  room_id: 'room-1',
  sender_participant_id: 'participant-1',
  content: id,
  message_type: 'user_text',
  visibility_scope: 'all',
  safety_flag: false,
  created_at: `2026-01-01T00:00:0${id}.000Z`,
});

async function setLocaleReady(locale: 'zh-TW' | 'en-US'): Promise<void> {
  setLocale(locale);
  if (locale === 'en-US') {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (t('apiError.invalidResponse') === 'The service response could not be read. Please try again later.') return;
    }
  } else {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeEach(() => {
  setLocale('zh-TW');
});

describe('chatRoomUtils initial room helpers', () => {
  it('應只接受與 route roomId 相同的 state.room', () => {
    const room = { id: 'room-1', status: 'solo_active' };

    expect(getRouteStateRoom({ room }, 'room-1')).toBe(room);
    expect(getRouteStateRoom({ room }, 'room-2')).toBeNull();
    expect(getRouteStateRoom(null, 'room-1')).toBeNull();
    expect(getRouteStateRoom({ other: room }, 'room-1')).toBeNull();
  });

  it('初始訊息視窗應集中正規化 firstItemIndex、cursor 與 hasMoreHistory', () => {
    const messages = [message('1'), message('2')];

    expect(getInitialMessageWindow({ messages, nextCursor: 'cursor-1' })).toEqual({
      firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
      messages,
      historyCursor: 'cursor-1',
      hasMoreHistory: true,
    });
    expect(getInitialMessageWindow({ messages, nextCursor: undefined })).toEqual({
      firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
      messages,
      historyCursor: null,
      hasMoreHistory: false,
    });
  });

  it('應以 window hash 形態辨識訊息 anchor，避免初始載入時誤捲到底部', () => {
    expect(hasMessageAnchorHash('#msg-123')).toBe(true);
    expect(hasMessageAnchorHash('msg-123')).toBe(false);
    expect(hasMessageAnchorHash('#other-123')).toBe(false);
    expect(hasMessageAnchorHash(null)).toBe(false);
  });

  it('refresh 結果只能套用到當前 route roomId', () => {
    expect(shouldApplyRoomRefresh({ targetRoomId: 'room-1', activeRouteRoomId: 'room-1' })).toBe(true);
    expect(shouldApplyRoomRefresh({ targetRoomId: 'room-1', activeRouteRoomId: 'room-2' })).toBe(false);
    expect(shouldApplyRoomRefresh({ targetRoomId: 'room-1', activeRouteRoomId: null })).toBe(false);
  });
});

describe('chatRoomUtils mutation helpers', () => {
  it('judgment_requested 與終態房間應阻擋寫入動作', () => {
    expect(isRoomActionBlocked('solo_active')).toBe(false);
    expect(isRoomActionBlocked('judgment_requested')).toBe(true);
    expect(isRoomActionBlocked('judgment_completed')).toBe(true);
    expect(isRoomActionBlocked('judgment_failed')).toBe(true);
    expect(isRoomActionBlocked('archived')).toBe(true);
  });

  it('送訊息遇到 FORBIDDEN 應轉成發言權限 warning', () => {
    expect(getSendMessageErrorFeedback({ code: 'FORBIDDEN' })).toEqual({
      level: 'warning',
      message: t('chat.message.forbidden'),
      refreshRoom: false,
    });
  });

  it('送訊息一般錯誤不應直出 raw message，沒有 message 時使用 sendFail', () => {
    expect(getSendMessageErrorFeedback(new Error('發送失敗'))).toEqual({
      level: 'error',
      message: t('chat.message.sendFail'),
      refreshRoom: false,
    });
    expect(getSendMessageErrorFeedback({ code: 'SERVER_ERROR', message: '' })).toEqual({
      level: 'error',
      message: t('chat.message.sendFail'),
      refreshRoom: false,
    });
  });

  it('房間 mutation 的 CONFLICT 應要求刷新房間，session 錯誤應顯示 invalidSession', () => {
    expect(getRoomMutationErrorFeedback({ code: 'CONFLICT' }, 'chat.message.createInviteFail')).toEqual({
      level: 'warning',
      message: t('chat.message.conflictRefresh'),
      refreshRoom: true,
    });
    expect(getRoomMutationErrorFeedback({ code: 'SESSION_EXPIRED' }, 'chat.message.judgmentFail')).toEqual({
      level: 'warning',
      message: t('chat.message.invalidSession'),
      refreshRoom: false,
    });
  });

  it('房間 mutation 一般錯誤不應直出 raw message，沒有 message 時使用指定 fallback', () => {
    expect(getRoomMutationErrorFeedback(new Error('建立邀請失敗'), 'chat.message.createInviteFail')).toEqual({
      level: 'error',
      message: t('chat.message.createInviteFail'),
      refreshRoom: false,
    });
    expect(getRoomMutationErrorFeedback({ code: 'SERVER_ERROR', message: '' }, 'chat.message.judgmentFail')).toEqual({
      level: 'error',
      message: t('chat.message.judgmentFail'),
      refreshRoom: false,
    });
  });

  it('房間 action raw message fallback 應跟隨目前語言，fixed diagnostic 仍可本地化', async () => {
    await setLocaleReady('en-US');

    expect(getSendMessageErrorFeedback(new Error('發送失敗'))).toEqual({
      level: 'error',
      message: 'Failed to send message',
      refreshRoom: false,
    });
    expect(getRoomMutationErrorFeedback(new Error('建立邀請失敗'), 'chat.message.createInviteFail')).toEqual({
      level: 'error',
      message: 'Failed to create invite',
      refreshRoom: false,
    });
    expect(getRoomMutationErrorFeedback(
      new Error('Invalid chat room response from server'),
      'chat.message.judgmentFail',
    )).toEqual({
      level: 'error',
      message: 'The service response could not be read. Please try again later.',
      refreshRoom: false,
    });
  });

  it('邀請可見性應跟隨房間設定，缺失時使用 summary-only 預設', () => {
    expect(getInviteHistoryVisibilityMode({ history_visibility_mode: 'share_full_history' })).toBe('share_full_history');
    expect(getInviteHistoryVisibilityMode(null)).toBe('share_summary_only');
  });

  it('應集中構造發送訊息 payload', () => {
    expect(
      buildSendMessagePayload({
        content: 'hello',
        visibilityScope: 'owner_only',
        replyToMessageId: 'reply-1',
      })
    ).toEqual({
      content: 'hello',
      visibility_scope: 'owner_only',
      reply_to_message_id: 'reply-1',
    });
  });
});

describe('chatRoomUtils judgment polling helpers', () => {
  it('判決輪詢應在超過最大次數時 timeout', () => {
    expect(getJudgmentPollingDecision({ attempts: JUDGMENT_POLLING_MAX_ATTEMPTS + 1 })).toEqual({
      type: 'timeout',
    });
  });

  it('判決輪詢應在取得 judgment id 時返回 ready', () => {
    expect(
      getJudgmentPollingDecision({
        attempts: 1,
        status: {
          roomStatus: 'judgment_requested',
          latestLink: {
            id: 'link-1',
            judgment: {
              id: 'judgment-1',
              created_at: '2026-01-01T00:00:00.000Z',
            },
          },
        },
      })
    ).toEqual({ type: 'ready', judgmentId: 'judgment-1' });
  });

  it('判決輪詢應識別 judgment_failed，其餘狀態繼續等待', () => {
    expect(
      getJudgmentPollingDecision({
        attempts: 1,
        status: { roomStatus: 'judgment_failed' },
      })
    ).toEqual({ type: 'failed' });
    expect(
      getJudgmentPollingDecision({
        attempts: 1,
        status: { roomStatus: 'judgment_requested' },
      })
    ).toEqual({ type: 'continue' });
    expect(getJudgmentPollingDecision({ attempts: 1, status: null })).toEqual({ type: 'continue' });
  });
});

describe('chatRoomUtils room stream helpers', () => {
  it('應限制 room stream reconnect delay 上限', () => {
    expect(getRoomStreamRetryDelayMs(0)).toBe(1000);
    expect(getRoomStreamRetryDelayMs(1)).toBe(2000);
    expect(getRoomStreamRetryDelayMs(100)).toBe(10000);
  });

  it('應集中處理 room stream terminal / retry / close 文案', () => {
    expect(getRoomStreamTerminalErrorText({ message: 'session expired' })).toBe(t('chat.message.streamTerminalError'));
    expect(getRoomStreamTerminalErrorText({})).toBe(t('chat.message.streamTerminalError'));
    expect(getRoomStreamRetryErrorText(new Error('network down'))).toBe(t('chat.message.streamFail'));
    expect(getRoomStreamRetryErrorText({ code: 'STREAM_DISCONNECTED', message: '' })).toBe(t('chat.message.streamFail'));
    expect(getRoomStreamCloseRetryText()).toBe(t('chat.message.streamClosedRetry'));
  });

  it('terminal stream fixed invalid-response fallback 應跟隨目前語言', async () => {
    expect(getRoomStreamTerminalErrorText({
      message: 'Invalid chat room response from server',
    })).toBe('服務回應格式異常，請稍後再試');

    await setLocaleReady('en-US');

    expect(getRoomStreamTerminalErrorText({
      message: 'Invalid chat room response from server',
    })).toBe('The service response could not be read. Please try again later.');
  });

  it('應辨識 ready 與需要刷新房間的 stream event', () => {
    expect(isRoomStreamReadyEvent({ type: 'ready', roomId: 'room-1' })).toBe(true);
    expect(isRoomStreamReadyEvent({ type: 'message', roomId: 'room-1' })).toBe(false);
    expect(shouldRefreshRoomForStreamEvent({ type: 'message', roomId: 'room-1' })).toBe(true);
    expect(shouldRefreshRoomForStreamEvent({ type: 'invite', roomId: 'room-1' })).toBe(true);
    expect(shouldRefreshRoomForStreamEvent({ type: 'room_status', roomId: 'room-1' })).toBe(true);
    expect(shouldRefreshRoomForStreamEvent({ type: 'ping', roomId: 'room-1' })).toBe(false);
    expect(shouldRefreshRoomForStreamEvent({ type: 'system', roomId: 'room-1' })).toBe(false);
  });

  it('應把 room_status payload 轉成對應 toast feedback', () => {
    expect(getRoomStatusNoticeFeedback({ payload: { joined: true } })).toEqual({
      level: 'success',
      message: t('chat.stream.joined'),
    });
    expect(getRoomStatusNoticeFeedback({ payload: { participantKicked: true } })).toEqual({
      level: 'info',
      message: t('chat.stream.participantKicked'),
    });
    expect(getRoomStatusNoticeFeedback({ payload: { participantLeft: true } })).toEqual({
      level: 'info',
      message: t('chat.stream.participantLeft'),
    });
    expect(getRoomStatusNoticeFeedback({ payload: {} })).toBeNull();
  });
});

describe('chatRoomUtils history and anchor helpers', () => {
  it('latest refresh 應保留既有歷史 cursor，避免被最新頁 cursor 覆蓋', () => {
    expect(
      getHistoryStateAfterLatestRefresh({
        currentCursor: 'older-cursor',
        hasMoreHistory: true,
        fetchedNextCursor: 'latest-cursor',
      })
    ).toEqual({ historyCursor: 'older-cursor', hasMoreHistory: true });
  });

  it('latest refresh 不應在歷史已耗盡後重新打開更多歷史入口', () => {
    expect(
      getHistoryStateAfterLatestRefresh({
        currentCursor: null,
        hasMoreHistory: false,
        fetchedNextCursor: 'latest-cursor',
      })
    ).toEqual({ historyCursor: null, hasMoreHistory: false });
  });

  it('latest refresh 可在仍允許歷史但 cursor 缺失時以最新頁 cursor 修復狀態', () => {
    expect(
      getHistoryStateAfterLatestRefresh({
        currentCursor: null,
        hasMoreHistory: true,
        fetchedNextCursor: 'latest-cursor',
      })
    ).toEqual({ historyCursor: 'latest-cursor', hasMoreHistory: true });
    expect(
      getHistoryStateAfterLatestRefresh({
        currentCursor: null,
        hasMoreHistory: true,
        fetchedNextCursor: null,
      })
    ).toEqual({ historyCursor: null, hasMoreHistory: false });
  });

  it('只有在使用者位於底部且沒有 anchor/載入歷史時才允許裁切訊息 cache', () => {
    expect(
      shouldAllowMessageCacheTrim({
        isAtBottom: true,
        pendingAnchorMessageId: null,
        loadingMoreHistory: false,
      })
    ).toBe(true);
    expect(
      shouldAllowMessageCacheTrim({
        isAtBottom: false,
        pendingAnchorMessageId: null,
        loadingMoreHistory: false,
      })
    ).toBe(false);
    expect(
      shouldAllowMessageCacheTrim({
        isAtBottom: true,
        pendingAnchorMessageId: 'msg-1',
        loadingMoreHistory: false,
      })
    ).toBe(false);
    expect(
      shouldAllowMessageCacheTrim({
        isAtBottom: true,
        pendingAnchorMessageId: null,
        loadingMoreHistory: true,
      })
    ).toBe(false);
  });

  it('裁切訊息 cache 時應移除最舊訊息並回傳移除數量', () => {
    const result = trimMessagesToCacheLimit([message('1'), message('2'), message('3')], {
      allowTrim: true,
      maxMessages: 2,
    });

    expect(result.removedCount).toBe(1);
    expect(result.messages.map((m) => m.id)).toEqual(['2', '3']);
    expect(trimMessagesToCacheLimit(result.messages, { allowTrim: false, maxMessages: 1 })).toEqual({
      messages: result.messages,
      removedCount: 0,
    });
  });

  it('載入歷史頁時應過濾既有訊息，並按新增數回推 firstItemIndex', () => {
    const existing = new Map([
      ['2', 100],
      ['3', 101],
    ]);

    expect(getUniqueHistoryMessages([message('1'), message('2'), message('0')], existing).map((m) => m.id)).toEqual([
      '1',
      '0',
    ]);
    expect(getFirstItemIndexAfterPrepend(100, 2)).toBe(98);
    expect(getFirstItemIndexAfterPrepend(1, 5)).toBe(0);
  });

  it('history cache full 提示應受 cooldown 控制', () => {
    expect(shouldShowHistoryCacheFullNotice({ now: 10_001, lastNoticeAt: 5000 })).toBe(true);
    expect(shouldShowHistoryCacheFullNotice({ now: 9999, lastNoticeAt: 5000 })).toBe(false);
  });

  it('應解析與構造訊息 anchor hash', () => {
    expect(buildMessageAnchorHash('msg-1')).toBe('#msg-msg-1');
    expect(parseMessageAnchorHash('#msg-msg-1')).toBe('msg-1');
    expect(parseMessageAnchorHash('msg-msg-1')).toBe('msg-1');
    expect(parseMessageAnchorHash('#other-msg-1')).toBeNull();
    expect(getAnchorHandledKey('room-1', 'msg-1')).toBe('room-1:msg-1');
  });

  it('anchor origin 應以可視範圍起點推回原訊息，並限制索引邊界', () => {
    expect(
      getAnchorOrigin({
        rangeStartIndex: 102,
        firstItemIndex: 100,
        messages: [message('1'), message('2'), message('3')],
        isAtBottom: false,
      })
    ).toEqual({ originMessageId: '3', wasAtBottom: false });
    expect(
      getAnchorOrigin({
        rangeStartIndex: 95,
        firstItemIndex: 100,
        messages: [message('1'), message('2')],
        isAtBottom: true,
      })
    ).toEqual({ originMessageId: '1', wasAtBottom: true });
    expect(
      getAnchorOrigin({
        rangeStartIndex: 100,
        firstItemIndex: 100,
        messages: [],
        isAtBottom: false,
      })
    ).toEqual({ originMessageId: null, wasAtBottom: false });
  });

  it('pending anchor resolution 應區分已載入、等待、缺歷史、超過自動翻頁與可載入下一頁', () => {
    expect(
      getPendingAnchorResolution({
        targetLoaded: true,
        hasMoreHistory: true,
        loadingMoreHistory: false,
        historyCursor: 'cursor',
        autoPages: 0,
      })
    ).toBe('loaded');
    expect(
      getPendingAnchorResolution({
        targetLoaded: false,
        hasMoreHistory: false,
        loadingMoreHistory: false,
        historyCursor: null,
        autoPages: 0,
      })
    ).toBe('wait');
    expect(
      getPendingAnchorResolution({
        targetLoaded: false,
        hasMoreHistory: true,
        loadingMoreHistory: false,
        historyCursor: null,
        autoPages: 0,
      })
    ).toBe('missing-history');
    expect(
      getPendingAnchorResolution({
        targetLoaded: false,
        hasMoreHistory: true,
        loadingMoreHistory: false,
        historyCursor: 'cursor',
        autoPages: 6,
        autoPageLimit: 6,
      })
    ).toBe('limit-reached');
    expect(
      getPendingAnchorResolution({
        targetLoaded: false,
        hasMoreHistory: true,
        loadingMoreHistory: false,
        historyCursor: 'cursor',
        autoPages: 5,
        autoPageLimit: 6,
      })
    ).toBe('load-more');
  });
});
