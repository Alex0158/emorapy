# Repair Journey 2.3 場景驗收矩陣

**文檔版本**：v1.0  
**最後更新**：2026-04-05  
**對應發佈**：v1.3.4  
**驗收範圍**：F05 Repair Journey、F13 通知中心  

---

## 驗收口徑

- 本矩陣只記錄 2.3 已落地能力：
  - `journey_context`
  - invitee `deferred`
  - 通知 `snooze`
  - Header bell + `/notifications` 再進場
- 未落地的長期願景不寫入本表。

## 場景主表

| 角色 | 入口 | 當前狀態 | 預期主任務 | 預期主 CTA | 預期落點 |
|---|---|---|---|---|---|
| initiator | `/judgment/:id` | 尚無 track | 選方向 / 進入 journey entry | 看看最適合你們的下一步 | `/reconciliation/:judgmentId` |
| initiator | `/reconciliation/:judgmentId` | `draft` | 回到主推薦與承諾 | 回到承諾工作台 | `/reconciliation/:judgmentId/:planId` |
| initiator | `/reconciliation/:judgmentId/:planId` | 自己已 committed、對方未邀請 | 是否邀請對方 | 邀請對方一起試 | `/reconciliation/:judgmentId/:planId` |
| initiator | `/notifications` | 對方 `deferred` | 理解對方需要時間並決定是否單人先行 | 查看邀請進度 | `/reconciliation/:judgmentId/:planId` |
| initiator | `/execution/dashboard` | `solo_active` | 完成今天的一小步 | 去看今天的一小步 | `/execution/:planId/checkin` |
| initiator | `/execution/dashboard` | `replanning` | 重新調整這一輪 | 重新調整這一輪 | `/execution/:planId/replan` |
| initiator | `/notifications` | `paused` | 恢復旅程 | 恢復這一輪 | `/reconciliation/:judgmentId/:planId` |
| invitee | 通知 deep link | 尚未查看邀請 | 先理解邀請，不強迫立即承諾 | 看看這個邀請 | `/reconciliation/:judgmentId/:planId` |
| invitee | `/reconciliation/:judgmentId/:planId` | `viewed` | 柔和回應邀請 | 我願意一起試 / 我需要一點時間 / 暫時先不要 | 留在詳情頁，並回寫狀態 |
| invitee | `/notifications` | 已 `deferred` | 之後回來再看這一輪 | 看看這個邀請 | `/reconciliation/:judgmentId/:planId` |
| solo user | `/reconciliation/:judgmentId/:planId` | 無有效 partner | 單人先行 | 先由我開始 | `/execution/:planId/checkin` |
| 任一角色 | `/notifications` | active actionable 通知 | 稍後再處理 | 稍後提醒我 | 留在 `/notifications`，並進入 snoozed |

## 狀態閉環檢查

| 狀態 | 預期 `journey_context.journey_task` | 前台證據 |
|---|---|---|
| `draft` | `review_recommendation` / `invite_partner` | `Reconciliation/List`、`Reconciliation/Detail` |
| `partner_invited` | `wait_partner` / `respond_invite` | `Reconciliation/Detail`、`Notifications` |
| `solo_active` | `continue_today_step` | `Execution/Dashboard`、`Execution/CheckIn` |
| `co_active` | `continue_today_step` | `Execution/Dashboard`、`Execution/CheckIn` |
| `replanning` | `replan_now` | `Execution/Replan`、`Notifications` |
| `paused` | `resume_track` | `Execution/Dashboard`、`Notifications` |
| `completed` | `review_completed` | `Execution/Dashboard`、`Reconciliation/Detail` |

## 通知驗收

| 場景 | 預期 |
|---|---|
| Header bell | 顯示未讀且未 snooze 的 actionable 數量 |
| 點通知卡片 | 先 `mark read`，再走 `journey_context.entry_path` 或 render path |
| 點主 CTA | 先 `act`，再走後端返回 target 或 `journey_context.primary_cta.path` |
| 稍後提醒我 | 調 `POST /notifications/:id/snooze`，通知不消失，轉入 `snoozed` 分組 |
| dismiss | 只保留給較早/歷史通知，不作為 repair journey actionable 默認次操作 |

## 最小回歸命令

```bash
npm --prefix backend test -- --runInBand tests/unit/routes/notification.routes.test.ts tests/unit/routes/reconciliation.routes.test.ts tests/unit/services/reconciliation.service.test.ts tests/unit/services/execution.service.test.ts
npm --prefix frontend test -- src/services/api/notifications.test.ts src/pages/Notifications/index.test.tsx src/pages/Execution/Dashboard/index.test.tsx src/pages/Reconciliation/Detail/index.test.tsx src/pages/Reconciliation/List/index.test.tsx
npm --prefix backend run build
npm --prefix frontend run build
```
