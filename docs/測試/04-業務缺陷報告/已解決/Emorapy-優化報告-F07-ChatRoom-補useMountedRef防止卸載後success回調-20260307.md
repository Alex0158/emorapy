# Emorapy 優化報告 - F07 Chat Room 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F07-OPT-001`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F07-OPT-001**：聊天室頁（Chat Room）的 `handleCreateRoom`、`handleAcceptInvite`、`handleDeclineInvite`、`handleCreateInvite`、`handleRequestJudgment`、`tryStartJudgmentPolling` 回調、`leaveChatRoom` 與 `kickChatParticipantB` 內聯處理、`showRoomStatusNotice`（SSE 回調）在 async 成功後會呼叫 `message.success`/`message.info`、`setRoom`、`navigate` 或 `refreshRoomSafely`，均未使用 `useMountedRef`。

當使用者快速離開頁面後，若 async 操作成功返回，仍會呼叫 `message.success` 與 `navigate`，可能導致非預期導航或與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 使用者已離開聊天室，卻被突然導向判決頁或聊天室列表，造成困惑
2. 與 Judgment Detail、Case Detail、Profile Pairing 等已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Chat Room**：
1. 對 `handleCreateRoom`、`handleAcceptInvite`、`handleDeclineInvite`、`handleCreateInvite`、`handleRequestJudgment` 的 async 成功路徑，在 `await` 後檢查 `mountedRef.current`，若已卸載則直接 `return`
2. 對 `tryStartJudgmentPolling` 的 setInterval 回調內 `getChatJudgmentStatus` 成功分支，檢查 `mountedRef.current`
3. 對 `leaveChatRoom`、`kickChatParticipantB` 內聯 onClick 的 async 成功路徑，檢查 `mountedRef.current`
4. 對 `showRoomStatusNotice`（SSE 串流回調）開頭檢查 `mountedRef.current`

## 4. 修復後驗證

- Chat Room 新增測試：
  - `createChatRoom 成功但組件已卸載時不應呼叫 message.success 或 navigate`
  - `leaveChatRoom 成功但組件已卸載時不應呼叫 message.success 或 navigate`
- `npm run test -- --run src/pages/Chat/Room/index.test.tsx` 全數通過（68 例）
