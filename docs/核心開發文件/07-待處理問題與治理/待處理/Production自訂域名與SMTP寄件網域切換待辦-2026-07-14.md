# Production 自訂域名與 SMTP 寄件網域切換待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Namecheap DNS、Vercel main/Admin custom domain、Railway backend custom domain、Web/Admin/Mobile Production URL／origin contract、SMTP sender-domain 與 release evidence
**取證代碼入口**：`.github/workflows/production-deploy-and-verify.yml`、`scripts/ops-release-status.sh`、`scripts/ops-release-gate.sh`、`frontend/vercel.json`、`frontend-admin/vercel.json`、`frontend/src/config/env.ts`、`frontend-admin/src/config/env.ts`、`mobile/src/config/runtime.ts`、`mobile/eas.json`、`backend/src/config`、`backend/src/app.ts`、`backend/src/services/file.service.ts`
**最後核驗 Commit**：`0903d4f`
**最後核驗日期**：`2026-07-14`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：處理中（Vercel 與 Web DNS 已預配置；Railway custom domain、SMTP、跨層 URL contract 與正式發布尚未完成）
**Owner**：Platform / Ops
**優先級**：P0 Production release blocker
**母任務**：[Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md](./Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md)

## 決策與目標拓撲

本任務採一次受控 cutover，不購買或引入 Namecheap Hosting、PremiumDNS、付費 SSL 或網站建立服務。DNS 暫由 Namecheap BasicDNS 承接；Vercel 與 Railway 自動簽發 TLS。所有平台先加 domain、取得平台實際要求的 DNS records，再修改 DNS，不在文件硬編可能變動的 target 值。

| 對外入口 | 目標 | 正式行為 |
| --- | --- | --- |
| `emorapy.com` | Vercel `emorapy` main project | 主站 canonical origin |
| `www.emorapy.com` | Vercel `emorapy` main project | HTTPS 308 到 `https://emorapy.com` |
| `admin.emorapy.com` | Vercel `emorapy-admin` project | Admin Web 正式入口 |
| `api.emorapy.com` | Railway Production backend service | Backend API 正式入口 |
| `emorapy.co.uk`、`www.emorapy.co.uk` | Vercel HTTPS redirect | 308 到 `https://emorapy.com`，不提供第二份 canonical 內容 |
| `no-reply@emorapy.com` | Resend transactional SMTP（首發選定） | OTP／transactional sender；必須完成 SPF、DKIM、DMARC 與分層 canary |

## 2026-07-14 已核驗現況

1. `emorapy.com` 與 `emorapy.co.uk` 已在 Namecheap 完成購買，各 2 年；購買／付款細節不寫入 repo。
2. 兩個 apex domain 仍解析到 Namecheap parking，`www` 仍指向 `parkingpage.namecheap.com`；尚未承接正式流量。兩個 root 同時存在 Namecheap email forwarding MX 與 `v=spf1 include:spf.efwd.registrar-servers.com ~all` TXT，不得在網頁 DNS 切換時誤刪。
3. 當次 Vercel CLI account domain inventory 為 `0 Domains`；main/Admin 仍由 `https://emorapy.vercel.app` 與 `https://emorapy-admin.vercel.app` 提供服務。
4. Railway Production backend custom domains 為空，正式流量仍由 `https://mother-bear-court-production.up.railway.app` 承接。
5. 三個 live version endpoint 均回報 Production commit `8e93680eb4f32c9b7f088a6518346e9738b6078a`；PR #12 核驗基準為 `2825e54`，不得把 candidate 誤寫成 Production。
6. GitHub repo variables 已有 `EMORAPY_MAIN_WEB_URL=https://emorapy.vercel.app`、`EMORAPY_ADMIN_WEB_URL=https://emorapy-admin.vercel.app`；`PRODUCTION_BACKEND_BASE_URL` 仍是 legacy Railway hostname。
7. Railway Production 當次 key inventory 未發現 `EMAIL_*` 或 `SMTP_*` variables；SMTP release gate 仍未滿足。
8. Draft PR [#12](https://github.com/Alex0158/emorapy/pull/12) 以 `origin/main=8e93680` 為 base，exact head `2825e54ce533d65cff6637a0711b3573c68c368f` 的 7 個 CI jobs 已通過；但尚未合併，因此其 SMTP fail-closed contract 不是當前 Production 行為。
9. 本文原始工作分支 `codex/v1-5-release-backfill-hotfix` 與 `origin/main` 已分叉；治理變更已改為移植到以 `origin/main=8e93680` 為 base 的 PR #12，原始分支不作 release source。
10. Mobile runtime 會從 `EXPO_PUBLIC_API_BASE_URL` 或 Expo extra 讀取 API base，但 `mobile/eas.json` Production profile 尚未宣告該值；新 API domain 不能只切 Web/Admin。

## 2026-07-14 平台預配置執行證據

1. Vercel main project 已加入 `emorapy.com`；`www.emorapy.com`、`emorapy.co.uk`、`www.emorapy.co.uk` 已配置為到 `https://emorapy.com` 的 `308` Domain Redirect。Admin project 已加入 `admin.emorapy.com`。Vercel project domains API 對五個 custom domains 均回報 `verified=true`。
2. Namecheap BasicDNS 已把以下五條與 parking 衝突的 Web records 精準改為 Vercel 當次要求的 `A 76.76.21.21`：`.com` 的 `@`、`www`、`admin`，以及 `.co.uk` 的 `@`、`www`。未切 nameserver，未修改 DNSSEC、Mail Settings、既有 root MX 或 email-forwarding SPF。
3. 修改後首次公開查詢已確認 `emorapy.com`、`www.emorapy.com`、`admin.emorapy.com` 解析為 `76.76.21.21`；`emorapy.co.uk` 與 `www.emorapy.co.uk` 的 Namecheap 權威 DNS 當時仍回傳舊 parking records，處於原 `30 min` TTL 的傳播窗口，不視為已完成。
4. HTTPS 首輪 smoke：`https://emorapy.com` 回 `200`；`https://www.emorapy.com` 回 `308` 並指向 `https://emorapy.com/`。`admin.emorapy.com` 及兩個 `.co.uk` host 當時尚未完成 TLS／DNS 生效，仍須重試驗證。
5. Railway CLI session 已失效；Chrome fallback 可到 Railway，但 GitHub OAuth 要求重新登入。因平台尚未回傳 `api.emorapy.com` 的 exact CNAME／ownership TXT，未在 Namecheap 猜測或新增 backend records。
6. Resend 帳戶尚未登入；sender domain、SPF／DKIM／DMARC、Railway SMTP secrets 與三層 email canary 均未開始。下一個外部介入點是完成 GitHub／Railway 與 Resend authentication；任何 credentials 不寫入 repo 或 evidence。
7. PR #12 exact head 已更新為 `0903d4f609c16f27559dd24df47b5c1edb4f90cd`，7 個 CI jobs 全綠；PR 仍為 draft、未合併，Production commit 仍是 `8e93680eb4f32c9b7f088a6518346e9738b6078a`。

## 執行前已鎖定決策

1. **Release owner**：只有 `origin/main` 的 intended exact SHA 可進入 Production。本文變更先移植到 latest `origin/main`；PR #12 必須保持單一 consolidated candidate，不再分拆另一個繞過 SMTP gate 的 release path。
2. **Redirect owner**：`www.emorapy.com`、`emorapy.co.uk` 與 `www.emorapy.co.uk` 使用 Vercel Domain Redirect，不作 main app serving alias；採 permanent `308` 並保留 path/query。
3. **Backend compatibility**：Railway legacy hostname 在本任務不移除；只有當 Web、Admin、Mobile 及已發布 App build 全部完成遷移後，才能另開降級任務。
4. **SMTP provider**：首發選用 Resend SMTP，原因是現有 backend 已使用 Nodemailer/SMTP contract，無需再建 provider-specific delivery adapter；先使用免費額度，超出後再以真實發送量升級。
5. **Email identity**：Visible From 為 `no-reply@emorapy.com`；provider Return-Path 使用其驗證後的 `send.emorapy.com` 或當次 dashboard 指定值。`EMAIL_FROM` 只存 plain email address，display name 由代碼控制。Reply-To/support mailbox 不阻擋本次 OTP 發布，日後另作客服收件治理。
6. **DNS change boundary**：本次不切 nameserver、不購買 PremiumDNS/SSL/Hosting、不同輪啟用 DNSSEC、不新增限制性 CAA，也不做 CDN 或 mailbox suite 遷移。

## 執行邊界

1. 保留現有 `*.vercel.app` 與 Railway legacy hostname 作 rollback／compatibility 入口，直到 custom domains、TLS、runtime、SMTP canary 與完整 release gate 全部通過。
2. 不在 repo、terminal transcript、workflow artifact 或本文保存 DNS provider token、SMTP credential、付款資訊或完整 secret value。
3. 不先改 GitHub Production URL variables；先讓新 domain 作 alias 通過 live verification，再切正式入口。
4. 不用 Namecheap URL forwarding 承接 `.co.uk` canonical redirect；redirect 必須在可驗證 HTTPS 與 status code 的平台層完成。
5. 不把「DNS 已解析」「TLS 已簽發」或「Vercel Ready」單獨寫成整體發布完成；仍需 exact-main Production workflow 與 release gate。
6. 若 origin、CORS、email 或 redirect contract 需要改 code，必須同步正式 runbook／規格與 focused tests；不得用平台臨時 workaround 隱藏 contract drift。當前 auth 主鏈路為 token-based；執行時先查有無 production cookie-domain contract，無則記錄為不適用，不為假設中的 cookie 擴 scope。
7. DNS rollback 只能恢復預先保存的 exact record snapshot；DNS 受 TTL／resolver cache 影響，不得宣稱即時 rollback。

## 執行順序

### Phase -1：Release source 與依賴收斂

1. **已完成**：本文及相關索引已移植到以 latest `origin/main` 為 base 的 PR #12 worktree，沒有合併原始分叉工作分支的無關 commit。
2. 以 PR #12 為唯一 private-context/safety/email release candidate，確認其 base 仍是 latest `main`、exact-head CI 全綠，並記錄合併後 intended SHA。
3. 只有包含 SMTP fail-closed gate 與本任務必要 contract 的 intended SHA 可切正式流量；platform domain 可先預配置，但不得先改 Production URL variables。

### Phase 0：Baseline 與平台預配置

1. 記錄 main/Admin/backend 當前 live commit、Vercel deployment ids、Railway active `SUCCESS` deployment id、GitHub URL variables，並對兩個 domain 保存 A、AAAA、CNAME、MX、TXT、CAA、NS、DS 的 exact DNS snapshot。
2. 在 Vercel main project 加入 `emorapy.com`；`www.emorapy.com`、`emorapy.co.uk`、`www.emorapy.co.uk` 以 Domain Redirect 配置，不作 SPA serving alias。在 Admin project 加入 `admin.emorapy.com`。
3. 在 Railway Production backend 加入 `api.emorapy.com`，保存平台當次回傳的 CNAME 與 ownership TXT；當次平台若回傳其他 record，以平台實際要求為準。
4. 只採用平台當次回傳的 DNS target／verification records，先不切 GitHub variables。

### Phase 1：Namecheap DNS 與 Web TLS

1. 按 Vercel／Railway 回傳值修改最小必要 A／CNAME／TXT records；只移除與新 target 衝突的 Namecheap parking A/CNAME，保留已有 MX/TXT，不改 nameserver，不啟用付費附加服務。
2. 等待 apex、`www`、`admin`、`api` 與 `.co.uk` records 公開解析，確認 Vercel／Railway domain verification 與 TLS 均為有效狀態。
3. 將 `www.emorapy.com` 與兩個 `.co.uk` host 設為 HTTPS `308` redirect；以 root 及含 path/query 的實際 HTTP status 與 `Location` 驗證，不只看 dashboard。
4. 核對公開解析不存在殘留 AAAA 或限制 TLS issuer 的 CAA；切換期間不同時啟用 DNSSEC。

### Phase 2：Backend 與跨層 URL contract

1. 以 `https://api.emorapy.com/version`、`/health/live`、`/health/ready` 驗證同一個 Railway active deployment。
2. 以下列為必查 URL/environment matrix；只在新 API domain 已可用後切換：

   | Surface | Key | 目標值／邊界 |
   | --- | --- | --- |
   | Vercel main/Admin | `VITE_API_BASE_URL` | `https://api.emorapy.com/api/v1`，必須包含 `/api/v1` |
   | Vercel Admin | `VITE_FRONTEND_BASE_URL` | `https://emorapy.com` |
   | GitHub release workflow | `EMORAPY_BACKEND_BASE_URL` / `PRODUCTION_BACKEND_BASE_URL` | `https://api.emorapy.com`，不含 `/api/v1`；實際使用哪個 key 以 current workflow 為準並清理雙 key drift |
   | Railway backend | `FRONTEND_URL` | `https://emorapy.com` |
   | Railway backend | `FILE_BASE_URL` | `https://api.emorapy.com`；驗證新上傳 URL 與既有 legacy URL 均可用 |
   | Railway backend | `ALLOWED_ORIGINS` | 相容期同時包含 `https://emorapy.com`、`https://admin.emorapy.com`、`https://emorapy.vercel.app`、`https://emorapy-admin.vercel.app` |
   | Railway ops | `OPS_ALERTS_API_BASE_URL` / `ALERT_HEALTH_ORIGIN` | 先核對用途；若有設定，必須是切換後仍可用的 API/origin |
   | EAS Mobile | `EXPO_PUBLIC_API_BASE_URL` | `https://api.emorapy.com/api/v1`；必須進入 Production channel/build 實際 bundle |

3. 將 `EMORAPY_MAIN_WEB_URL`、`EMORAPY_ADMIN_WEB_URL` 更新為 custom domains；保留 legacy variables／aliases，本任務不刪除。
4. 確認 Mobile 的 URL 是 build-time 還是可透過 EAS Update 發佈；發布後驗證登入、upload、chat/SSE、telemetry 與 AppState reconnect。已安裝舊 build 在完成遷移或結束明確 sunset window 前，繼續依賴 Railway legacy hostname。

### Phase 3：SMTP sender-domain

1. 在 Resend 建立帳號，加入並驗證 `emorapy.com`；帳號登入、email verification、CAPTCHA 或付款由使用者介入，API key 只存 Railway secure variables。
2. 在 Namecheap 加入 Resend 當次 dashboard 要求的最小 SPF/return-path、DKIM records，並以 `_dmarc.emorapy.com` `p=none` 起步；保留現有 root MX/TXT，不在同一 hostname 建立第二條 SPF。
3. 在 Railway secure variables 設定 `EMAIL_DELIVERY_MODE=smtp`、`EMAIL_FROM`、`EMAIL_OTP_PEPPER`、`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_SECURE` 或 `SMTP_REQUIRE_TLS`、`EMAIL_CANARY_RECIPIENT`；只驗 key presence／masked value。
4. Email 驗收分成三層，不得互相替代：
   1. **Provider acceptance**：workflow runner 使用 Production Railway variables 寄送，provider 接受；這不證明 deployed process 執行或 inbox delivery。
   2. **Deployed runtime readiness**：Production runtime 啟動後 transport verify/readiness 通過，並無 console/mock fallback。
   3. **Inbox delivery**：`EMAIL_CANARY_RECIPIENT` 的受控 mailbox 實際收件，核對 From、SPF、DKIM、DMARC 與 provider event/log。

### Phase 4：正式發布與收口

1. 所有 repo 內 contract 變更先走單一 consolidated PR、exact-main CI，再由 `Production Deploy and Verify` 發布；不以本地 branch 直接覆蓋 Production。
2. 重跑 main/Admin/backend version、static bundle API-base、health／ready、DB parity、mutating smoke、SMTP canary 與 `ops:release:gate:evidence`。
3. 通過後回寫 `AGENTS.md` Platform Map、運維 Runbook、GitHub variables 與 P4 母任務；將 legacy URLs 明確降級為 compatibility／rollback，而非立即刪除。

## 驗證命令

```bash
dig +short emorapy.com A
dig +short emorapy.com AAAA
dig +short emorapy.com MX
dig +short emorapy.com TXT
dig +short emorapy.com CAA
dig +short emorapy.com DS
dig +short www.emorapy.com CNAME
dig +short admin.emorapy.com CNAME
dig +short api.emorapy.com CNAME
curl -fsS https://emorapy.com/version.json
curl -fsSI https://www.emorapy.com
curl -fsSI https://emorapy.co.uk
curl -fsSI 'https://emorapy.co.uk/help?source=cutover'
curl -fsS https://api.emorapy.com/version
curl -fsS https://api.emorapy.com/health/ready
EMORAPY_MAIN_WEB_URL=https://emorapy.com \
EMORAPY_ADMIN_WEB_URL=https://admin.emorapy.com \
EMORAPY_BACKEND_BASE_URL=https://api.emorapy.com \
npm run ops:release:status
EXPO_PUBLIC_API_BASE_URL=https://api.emorapy.com/api/v1 npm --prefix mobile run smoke:true-service
npm --prefix mobile run release:completion:audit
npm run naming:check
npm run docs:audit:dry-run:current
npm run docs:check
```

完整 Production closure 仍須由正式 workflow 執行 `ops:release:gate:evidence`；本文件不保存 production secrets，也不把上述公開 endpoint smoke 代替完整 gate。

## 停止與回滾條件

1. 任一 domain verification、TLS、redirect、CORS、static bundle/Mobile API base、SMTP 三層驗收或 version identity 不一致時停止切換。
2. 若新入口不可用，先把 GitHub/Vercel/EAS URL variables 與前端 API base 指回已驗證的 `*.vercel.app`／Railway legacy hostname，再依 baseline snapshot 恢復相應 DNS；不得在故障中刪除既有 aliases。DNS 恢復仍需等待 TTL，不作即時回滾承諾。
3. SMTP 失敗時保持 fail-closed，不得切回 console／mock delivery 來宣稱 Production 完成。
4. 若 DNS target 與本文示例或歷史記錄不同，以 Vercel／Railway／SMTP provider 當次驗證頁輸出為準，不猜測 target。

## 完成條件

只有以下全部成立，才可把本文件移入 `已處理/`：

1. 六個 public hosts 的 DNS、TLS、canonical／redirect 行為符合目標拓撲。
2. main/Admin/backend custom domains 回報同一個 intended exact-main commit，Railway deployment identity 一致；PR #12 的 SMTP fail-closed contract 已包含在該 SHA。
3. GitHub/Vercel/Railway/EAS Production variables、Web/Admin/Mobile API base、backend origin/public file URL contract 已切到 custom domains；現有 legacy origins 仍在 compatibility allowlist。
4. SMTP sender-domain verification、SPF／DKIM／DMARC、Production variables、provider acceptance、deployed runtime readiness 與 inbox delivery 全部通過。
5. `Production Deploy and Verify`、完整 release gate、docs／naming gates 通過並保存非敏感 evidence。
6. 母任務、Platform Map 與 Runbook 已回寫，legacy入口只保留為明確 compatibility／rollback。
