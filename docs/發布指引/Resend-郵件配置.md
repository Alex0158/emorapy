# Resend 郵件服務配置指引

**文檔版本**：v1.0  
**最後更新**：2026-03-07  
**適用**：後端註冊驗證碼、忘記密碼、判決通知等 transactional 郵件。

---

## 1. 為什麼用 Resend

- 免費 **3,000 封/月**，不需信用卡，適合初創。
- 支援 **SMTP**，後端已用 Nodemailer，只需填環境變數即可。
- 開發者體驗好、送達率佳，發信紀錄可在 Resend 後台查看。

---

## 2. 後台設定步驟

### 2.1 註冊與登入

1. 打開 [Resend](https://resend.com) → Sign up（可用 GitHub 登入）。
2. 登入後進入 Dashboard。

### 2.2 驗證發信網域

**「發信網域」指的是郵件 From 地址 @ 後面的那一段**（例如 `noreply@emorapy.com` 裡的 `emorapy.com`），不是品牌名稱本身。

- 若產品對外網址是 **Emorapy** 官網／App 的網域（例如 `emorapy.com` 或你們實際使用的根網域），就驗證該網域，之後發信可用 `noreply@該網域`。
- 若專案目前用 **Mother Bear Court** 相關網域（例如 `motherbearcourt.com`），就驗證該網域，發信可用 `noreply@motherbearcourt.com`。
- **二選一**：你只需驗證「會用來當發信地址」的那一個網域；若 Emorapy 與 Mother Bear Court 共用同一個根網域，驗證一次即可。

操作步驟：

1. 左側 **Domains** → **Add Domain**。
2. 輸入上述發信用網域（例如 `emorapy.com` 或 `motherbearcourt.com`）。
3. Resend 會給出 **DNS 紀錄**（MX、TXT 等），到你的域名服務商（Cloudflare、Namecheap、Vercel 等）新增這些紀錄。
4. 回到 Resend 點 **Verify**，狀態變為 Verified 即可。

若暫時沒有自己的網域，可使用 Resend 提供的測試網域 `onboarding@resend.dev`（僅限發給自己帳號信箱做測試）。

### 2.3 建立 API Key

1. 左側 **API Keys** → **Create API Key**。
2. 取名（例如 `CJ Backend Production`），權限選 **Sending access**。
3. 複製產生的 Key（格式 `re_xxxxxxxx...`），**只會顯示一次**，請妥善保存。

---

## 3. 環境變數

在後端所在環境（本機 `.env` 或 Railway Variables）設定：

| 變數 | 必填 | 說明 | 範例 |
|------|------|------|------|
| `SMTP_HOST` | 是 | Resend SMTP 主機 | `smtp.resend.com` |
| `SMTP_PORT` | 否 | 預設 587 | `587` |
| `SMTP_USER` | 是 | 固定為 `resend` | `resend` |
| `SMTP_PASS` | 是 | Resend API Key | `re_xxxxxxxx...` |
| `EMAIL_FROM` | 是（Resend） | 發件人信箱，**須為已驗證網域** | `noreply@yourdomain.com` |

**重要**：Resend 規定發信地址必須是已在後台驗證過的網域，因此 `EMAIL_FROM` 必須填像 `noreply@yourdomain.com` 這類地址，不能填 `resend` 或未驗證的網域。

### 本機 .env 範例

```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_你的API_KEY
EMAIL_FROM=noreply@yourdomain.com
```

### Railway

在 Railway Dashboard → 後端服務 → **Variables** 新增上述五個變數；`SMTP_PASS` 建議標記為 Sensitive。部署後重啟即生效。

---

## 4. 驗證是否生效

1. 啟動後端，觸發一封驗證碼郵件（例如註冊或忘記密碼）。
2. 檢查收件匣（及垃圾信）；Resend Dashboard → **Emails** 可看到發送紀錄與狀態。
3. 若未發送：檢查後端日誌是否有「郵件服務未配置」或 SMTP 錯誤；確認五個環境變數皆已設定且 `EMAIL_FROM` 網域已在 Resend 驗證。

---

## 5. 參考

- [Resend SMTP 文檔](https://resend.com/docs/send-with-smtp)
- [Resend + Nodemailer](https://resend.com/docs/send-with-nodemailer-smtp)
- 後端範例變數：`backend/.env.example` 郵件區塊
