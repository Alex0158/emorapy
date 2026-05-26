# Web Animation Utils Skipped Tests 待辦（2026-05-10）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web animation utils、`animateNumber`、skipped unit tests、jsdom rAF / performance.now 測試穩定性
**取證代碼入口**：`frontend/src/utils/animations.ts`、`frontend/src/utils/animations.test.ts`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-10`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Frontend / Test Quality
**優先級**：P2
**分類**：測試債 / Web 代碼質量

## 1. 問題

主站 Web 單測曾回報 `6 skipped`：2 條是 `frontend/src/utils/animations.test.ts` 內 `animateNumber` 測試，4 條是 `frontend/src/pages/Case/List/index.test.tsx` 的 F03 案件列表錯誤恢復 / 篩選 / 排序測試。animation 兩條因 jsdom 中 `performance.now` / `requestAnimationFrame` timestamp 不穩定而被 skip，導致數字動畫的 formatter 與 fallback String 行為沒有自動化保護。Case List 四條雖同時被 [WebP0流程E2E真服務證據缺口待辦-2026-05-10.md](./WebP0流程E2E真服務證據缺口待辦-2026-05-10.md) 記錄為 P0 證據缺口，但不能視為已由 E2E 覆蓋；它們必須回到 component/unit gate。

## 2. 證據

`frontend/src/utils/animations.test.ts`：

```ts
describe('animateNumber', () => {
  it.skip('應更新 textContent 並支持 formatter', async () => {
    // jsdom 中 performance.now/rAF 時間戳與瀏覽器不一致，易導致負值
    const formatter = (n: number) => `${n}%`;
    animateNumber(el, 100, 1, formatter);
    await new Promise((r) => setTimeout(r, 15));
    expect(el.textContent).toBe('100%');
  });
  it.skip('無 formatter 時應使用 String', async () => {
    // jsdom 中 performance.now/rAF 時間戳與瀏覽器不一致
    animateNumber(el, 50, 1);
    await new Promise((r) => setTimeout(r, 15));
    expect(el.textContent).toBe('50');
  });
});
```

同輪掃描命令：

```bash
rg -n "\\b(describe|it|test)\\.skip\\b|\\.only\\b|skip\\(" frontend frontend-admin e2e --glob '*.{ts,tsx}'
```

結果顯示主站單測 skip 分為 Case List 4 條與 animation utils 2 條；Admin E2E skip 已由 Admin 測試入口缺口文件覆蓋。2026-05-11 重新核驗時，animation 兩條已清零，但 Case List 四條仍存在，因此本文件的 skip 口徑必須與總控方案 9.3 一起讀，不得只宣稱 animation 修復完成即代表全站 skipped tests 清零。

## 3. 核心文件依據

1. `08-測試規範與驗收/README.md`：不能把單一測試通過寫成完整治理完成，skipped 測試必須保留缺口口徑。
2. `08-測試規範與驗收/05-可訪問性本地化驗收基線.md`：UI 狀態、動畫、focus / keyboard 類行為不能只靠人工推斷；需要可追溯測試或 inspection。
3. `10-Web端/00-Web端凍結基線總覽.md`：Web 作正式入口，質量 gate 不能把跳過的單元測試隱藏在總 pass 數字下。

## 4. 風險

1. `animateNumber` 的 formatter 行為退化時，總測試仍可能顯示通過。
2. skipped 測試會讓 `npm run test:run --workspace frontend` 的 pass 結果被誤讀為全部 Web utility 行為已覆蓋。
3. 若後續有倒數、進度、指標或 Admin reporting UI 消費 `animateNumber`，數字展示錯誤可能不會被測試擋住。

## 5. 目標狀態

1. 用受控 `requestAnimationFrame` timestamp 與 `performance.now` mock 重寫 `animateNumber` 測試。
2. 取消兩條 `it.skip`，或改為等價、穩定且非 skip 的行為測試。
3. `npm run test:run --workspace frontend` 的 skipped 數量下降，且剩餘 skip 都能對應活躍待辦。
4. 若維持部分 skip，必須在本文件補明確原因、owner 與解除條件。

## 5.1 本輪修復證據（2026-05-10）

已落地修復：

1. `frontend/src/utils/animations.test.ts` 的 rAF mock 改為以 `performance.now()` 作初始基準，再逐 frame 增加 timestamp，避免 jsdom 下 currentTime 小於 startTime 造成負值。
2. 兩條 `animateNumber` 測試已從 `it.skip` 復原為正式 `it`，分別覆蓋 formatter 與 fallback String 行為。

本輪驗證：

```bash
npm run test:run --workspace frontend -- src/utils/animations.test.ts
rg -n "describe\\.skip|it\\.skip|test\\.skip" frontend/src/utils/animations.test.ts
```

結果：`frontend/src/utils/animations.test.ts` 15 tests 全部通過；skip 掃描無輸出。animation utils 的 skipped test 缺口已清除。

## 5.2 Case List skipped tests 補充修復（2026-05-11）

2026-05-11 實測取消 `frontend/src/pages/Case/List/index.test.tsx` 的 4 條 `it.skip` 後，首輪 failure 為 Radix Select 在 jsdom 中觸發 `target.hasPointerCapture is not a function`，第二輪 failure 為 `findByText` 同時命中卡片 badge 與 dropdown option。裁決如下：

1. 不改產品 `CaseList` 或 shared Select；狀態流本身已按 filter / sort state 重新觸發 `getCaseList`。
2. 在 `frontend/src/test/setup.ts` 集中補 `Element.prototype.hasPointerCapture`、`setPointerCapture`、`releasePointerCapture`，作為 Radix Select 類元件的 jsdom 測試契約。
3. Case List 測試改用 `findByRole('option', { name })` 選取 dropdown option，對齊 role/name 驗證規則。
4. Case List 測試 `beforeEach` 改用 `vi.resetAllMocks()`，避免 one-off mock queue 跨 case 污染。

本輪驗證：

```bash
npm run test:run --workspace frontend -- src/pages/Case/List/index.test.tsx
```

結果：`frontend/src/pages/Case/List/index.test.tsx` 23 tests 全部通過，0 skipped。

## 6. 驗收命令

```bash
npm run test:run --workspace frontend -- animations
rg -n "\\b(describe|it|test)\\.skip\\b|\\.only\\b|skip\\(" frontend/src/utils/animations.test.ts
npm run test:run --workspace frontend
npm run docs:check
```
