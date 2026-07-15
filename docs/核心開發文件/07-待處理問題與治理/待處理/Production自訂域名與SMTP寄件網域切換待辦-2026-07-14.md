# Production 自訂域名與 SMTP 寄件網域切換待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Namecheap DNS、Vercel main/Admin custom domain、Railway backend custom domain、Web/Admin/Mobile Production URL／origin contract、SMTP sender-domain 與 release evidence
**取證代碼入口**：`.github/workflows/production-deploy-and-verify.yml`、`scripts/ops-release-status.sh`、`scripts/ops-release-gate.sh`、`frontend/vercel.json`、`frontend-admin/vercel.json`、`frontend/src/config/env.ts`、`frontend-admin/src/config/env.ts`、`mobile/src/config/runtime.ts`、`mobile/eas.json`、`backend/src/config`、`backend/src/app.ts`、`backend/src/services/file.service.ts`
**最後核驗 Commit**：`534217d`
**最後核驗日期**：`2026-07-15`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：處理中（custom domains、canonical URL／CORS／bundle、Resend HTTPS API 與 exact-main Production release 已閉環；尚待受控 mailbox header evidence及重新產出的 Mobile Production artifact）
**Owner**：Platform / Ops
**優先級**：P1 Production evidence closure（不阻擋已發布 Web/Admin/backend）
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
| `no-reply@emorapy.com` | Resend transactional HTTPS API | OTP／transactional sender；必須完成 SPF、DKIM、DMARC 與分層 canary |

## 2026-07-14 首次正式發布失敗與修正決策

1. `Production Deploy and Verify` run `29373051702` 的 exact-main preflight 與 rollback baseline 均通過；Railway deployment `c82496f5-19d6-4af1-ae73-5b5fd6e3502d` image build 成功，但 runtime SMTP verify 持續 `TIMEOUT`，`/health/ready` 在五分鐘內未轉 ready，因此 deployment fail closed。
2. Workflow 已成功 rollback，Vercel deploy 被跳過；active backend 仍是 deployment `a6fad093-ff9b-45c5-b3c0-307c328fd92a` / commit `8e93680eb4f32c9b7f088a6518346e9738b6078a`，live／ready／health／version 均回 200，沒有前後端版本分裂。
3. Railway 官方 contract 是 Free／Trial／Hobby 禁用 outbound SMTP，且即使 Pro 可用 SMTP，仍建議 transactional email 使用 HTTPS API。因此不以升級方案或放寬 readiness 繞過，改為明確的 `EMAIL_DELIVERY_MODE=resend_api` 與 `RESEND_API_KEY` contract；SMTP adapter 保留供支援 SMTP 的環境使用。

## 2026-07-15 已核驗現況

1. `emorapy.com` 與 `emorapy.co.uk` 已在 Namecheap 完成購買，各 2 年；購買／付款細節不寫入 repo。
2. Web DNS 已完成切換；`emorapy.com` 的 Namecheap Email Forwarding 原本沒有任何 Email Redirect／Catch-All，既有 forwarding MX／SPF 只是未使用的預設值。SMTP 設定時已改為 Custom MX，移除未承接收件的 root forwarding records，改用 Resend 指定的 `send.emorapy.com` return-path MX／SPF；本輪不建立收件 mailbox，日後若需客服收件應另作 mailbox 治理。
3. `emorapy.com`、`www.emorapy.com`、`admin.emorapy.com`、`emorapy.co.uk` 與 `www.emorapy.co.uk` 已在 Vercel 生效；canonical／redirect HTTPS 行為可用，`.co.uk` redirect 以 308 保留 path/query。
4. Railway Production backend custom domain `https://api.emorapy.com` 已 ACTIVE；Railway legacy hostname繼續作 compatibility／rollback。
5. canonical URL contract 經 PR #15 合併；main push CI run `29380276179` 與 formal workflow run `29380381777` 均對 exact-main commit `534217d983a03c8db712515c709601663deef206` 成功。main/Admin/backend live version endpoint均回報該 commit，Railway active deployment `bc4b7d72-d21d-4018-9f43-a548e428ff3e` 為 SUCCESS。release-gate artifact id 為 `8329579427`，digest 為 `5c6d4610e732307bc59cafb7ce0d509052b9c194554dc18d40054887fc64c60d`。
6. Production DB 為 32 個 Prisma migrations全數 up to date；release-blocking catalog 21/21 完成，product-state audit finding 0，active smoke accounts 0。
7. Resend HTTPS API runtime readiness 與 exact-release provider canary 已通過；舊 API key 已撤銷，SPF／DKIM／DMARC 公開 DNS 可解析。受控 mailbox 的實際收件與 headers 仍需獨立 evidence，不以 provider acceptance 替代。
8. GitHub release variables、Vercel Production public env 與 Railway Production URL/origin variables 已切到 canonical values並逐項 readback；legacy Vercel/Railway origins 只保留作 compatibility／rollback，不再是正式 release default。
9. canonical main/Admin auth CORS preflight 與兩個 legacy compatibility origins 均通過；main/Admin live bundle 均包含 `https://api.emorapy.com/api/v1`，且不含 legacy Railway hostname。workflow exact-target preflight、static bundle check 與 canonical origin gate 已把原先 blind spot 轉為 fail-closed contract。
10. 本文原始工作分支 `codex/v1-5-release-backfill-hotfix` 與當時 `origin/main` 已分叉；治理變更其後經 PR #12 及 PR #15 移植、合併並由 formal workflow 發布，原始分支不作 release source。
11. `mobile/eas.json` Production profile 已宣告 `EXPO_PUBLIC_API_BASE_URL=https://api.emorapy.com/api/v1`；但尚未重新產出並驗證 EAS Production artifact，也未取得新 artifact 的登入、upload、chat/SSE、telemetry、AppState reconnect 與真機 evidence，因此 Mobile 不得宣稱完成 cutover。

## 2026-07-14 平台預配置執行證據

1. Vercel main project 已加入 `emorapy.com`；`www.emorapy.com`、`emorapy.co.uk`、`www.emorapy.co.uk` 已配置為到 `https://emorapy.com` 的 `308` Domain Redirect。Admin project 已加入 `admin.emorapy.com`。Vercel project domains API 對五個 custom domains 均回報 `verified=true`。
2. Namecheap BasicDNS 已把以下五條與 parking 衝突的 Web records 精準改為 Vercel 當次要求的 `A 76.76.21.21`：`.com` 的 `@`、`www`、`admin`，以及 `.co.uk` 的 `@`、`www`。未切 nameserver，未修改 DNSSEC、Mail Settings、既有 root MX 或 email-forwarding SPF。
3. 公開解析後續已確認五個 Web hosts 全部生效；HTTPS smoke 為 `emorapy.com=200`、`admin.emorapy.com=200`，`www.emorapy.com`、`emorapy.co.uk`、`www.emorapy.co.uk` 均回 `308` 到 `https://emorapy.com/`。
4. Railway project 已由隨機名 `ingenious-commitment` 原地 rename 為 `Emorapy`，Production service 已由 legacy `mother-bear-court` 原地 rename 為 `emorapy-api`；project/service IDs、active deployment、variables、deployment history、legacy public domain 與 rollback path 均保留，未刪除或重建資源。GitHub repo variable 已新增 `EMORAPY_RAILWAY_SERVICE_NAME=emorapy-api`，舊 `PRODUCTION_RAILWAY_SERVICE` 暫留 fallback。
5. Railway 已為同一 Production service 加入 `api.emorapy.com:8080`；Namecheap 已按 dashboard 當次輸出加入 `api` CNAME 與 `_railway-verify.api` TXT，兩條記錄均已在 Namecheap 權威 DNS 可查。後續以 Railway CLI `5.26.1` 查得 custom domain `syncStatus=ACTIVE`，`https://api.emorapy.com/version` 回報 Production deployment `a6fad093-ff9b-45c5-b3c0-307c328fd92a` / commit `8e93680eb4f32c9b7f088a6518346e9738b6078a`，`/health/ready` 回 200。Domain/TLS/runtime 已可用，但跨層 Production URL variables 與正式發布仍未切換。
6. Service private DNS 仍為 legacy `mother-bear-court.railway.internal`：Railway UI 兩次接受新值但刷新後回復。已核對 project shared variables 與 service variables 沒有該 literal 引用；此 internal-only compatibility alias 不阻擋 public cutover，也不以刪除重建解決。
7. Resend 已以正確 Chrome profile 登入，`emorapy.com`（Ireland `eu-west-1`）已完成 SPF、DKIM 與 domain verification；Namecheap 公開 DNS 可查 `send` MX／SPF、DKIM 與 `_dmarc` `p=none`。Railway Production 已以 `--skip-deploys` 寫入 email／SMTP key inventory，secrets 為 sealed write-only 且未輸出或寫入 repo。兩把新建且 dashboard 可見的 `Sending access` API key 曾在建立後最初約 25–35 分鐘被 Resend send API 回覆 `validation_error: API key is invalid`、SMTP 回 `EAUTH`，但 dashboard 沒有 pending 狀態；等待後重試，兩把 key 的 send API 均回 200，Railway 已存的第一把 key 亦通過 SMTP authentication 與 provider canary（1 accepted、0 rejected）。操作上把此視為 provider key activation delay：新 key 建立後先等待至少 30 分鐘再判定失效；目前毋須聯絡支援或輪替 Railway secret，下一個 gate 是包含 intended SHA 的 deployed runtime canary。
8. PR #12 的 private-context/safety/email contract 已合併；後續 exact-main Production 已前進至 `f3bcabe09b645e64fedc1d3570c721ee7d8bf6ee`，不再以原 PR head 作 runtime 判斷。

## 執行前已鎖定決策

1. **Release owner**：只有 `origin/main` 的 intended exact SHA 可進入 Production；所有後續 canonical URL contract 變更維持單一 consolidated PR 與 formal workflow，不建立繞過 release gate 的第二路徑。
2. **Redirect owner**：`www.emorapy.com`、`emorapy.co.uk` 與 `www.emorapy.co.uk` 使用 Vercel Domain Redirect，不作 main app serving alias；採 permanent `308` 並保留 path/query。
3. **Backend compatibility**：Railway legacy hostname 在本任務不移除；只有當 Web、Admin、Mobile 及已發布 App build 全部完成遷移後，才能另開降級任務。
4. **Email provider transport**：Production 使用 Resend HTTPS API，避免 Railway plan 的 outbound SMTP 限制；Nodemailer/SMTP adapter 只保留作其他環境的可選 transport，不作 Production fallback。
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

1. **已完成**：private-context/safety/email 變更已經單一 PR 合併並發布，沒有合併原始分叉工作分支的無關 commit。
2. **本輪要求**：canonical URL／CORS／bundle contract 仍只由 latest `origin/main` 的 exact-head CI 與 formal workflow 發布，並記錄合併後 intended SHA。
3. 只有同時包含 fail-closed email 與 canonical origin gates 的 intended SHA 可成為正式 release target。

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
3. 在 Railway secure variables 設定 `EMAIL_DELIVERY_MODE=resend_api`、`EMAIL_FROM`、`EMAIL_OTP_PEPPER`、`RESEND_API_KEY`、`EMAIL_CANARY_RECIPIENT`；只驗 key presence／masked value。既有 SMTP variables 暫留 sealed rollback evidence，但 API mode 不讀取、不 fallback。
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
2. main/Admin/backend custom domains 回報同一個 intended exact-main commit，Railway deployment identity 一致；email fail-closed 與 canonical origin contracts 均包含在該 SHA。
3. GitHub/Vercel/Railway/EAS Production variables、Web/Admin/Mobile API base、backend origin/public file URL contract 已切到 custom domains；現有 legacy origins 仍在 compatibility allowlist。
4. SMTP sender-domain verification、SPF／DKIM／DMARC、Production variables、provider acceptance、deployed runtime readiness 與 inbox delivery 全部通過。
5. `Production Deploy and Verify`、完整 release gate、docs／naming gates 通過並保存非敏感 evidence。
6. 母任務、Platform Map 與 Runbook 已回寫，legacy入口只保留為明確 compatibility／rollback。
