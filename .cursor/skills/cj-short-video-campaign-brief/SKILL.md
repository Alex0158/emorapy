---
name: cj-short-video-campaign-brief
description: >-
  Produces one self-contained Markdown brief per CJ paid short-video campaign: strategy angle,
  target audience, hook matrix, 15–20s beats, storyboard, scenes, compliance routing, visual bible,
  per-shot on-screen text, SFX notes, and copy-paste prompts for Gemini image generation (Nano Banana
  2 / Nano Banana Pro in Gemini Apps) and Jimeng image-to-video. Enforces CJ marketing SSOT, disclaimer
  timing for counseling comparisons, and continuity anchors. Use when the user asks for a video script,
  ad creative, storyboard, NanoBanana or Gemini image prompts, Seedance or Jimeng video prompts, or a
  full generative brief for CJ marketing.
---

# CJ 付費短片：單案完整方案（一影片一 MD）

## 定位

本 Skill 指導 Agent 產出**一份可交付的單案 Markdown**（非全自動成片），涵蓋策略、受眾、Hook 矩陣、分鏡、場景、合規路由、視覺連戲、**逐鏡旁白／字幕／畫面字**，以及 **Gemini（Nano Banana 2／Pro）圖 Prompt** 與 **即夢影片 Prompt**。

專案 SSOT（寫入文檔時必引用或對齊）：

- [短影音付費推廣策略-主力角度與排期.md](../../docs/核心開發文件/Marketing/短影音付費推廣策略-主力角度與排期.md)
- [短影音付費推廣策略-腳本與Hook變體.md](../../docs/核心開發文件/Marketing/短影音付費推廣策略-腳本與Hook變體.md)
- [短影音付費推廣策略-合規與免責文案.md](../../docs/核心開發文件/Marketing/短影音付費推廣策略-合規與免責文案.md)
- [生成式分鏡-Gemini與即夢手動工作流.md](../../docs/核心開發文件/Marketing/生成式分鏡-Gemini與即夢手動工作流.md)

深度規則、平台微差、常見錯誤：[reference.md](reference.md)

## 輸出路徑與檔名

- 目錄：[docs/核心開發文件/Marketing/campaigns/](../../docs/核心開發文件/Marketing/campaigns/)
- 檔名：`YYYY-MM-DD-{腳本軸}_{簡短slug}.md`
- **一影片方案 = 一個 MD**；改版用**同檔修訂記錄**，不開新檔堆疊。

## 產出前必答（若使用者未給，先問或採預設）

| 問題 | 無回覆時的預設 |
|------|----------------|
| 長度 | 15–20 秒 |
| 畫幅 | 9:16 |
| 主力三軸 | 可負擔／第三方聽完／低門檻 擇一（或沿用使用者指定變體如 E-α） |
| 語言 | 旁白／字幕：繁體中文 |
| 真人臉 | 預設**避免可辨識真人**（剪影、背影、意象畫面），降低肖像風險 |

## 執行流程（Agent）

1. **選軸對表**：用 [reference.md](reference.md)「主力三軸對照」確認主軸與忌諱。  
2. **合規路由**：若文案含諮商價格／多期／心理師等 → 必排 **標準短版 A** 時段；見 [合規與免責文案](../../docs/核心開發文件/Marketing/短影音付費推廣策略-合規與免責文案.md) 與 reference「合規決策樹」。  
3. **填滿模板**：以 [campaign-doc-template.md](campaign-doc-template.md) 為唯一骨架；**禁止**大量空白占位（除非使用者要草稿）。  
4. **Hook 矩陣**：除主 Hook 外，至少 **2 個**替換 Hook（供投放輪替）；標註「扎心版／溫暖版」若可區分。  
5. **分鏡**：至少 **5 鏡**（Hook／共鳴／解法／CTA／品牌 可增減但需覆蓋 0–20s）。每鏡必填：**秒數、場景、情緒、旁白、畫面大字（若有）、Gemini 圖 Prompt、即夢 Prompt、合規備註**。  
6. **視覺連戲**：寫出 **風格錨點句**；每則圖 Prompt **完整複製錨點 + 只改本鏡獨有層**（見 reference「五層結構」）。  
7. **即夢**：一鏡一條；含「依上傳分鏡圖」+ 鏡頭運動 + 主體動作 + 時間細切。  
8. **後製表**：預期即夢條數（通常 2–4）、音效情緒、匯出檔名規則。  
9. **品質門檻**（輸出前自檢）：見下一節檢查清單。

## 品質門檻檢查清單（Agent 輸出前勾選）

- [ ] 主軸與 CJ「第三方調解、結構化、和好方向、快速體驗」之一致，無虛構功能  
- [ ] 諮商對比類已排 **標準短版 A** 時段與字幕文案  
- [ ] Hook 可於 **2 秒內**唸完或讀完（大字幕）  
- [ ] 每鏡 Gemini Prompt 含 **9:16** 與 **錨點句**  
- [ ] 每鏡即夢 Prompt 不跨鏡、不塞滿整支 15–20s  
- [ ] 已標註 **檔名規則**（例：`E-alpha_sh01.png`）  
- [ ] 已寫 **修訂記錄** 首行日期

## Prompt 語言慣例

| 區塊 | 建議語言 |
|------|----------|
| Gemini 圖像 Prompt | 英文為主（或中英對照）；複雜構圖較穩 |
| 即夢影片 Prompt | 繁體中文 |
| 旁白／字幕／畫面字 | 繁體中文 |

## 術語對照

| 口語 | 文檔用語 |
|------|----------|
| NanoBananaPro | Gemini Apps：**Nano Banana Pro**（Redo）／**Nano Banana 2**；[Google 說明](https://support.google.com/gemini/answer/14286560) |
| Seedance | 手動流程以 **即夢** 為準 |

## 模板與延伸

- 單案完整骨架：[campaign-doc-template.md](campaign-doc-template.md)  
- 決策樹、五層 Prompt、平台微差：[reference.md](reference.md)
