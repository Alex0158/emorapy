export type BackendLocale = 'zh-TW' | 'en-US';

const zhTWByCode: Record<string, string> = {
  UNAUTHORIZED: '未認證',
  FORBIDDEN: '無權限',
  TOKEN_EXPIRED: 'Token已過期',
  INVALID_CREDENTIALS: '郵箱或密碼錯誤',
  VALIDATION_ERROR: '驗證失敗',
  INVALID_EMAIL: '郵箱格式錯誤',
  WEAK_PASSWORD: '密碼強度不足',
  INVALID_CODE: '驗證碼錯誤',
  CODE_EXPIRED: '驗證碼已過期',
  SESSION_ID_REQUIRED: 'Session ID是必需的',
  INVALID_SESSION_ID: '無效的Session ID格式',
  SESSION_EXPIRED: 'Session已過期或不存在',
  NOT_FOUND: '資源不存在',
  EMAIL_EXISTS: '郵箱已存在',
  ALREADY_PAIRED: '已經有配對關係',
  CONFLICT: '資源衝突',
  CASE_NOT_READY: '案件尚未準備好',
  JUDGMENT_EXISTS: '判決已存在',
  FILE_TOO_LARGE: '文件過大',
  INVALID_FILE_TYPE: '文件類型不支持',
  TOO_MANY_FILES: '已達到文件數量上限',
  CASE_NOT_EDITABLE: '案件狀態不允許此操作',
  JUDGMENT_FAILED: '判決生成失敗，請稍後重試',
  INTERNAL_ERROR: '服務器內部錯誤',
  AI_SERVICE_ERROR: 'AI服務錯誤',
  DATABASE_ERROR: '數據庫錯誤',
  EXTERNAL_SERVICE_ERROR: '外部服務錯誤',
  RATE_LIMIT_EXCEEDED: '請求過於頻繁，請稍後再試',
  INVALID_JSON: '無效的JSON請求體',
  METHOD_NOT_ALLOWED: '僅支持 GET/HEAD 訪問文件',
  CONSENT_REQUIRED: '需要心理畫像同意',
  CONCURRENT_REQUEST: '已有進行中的請求',
  AI_CALL_FAILED: 'AI 調用失敗',
  MAX_TURNS_REACHED: '已達最大對話輪數',
  TURN_TOO_FAST: '回覆過快，請稍候',
  START_RATE_LIMIT: '開始訪談過於頻繁',
  PROCESSING_NOT_DONE: '處理尚未完成',
  PROCESSING_FAILED: '處理失敗',
  SESSION_COMPLETED: '此訪談已結束，不可繼續',
  JUDGMENT_STREAM_TIMEOUT: 'AI 服務響應超時，請稍後再試',
  JUDGMENT_STREAM_FAILED: 'AI 服務暫時不可用，請稍後重試',
  CHAT_AI_STREAM_FAILED: 'AI 回覆暫時失敗，請稍後再試',
  REPLAN_FAILED: 'AI 重調失敗',
};

const enUSByCode: Record<string, string> = {
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  TOKEN_EXPIRED: 'Token has expired',
  INVALID_CREDENTIALS: 'Invalid email or password',
  VALIDATION_ERROR: 'Validation failed',
  INVALID_EMAIL: 'Invalid email format',
  WEAK_PASSWORD: 'Password is too weak',
  INVALID_CODE: 'Invalid verification code',
  CODE_EXPIRED: 'Verification code has expired',
  SESSION_ID_REQUIRED: 'Session ID is required',
  INVALID_SESSION_ID: 'Invalid Session ID format',
  SESSION_EXPIRED: 'Session has expired or does not exist',
  NOT_FOUND: 'Resource not found',
  EMAIL_EXISTS: 'Email already exists',
  ALREADY_PAIRED: 'Already paired',
  CONFLICT: 'Resource conflict',
  CASE_NOT_READY: 'Case is not ready',
  JUDGMENT_EXISTS: 'Analysis already exists',
  FILE_TOO_LARGE: 'File is too large',
  INVALID_FILE_TYPE: 'Unsupported file type',
  TOO_MANY_FILES: 'Too many files',
  CASE_NOT_EDITABLE: 'Case status does not allow this action',
  JUDGMENT_FAILED: 'Analysis generation failed, please retry later',
  INTERNAL_ERROR: 'Internal server error',
  AI_SERVICE_ERROR: 'AI service error',
  DATABASE_ERROR: 'Database error',
  EXTERNAL_SERVICE_ERROR: 'External service error',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  INVALID_JSON: 'Invalid JSON request body',
  METHOD_NOT_ALLOWED: 'Only GET/HEAD is allowed for file access',
  CONSENT_REQUIRED: 'Psychological profile consent is required',
  CONCURRENT_REQUEST: 'A request is already in progress',
  AI_CALL_FAILED: 'AI call failed',
  MAX_TURNS_REACHED: 'Maximum conversation turns reached',
  TURN_TOO_FAST: 'Replying too fast, please wait',
  START_RATE_LIMIT: 'Starting interviews too frequently',
  PROCESSING_NOT_DONE: 'Processing is not yet complete',
  PROCESSING_FAILED: 'Processing failed',
  SESSION_COMPLETED: 'This interview has ended and cannot continue',
  JUDGMENT_STREAM_TIMEOUT: 'AI service timed out. Please try again later.',
  JUDGMENT_STREAM_FAILED: 'AI service is temporarily unavailable. Please try again later.',
  CHAT_AI_STREAM_FAILED: 'AI reply failed. Please try again later.',
  REPLAN_FAILED: 'AI adjustment failed',
};

const directEnUSMap: Record<string, string> = {
  '不允許的來源': 'Origin is not allowed',
  '資源已存在': 'Resource already exists',
  '服務器內部錯誤，請稍後再試': 'Internal server error, please try again later',
  '請求過於頻繁，請稍後再試': 'Too many requests, please try again later',
  '認證請求過於頻繁，請稍後再試': 'Too many auth requests, please try again later',
  '註冊請求過於頻繁，請稍後再試': 'Too many registration requests, please try again later',
  '驗證碼發送過於頻繁，請稍後再試': 'Verification code requests are too frequent, please try again later',
  'AI服務請求過於頻繁，請稍後再試': 'AI requests are too frequent, please try again later',
  '文件上傳過於頻繁，請稍後再試': 'Upload requests are too frequent, please try again later',
  '訪問過於頻繁，請稍後再試': 'Access requests are too frequent, please try again later',
  '註冊成功，請查收驗證郵件': 'Registration successful, please check your verification email',
  '登錄成功': 'Login successful',
  '驗證碼已發送': 'Verification code has been sent',
  '郵箱驗證成功': 'Email verified successfully',
  '重置密碼郵件已發送': 'Password reset email has been sent',
  '密碼重置成功': 'Password reset successful',
  '帳號未激活': 'Account is not active',
  '請先完成郵箱驗證': 'Please complete email verification first',
  '請稍後再試': 'Please try again later',
  '未提供認證Token': 'Authentication token was not provided',
  '用戶不存在或未激活': 'User does not exist or is not active',
  'Token已失效，請重新登入': 'Token is no longer valid. Please log in again.',
  'Token無效': 'Token is invalid',
  'Token驗證失敗': 'Token verification failed',
  '訪問被拒絕': 'Access denied',
  '生產環境不允許公開訪問上傳資源': 'Public access to uploaded resources is not allowed in production',
  '公開模式僅允許讀取請求': 'Public mode only allows read requests',
  '當前文件路徑未在 PUBLIC_UPLOAD_PATHS 白名單': 'Current file path is not in the PUBLIC_UPLOAD_PATHS allowlist',
  '簽名已失效': 'Signature is no longer valid',
  '未授權的資源訪問': 'Unauthorized resource access',
  '未提供管理員認證 Token': 'Admin authentication token was not provided',
  '管理員帳號不存在或未啟用': 'Admin account does not exist or is not enabled',
  '管理員 Token 已失效，請重新登入': 'Admin token is no longer valid. Please log in again.',
  '管理員 JWT 過期時間配置缺失': 'Admin JWT expiry configuration is missing',
  '管理員 JWT 配置缺失': 'Admin JWT configuration is missing',
  '管理員 Token 已過期': 'Admin token has expired',
  '管理員 Token 無效': 'Admin token is invalid',
  '管理員未認證': 'Admin is not authenticated',
  '管理員權限不足': 'Admin permission is insufficient',
  'limit/offset 必須為數字': 'limit/offset must be numeric',
  'from 必須為合法 ISO 日期': 'from must be a valid ISO date',
  'to 必須為合法 ISO 日期': 'to must be a valid ISO date',
  'from 不可晚於 to': 'from cannot be later than to',
  'maxRows 必須為數字': 'maxRows must be numeric',
  'includeRunning 必須為 boolean': 'includeRunning must be boolean',
  'source 必須為 live/archive/all': 'source must be live/archive/all',
  'email/password/name 為必填': 'email, password, and name are required',
  'email/password 為必填': 'email and password are required',
  '任務不存在或不支援手動觸發': 'Task does not exist or does not support manual triggering',
  'config key 為必填': 'config key is required',
  '敏感基礎密鑰不可由後台配置管理': 'Sensitive base secrets cannot be managed from the admin console',
  '該配置 key 不在後台可管理白名單': 'This config key is not in the admin-managed allowlist',
  '使用者不存在': 'User not found',
  'action 必須是 lock/unlock/deactivate/activate': 'action must be lock/unlock/deactivate/activate',
  '通知不存在': 'Notification not found',
  '人工恢復任務不存在': 'Manual recovery task not found',
  'rules 必須為陣列': 'rules must be an array',
  'flags 必須為 object': 'flags must be an object',
  'streamId 為必填': 'streamId is required',
  'AI Stream 不存在': 'AI Stream not found',
  '未知的 AI stream scopeType': 'Unknown AI stream scopeType',
  '管理員帳號已存在，請改用登入': 'Admin account already exists. Please log in instead',
  '生產環境必須配置 ADMIN_BOOTSTRAP_TOKEN': 'ADMIN_BOOTSTRAP_TOKEN must be configured in production',
  '缺少 ADMIN_BOOTSTRAP_TOKEN 配置': 'ADMIN_BOOTSTRAP_TOKEN configuration is missing',
  'Bootstrap token 不正確': 'Bootstrap token is incorrect',
  '管理員密碼至少 10 碼': 'Admin password must be at least 10 characters',
  '管理員角色不存在': 'Admin role not found',
  '管理員帳號或密碼錯誤': 'Invalid admin account or password',
  '管理員不存在': 'Admin not found',
  '不可停用自己的管理員帳號': 'You cannot deactivate your own admin account',
  '不可自行變更角色': 'You cannot change your own role',
  '系統至少需保留一位啟用中的 super_admin': 'The system must keep at least one active super_admin',
  '不可刪除自己的管理員帳號': 'You cannot delete your own admin account',
  'feature.flags 必須為 object': 'feature.flags must be an object',
  'feature.flags keys 不可超過 200': 'feature.flags cannot have more than 200 keys',
  'feature.flags key 不可為空字串': 'feature.flags keys cannot be empty strings',
  'media.providers 必須是 object': 'media.providers must be an object',
  '密碼過於簡單，請使用更複雜的密碼': 'Password is too weak, please choose a stronger password',
  '密碼長度至少8位': 'Password must be at least 8 characters',
  '密碼長度不能超過128位': 'Password cannot exceed 128 characters',
  '密碼必須包含字母': 'Password must contain letters',
  '密碼必須包含數字': 'Password must contain numbers',
  'Session創建成功': 'Session created successfully',
  'Session刷新成功': 'Session refreshed successfully',
  'Session創建失敗': 'Session creation failed',
  '案件已提交，AI正在分析中...': 'Case submitted, AI is analyzing...',
  '案件已提交': 'Case submitted',
  '案件不存在': 'Case not found',
  '案件創建失敗，請稍後再試': 'Case creation failed, please try again later',
  '配對關係未激活': 'Pairing is not active',
  '無權限訪問此配對': 'You do not have permission to access this pairing',
  '正式案件 mode 只能是 remote 或 collaborative': 'Formal case mode must be remote or collaborative',
  '協作模式需同時提供雙方陳述': 'Collaborative mode requires both statements',
  '無權限提交此案件': 'You do not have permission to submit this case',
  '案件狀態不允許提交': 'Case status does not allow submission',
  '遠程/協作模式需等待回應方陳述後才能提交': 'Remote/collaborative mode must wait for the partner statement before submission',
  '無權限更新此案件': 'You do not have permission to update this case',
  '案件狀態不允許更新': 'Case status does not allow updates',
  '只有發起方可以修改發起方陳述': 'Only the initiator can edit the initiator statement',
  '只有回應方可以修改回應方陳述': 'Only the partner can edit the partner statement',
  '無權限訪問此案件': 'You do not have permission to access this case',
  '協作案件不存在': 'Collaborative case not found',
  'Session 不匹配': 'Session does not match',
  '角色A陳述不能為空': 'Role A statement cannot be empty',
  '判決生成中，請稍後再試': 'Analysis is being generated, please try again later',
  '案件已更新': 'Case updated',
  '判決已生成': 'Analysis generated',
  '無權限生成梳理結果': 'You do not have permission to generate this Analysis',
  '請稍後再重試生成梳理結果': 'Please wait before retrying Analysis generation',
  '梳理結果不存在': 'Analysis not found',
  '無權限修復此梳理結果': 'You do not have permission to repair this Analysis',
  '無權限提交此梳理結果指標': 'You do not have permission to submit metrics for this Analysis',
  '無權限訪問此梳理結果': 'You do not have permission to access this Analysis',
  '梳理結果生成失敗，請點擊重試': 'Analysis generation failed. Please click retry',
  '無權限操作此梳理結果': 'You do not have permission to operate on this Analysis',
  '責任分比例必須為非負且總和 100': 'Responsibility ratios must be non-negative and sum to 100',
  '無效的責任分比例格式': 'Invalid responsibility ratio format',
  '郵箱格式錯誤': 'Email format is invalid',
  '密碼不能為空': 'Password cannot be empty',
  '責任分比例必須是數字': 'Responsibility ratio must be numeric',
  '責任分比例不能為負數': 'Responsibility ratio cannot be negative',
  '責任分比例總和必須為100%': 'Responsibility ratios must sum to 100%',
  '回饋內容過短': 'Feedback is too short',
  'AI服務響應超時，請稍後再試': 'AI service timed out. Please try again later.',
  'AI服務暫時不可用，請稍後重試': 'AI service is temporarily unavailable. Please try again later.',
  'AI返回空內容': 'AI returned empty content',
  'AI服務認證失敗': 'AI service authentication failed',
  'AI服務暫時不可用': 'AI service is temporarily unavailable',
  '今日AI服務調用已達上限': 'Today AI service usage limit has been reached',
  '無法解析AI響應': 'Unable to parse AI response',
  'AI響應格式無效（非陣列）': 'Invalid AI response format (not an array)',
  '無法解析 AI 重調結果': 'Unable to parse AI adjustment result',
  '和好方案已生成': 'Reconciliation plans generated',
  '方案已選擇': 'Plan selected',
  '邀請碼已生成': 'Invite code generated',
  '配對成功': 'Pairing successful',
  '配對已解除': 'Pairing removed',
  '無法生成唯一邀請碼': 'Unable to generate a unique invite code',
  '邀請碼無效': 'Invalid invite code',
  '邀請碼已過期': 'Invite code has expired',
  '邀請碼已使用': 'Invite code has already been used',
  '不能與自己配對': 'You cannot pair with yourself',
  '當前沒有可解除的配對': 'There is no active pairing to cancel',
  '無權限解除此配對': 'You do not have permission to cancel this pairing',
  '臨時配對數量達到上限，請稍後重試': 'Temporary pairing limit reached, please try again later',
  '資料更新成功': 'Profile updated successfully',
  '頭像更新成功': 'Avatar updated successfully',
  '用戶不存在': 'User not found',
  '沒有可更新的字段': 'No updatable fields were provided',
  '頭像域名不被允許': 'Avatar domain is not allowed',
  '頭像URL格式無效': 'Avatar URL format is invalid',
  '缺少頭像文件': 'Avatar file is missing',
  '頭像僅支持圖片格式': 'Avatar only supports image files',
  '個人背景已更新': 'Background profile updated',
  '關係檔案已更新': 'Relationship profile updated',
  '配對不存在': 'Pairing not found',
  '無權訪問此配對檔案': 'You do not have permission to access this pairing profile',
  '請求體必須為 JSON 對象': 'Request body must be a JSON object',
  '已同意心理畫像知情同意': 'Psychological profile consent recorded',
  '心理畫像相關資料已刪除': 'Psychological profile data deleted',
  '通知已記錄': 'Notification recorded',
  '已將通知標記為已讀': 'Notifications marked as read',
  '已封存這則通知': 'Notification archived',
  '已稍後提醒這則通知': 'Notification snoozed',
  '已處理這則通知': 'Notification processed',
  'Push token 已記錄': 'Push token recorded',
  'Push token 已撤銷': 'Push token revoked',
  '執行已確認': 'Execution confirmed',
  '打卡成功': 'Check-in successful',
  '已關聯內容': 'Content linked',
  '內容不存在': 'Content not found',
  '需要認證': 'Authentication is required',
  'case_id、content_id 為必填': 'case_id and content_id are required',
  '證據上傳成功': 'Evidence uploaded successfully',
  '證據已刪除': 'Evidence deleted',
  'Header 與 Query 的 Session ID 不一致': 'Header and query Session ID do not match',
  '無權限上傳證據': 'You do not have permission to upload evidence',
  '案件狀態不允許上傳證據': 'The case status does not allow evidence upload',
  '請選擇要上傳的文件': 'Please select a file to upload',
  '證據安全聲明未通過': 'Evidence safety assertion was not accepted',
  '每個案件最多只能上傳3張圖片': 'Each case can have at most 3 uploaded images',
  '證據不存在': 'Evidence not found',
  '無權限刪除此證據': 'You do not have permission to delete this evidence',
  '證據URL必須是數組': 'Evidence URLs must be an array',
  '最多只能上傳3張圖片': 'You can upload at most 3 images',
  '聊天室已建立': 'Chat room created',
  '邀請已發送': 'Invite sent',
  '已加入聊天室': 'Joined chat room',
  '已拒絕邀請': 'Invite declined',
  '已發起判決': 'Analysis requested',
  '已離開聊天室': 'Left chat room',
  '已移除 B 方': 'Side B removed',
  '訊息已發送': 'Message sent',
  '訊息發送過於頻繁，請稍後再試': 'Messages are being sent too frequently, please try again later',
  '匿名聊天室缺少 session_id，無法轉梳理結果': 'Anonymous chat room is missing session_id and cannot be converted to an Analysis',
  '未登入用戶需要提供有效 session': 'Signed-out users must provide a valid session',
  'Session ID 格式無效': 'Invalid Session ID format',
  '你沒有該聊天室權限': 'You do not have permission to access this chat room',
  '只有發起方可發送邀請': 'Only the initiator can send invites',
  '當前狀態不可邀請新成員': 'The current status does not allow inviting new members',
  '聊天室已有 B 方成員，無需重複邀請': 'This chat room already has a Side B member. No repeat invite is needed',
  '邀請發送過於頻繁，請稍後再試': 'Invites are being sent too frequently, please try again later',
  '對方剛婉拒邀請，請先留一些時間再重試': 'The other person just declined the invite. Please wait before trying again',
  '聊天室狀態已變更，請重試邀請': 'Chat room status changed. Please retry the invite',
  '無法生成唯一邀請碼，請稍後重試': 'Unable to generate a unique invite code. Please try again later',
  '接受邀請需要登入帳號': 'Log in to accept the invite',
  '邀請不存在': 'Invite not found',
  '邀請碼不存在': 'Invite code not found',
  '邀請碼不可用': 'Invite code is unavailable',
  '聊天室當前狀態不允許接受邀請': 'The current chat room status does not allow accepting invites',
  '此邀請僅限指定用戶接受': 'Only the specified user can accept this invite',
  '不能加入自己發起的聊天室': 'You cannot join a chat room you initiated',
  '邀請碼已失效或已被使用': 'Invite code has expired or already been used',
  '聊天室已有 B 方成員，無法重複加入': 'This chat room already has a Side B member and cannot be joined again',
  '聊天室不存在': 'Chat room not found',
  '聊天室已有 B 方成員，請刷新後重試': 'This chat room already has a Side B member. Please refresh and try again',
  '聊天室當前狀態不允許拒絕邀請': 'The current chat room status does not allow declining invites',
  '處理指定邀請需要登入帳號': 'Log in to handle this specified invite',
  '此邀請僅限指定用戶處理': 'Only the specified user can handle this invite',
  '公開邀請僅限房主撤回': 'Only the room owner can withdraw a public invite',
  'cursor 必須為有效 ISO 時間': 'cursor must be a valid ISO timestamp',
  '只有聊天室成員可發言': 'Only chat room members can send messages',
  '當前狀態不可發送訊息': 'The current status does not allow sending messages',
  '回覆的訊息不存在': 'The replied-to message does not exist',
  '只有聊天室成員可發起梳理結果': 'Only chat room members can request an Analysis',
  '目前版本需由 A 方確認後發起梳理結果': 'This version requires Side A to confirm before requesting an Analysis',
  '梳理結果生成中，請稍後': 'Analysis is being generated, please wait',
  '封存聊天室不可再次發起梳理結果': 'Archived chat rooms cannot request another Analysis',
  '聊天室狀態已變更，請重試': 'Chat room status changed. Please try again',
  '聊天室參與者狀態異常，請刷新後重試': 'Chat room participant status is inconsistent. Please refresh and try again',
  '缺少發起方資訊，無法轉梳理結果': 'Initiator information is missing, so this chat cannot be converted to an Analysis',
  '部分訊息不存在或不可納入梳理結果': 'Some messages do not exist or cannot be included in the Analysis',
  '需至少 1 則訊息納入梳理結果': 'At least one message must be included in the Analysis',
  'A 方訊息不足，無法轉梳理結果': 'Side A messages are insufficient, so this chat cannot be converted to an Analysis',
  '納入 B 方訊息前需要 B 方明示同意': 'Side B must explicitly consent before Side B messages can be included',
  '目前安全路由不允許由聊天室直接轉梳理結果': 'The current safety route does not allow converting this chat room directly to an Analysis',
  '其他衝突': 'Other conflict',
  '需登入才能離開聊天室': 'Log in to leave the chat room',
  '只有 B 方成員可離開聊天室': 'Only Side B members can leave the chat room',
  '只有發起方可以移除 B 方': 'Only the initiator can remove Side B',
  '聊天室目前沒有 B 方可移除': 'This chat room currently has no Side B member to remove',
  '案件已建立，等待對方陳述': 'Case created, waiting for the other person statement',
  '分析生成中，請稍後再試': 'Analysis is being generated, please try again later',
  '雙方陳述已完成，AI正在分析中...': 'Both statements completed, AI is analyzing...',
  '角色A陳述已記錄，請將設備交給角色B': 'Role A statement recorded. Please hand the device to Role B.',
  '訪談已開始': 'Interview started',
  '訪談回覆已提交': 'Interview response submitted',
  '訪談已結束': 'Interview ended',
  '訪談跳題已提交': 'Interview skip submitted',
  '訪談生成已停止': 'Interview generation stopped',
  '訪談不存在或無權限': 'Interview not found or you do not have access',
  '訪談缺少可回覆輪次': 'Interview is missing a turn that can be replied to',
  '目前沒有進行中的訪談生成': 'No interview generation is currently in progress',
  '系統偵測到安全風險，已先切換到安全支持回應。': 'We detected a possible safety risk and switched to a safety-first response.',
  '已重試': 'Retried',
  '已記下你的承諾': 'Your commitment has been recorded',
  '已記下你暫時不加入的選擇': 'Your choice not to join for now has been recorded',
  '已記下你需要一點時間': 'Your need for more time has been recorded',
  '已同步你已查看這個邀請': 'Your invitation view has been synced',
  '已送出一起試試看的邀請': 'Invitation to try together sent',
  '已暫停這一輪修復旅程': 'This repair round has been paused',
  '已接受這一輪重調請求': 'This adjustment request has been accepted',
  '已恢復這一輪修復旅程': 'This repair round has been resumed',
  '分析已完成': 'Analysis completed',
  '已接受梳理結果': 'Analysis accepted',
  '已拒絕梳理結果': 'Analysis rejected',
  '無效的和好方案格式': 'Invalid reconciliation plan format',
  '修復旅程不存在': 'Repair journey not found',
  '和好方案不存在': 'Reconciliation plan not found',
  '無權限操作此方案': 'You do not have permission to operate on this plan',
  '無權限執行此方案': 'You do not have permission to execute this plan',
  '無權限查看此修復旅程': 'You do not have permission to view this repair journey',
  '請先在和好方案中選擇此方案再確認執行': 'Select this reconciliation plan before confirming execution',
  '請先選擇並確認此方案後再記錄進展': 'Select and confirm this plan before recording progress',
  '無權限調整此修復旅程': 'You do not have permission to adjust this repair journey',
  '目前這一輪狀態無法重新調整': 'This repair round cannot be adjusted again in its current state',
  '無權限生成和好方案': 'You do not have permission to generate reconciliation plans',
  '此案件尚未綁定已登入當事人，不能生成修復旅程': 'This case is not linked to a signed-in participant, so a repair journey cannot be generated',
  '此梳理結果路由不允許生成一般共同修復方案，請改用安全支持或低壓退出方向': 'This Analysis route does not allow a standard shared repair plan. Use safety support or a low-pressure exit direction instead',
  '此梳理結果路由只允許 solo 修復，不允許邀請伴侶加入修復旅程': 'This Analysis route only allows solo repair and does not allow inviting a partner into the repair journey',
  '和好方案生成失敗': 'Reconciliation plan generation failed',
  '無權限查看此梳理結果的和好方案': 'You do not have permission to view reconciliation plans for this Analysis',
  '此梳理結果路由不允許邀請伴侶加入修復旅程': 'This Analysis route does not allow inviting a partner into the repair journey',
  '請先承諾此方案，再開始今天的第一步': "Commit to this plan before starting today's first step",
  '無權限恢復此修復旅程': 'You do not have permission to resume this repair journey',
  '已生成修復版回應': 'Repair response generated',
  '已記錄臨床品質指標': 'Clinical quality metrics recorded',
  '已取消 pending 通知': 'Pending notification canceled',
  '已批量取消 pending 通知': 'Pending notifications canceled in bulk',
  '已重新排入 pending 通知': 'Notification requeued as pending',
  'notification payload.path 必須為已允許的前台相對路由': 'notification payload.path must be an allowed frontend relative route',
  '批量取消通知必須提供至少一個篩選條件': 'Bulk notification cancellation requires at least one filter',
  '只有 pending 通知可以取消': 'Only pending notifications can be canceled',
  '已由 Admin 取消的通知不可重送': 'Notifications canceled by Admin cannot be resent',
  '只有 failed 通知可以重送': 'Only failed notifications can be resent',
  'token 或 device_id 至少需要一項': 'At least one of token or device_id is required',
  'template_code 為必填欄位': 'template_code is required',
  '已更新人工恢復任務狀態': 'Manual recovery task status updated',
  '任務已觸發，請稍後查看執行結果日誌': 'Task triggered. Check execution logs later.',
  '案件已關聯到您的帳號': 'Case linked to your account',
  '無可關聯的案件': 'No case available to link',
  '接口不存在': 'API endpoint not found',
  '僅支持 GET/HEAD 訪問文件': 'Only GET/HEAD is allowed for file access',
  '無效的JSON請求體': 'Invalid JSON request body',
  '驗證碼嘗試過於頻繁，請15分鐘後再試': 'Too many verification attempts, please try again in 15 minutes',
  '重設密碼請求過於頻繁，請稍後再試': 'Too many password reset requests, please try again later',
  '重設密碼嘗試過於頻繁，請15分鐘後再試': 'Too many password reset attempts, please try again in 15 minutes',
  '配對嘗試過於頻繁，請稍後再試': 'Too many pairing attempts, please try again later',
  '該郵箱已被註冊': 'This email has already been registered',
  '文件大小超出限制': 'File size exceeds the limit',
  '文件數量超出限制': 'File count exceeds the limit',
  '無效的文件字段': 'Invalid file field',
  '文件上傳失敗': 'File upload failed',
  '只支持JPG、PNG、GIF、MP4格式': 'Only JPG, PNG, GIF, and MP4 formats are supported',
  '不支持的文件類型': 'Unsupported file type',
  '不支持的文件擴展名': 'Unsupported file extension',
  '文件類型驗證失敗：文件內容與聲稱的類型不匹配': 'File type validation failed: file content does not match the declared type',
  '操作正在進行中，請稍後再試': 'Operation in progress, please try again later',
  '缺少分布式鎖後端 (Redis)，請聯繫管理員': 'Distributed lock backend (Redis) is unavailable, please contact administrator',
  'Session刷新失敗': 'Session refresh failed',
  'Session更新失敗': 'Session update failed',
  'interview.maxTurns 不可小於 interview.softTarget': 'interview.maxTurns cannot be less than interview.softTarget',
  'interview.softTarget 不可大於 interview.maxTurns': 'interview.softTarget cannot be greater than interview.maxTurns',
  '缺少 B 方完整陳述': "Partner's complete statement is missing",
  '缺少可定位的時間錨點': 'A clear time anchor is missing',
  '事件經過與行為鏈條不足，難以重建衝突場景': 'The event sequence is too thin to reconstruct the conflict clearly',
  '因果描述不足，責任判斷不確定性偏高': 'Causal details are limited, so responsibility analysis remains uncertain',
  '情緒訊號不足，建議補充主觀感受': 'Emotional signals are limited; add subjective feelings',
  '需求/期待描述不足，難以生成可行修復建議': 'Needs or expectations are limited, making repair suggestions harder to generate',
  '情緒表達偏單一，可能放大單側詮釋偏差': 'Emotional expression is one-sided and may amplify interpretation bias',
  '互動循環線索不足，建議補充「觸發-反應-升級」描述': 'Interaction cycle clues are limited; add trigger-response-escalation details',
  'AI 重調失敗': 'AI adjustment failed',
  'AI 服務暫時不可用，請稍後重試': 'AI service is temporarily unavailable. Please try again later.',
  'AI 服務響應超時，請稍後再試': 'AI service timed out. Please try again later.',
  'AI 服務認證失敗（請檢查 OPENAI_API_KEY）': 'AI service authentication failed. Check OPENAI_API_KEY.',
  'AI 請求過於頻繁，請稍後再試': 'AI requests are too frequent. Please try again later.',
  '今日 AI 調用已達上限': "Today's AI usage limit has been reached.",
  'AI 返回內容異常，請重試': 'AI returned an invalid response. Please try again.',
  '服務內部錯誤': 'Internal service error',
  '請檢查 API Key 與網路連線': 'Check the API Key and network connection',
  'Provider catalog 不存在': 'Provider catalog not found',
  '不支援的 providerKey': 'Unsupported providerKey',
};

function translateDynamicBackendMessage(message: string): string | null {
  const accountLockout = message.match(/^帳號已被暫時鎖定，請(\d+)分鐘後再試$/);
  if (accountLockout) {
    return `Account is temporarily locked. Please try again in ${accountLockout[1]} minutes`;
  }

  const fileSizeLimit = message.match(/^文件大小不能超過([0-9.]+)MB$/);
  if (fileSizeLimit) {
    return `File size cannot exceed ${fileSizeLimit[1]}MB`;
  }

  const fieldRequired = message.match(/^(.+)不能為空$/);
  if (fieldRequired) {
    return `${fieldRequired[1]} cannot be empty`;
  }

  const fieldMinLength = message.match(/^(.+)長度必須至少(\d+)字$/);
  if (fieldMinLength) {
    return `${fieldMinLength[1]} must be at least ${fieldMinLength[2]} characters`;
  }

  const fieldMaxLength = message.match(/^(.+)長度不能超過(\d+)字$/);
  if (fieldMaxLength) {
    return `${fieldMaxLength[1]} length cannot exceed ${fieldMaxLength[2]} characters`;
  }

  const evidenceUrlInvalidType = message.match(/^證據URL\[(\d+)\]格式錯誤$/);
  if (evidenceUrlInvalidType) {
    return `Evidence URL[${evidenceUrlInvalidType[1]}] format is incorrect`;
  }

  const evidenceUrlInvalidFormat = message.match(/^證據URL\[(\d+)\]格式無效$/);
  if (evidenceUrlInvalidFormat) {
    return `Evidence URL[${evidenceUrlInvalidFormat[1]}] format is invalid`;
  }

  const evidenceUrlHttpsOnly = message.match(/^證據URL\[(\d+)\]僅支持 HTTPS$/);
  if (evidenceUrlHttpsOnly) {
    return `Evidence URL[${evidenceUrlHttpsOnly[1]}] only supports HTTPS`;
  }

  const fieldInvalidFormat = message.match(/^(.+)格式無效$/);
  if (fieldInvalidFormat) {
    return `${fieldInvalidFormat[1]} format is invalid`;
  }

  const providerConnectionSuccess = message.match(/^(.+) 連線測試成功$/);
  if (providerConnectionSuccess) {
    return `${providerConnectionSuccess[1]} connection test successful`;
  }

  const providerFallbackSuccess = message.match(/^(.+) 連線測試成功（fallback 驗證）$/);
  if (providerFallbackSuccess) {
    return `${providerFallbackSuccess[1]} connection test successful (fallback validation)`;
  }

  const providerTestFailure = message.match(/^(.+) 測試失敗：(.+)$/);
  if (providerTestFailure) {
    return `${providerTestFailure[1]} test failed: ${translateBackendMessage('en-US', providerTestFailure[2])}`;
  }

  const providerConnectionFailure = message.match(/^(.+) 連線測試失敗，請檢查 baseUrl\/API Key$/);
  if (providerConnectionFailure) {
    return `${providerConnectionFailure[1]} connection test failed. Check baseUrl/API Key`;
  }

  const providerUnsupportedImageGeneration = message.match(/^Provider (.+) 不支援圖片生成$/);
  if (providerUnsupportedImageGeneration) {
    return `Provider ${providerUnsupportedImageGeneration[1]} does not support image generation`;
  }

  const providerUnsupportedVideoGeneration = message.match(/^Provider (.+) 不支援影片生成$/);
  if (providerUnsupportedVideoGeneration) {
    return `Provider ${providerUnsupportedVideoGeneration[1]} does not support video generation`;
  }

  const providerImplementationMissing = message.match(/^Provider 實作尚未部署：(.+)$/);
  if (providerImplementationMissing) {
    return `Provider implementation is not deployed yet: ${providerImplementationMissing[1]}`;
  }

  const providerMissingApiKey = message.match(/^(.+) 缺少 API Key，請先以 system config 寫入 (.+) 或於測試輸入中提供 apiKey$/);
  if (providerMissingApiKey) {
    return `${providerMissingApiKey[1]} is missing an API Key. Add ${providerMissingApiKey[2]} in system config or provide apiKey in the test input`;
  }

  const relationAllowedValues = message.match(/^relation 只能是 (.+)$/);
  if (relationAllowedValues) {
    return `relation must be one of ${relationAllowedValues[1]}`;
  }

  const adminKeyRequired = message.match(/^([A-Za-z0-9._/\[\]-]+) 為必填$/);
  if (adminKeyRequired) {
    return `${adminKeyRequired[1]} is required`;
  }

  const adminKeyNumeric = message.match(/^([A-Za-z0-9._/\[\]-]+) 必須為數字$/);
  if (adminKeyNumeric) {
    return `${adminKeyNumeric[1]} must be numeric`;
  }

  const adminKeyBoolean = message.match(/^([A-Za-z0-9._/\[\]-]+) 必須為 boolean$/);
  if (adminKeyBoolean) {
    return `${adminKeyBoolean[1]} must be boolean`;
  }

  const adminKeyObject = message.match(/^([A-Za-z0-9._/\[\]-]+) 必須為 object$/);
  if (adminKeyObject) {
    return `${adminKeyObject[1]} must be an object`;
  }

  const adminKeyArray = message.match(/^([A-Za-z0-9._/\[\]-]+) 必須為 array$/);
  if (adminKeyArray) {
    return `${adminKeyArray[1]} must be an array`;
  }

  const adminKeyRange = message.match(/^([A-Za-z0-9._/\[\]-]+) 必須介於 (\d+) ~ (\d+)$/);
  if (adminKeyRange) {
    return `${adminKeyRange[1]} must be between ${adminKeyRange[2]} and ${adminKeyRange[3]}`;
  }

  const adminKeyMaxLength = message.match(/^([A-Za-z0-9._/\[\]-]+) 長度不可超過 (\d+)$/);
  if (adminKeyMaxLength) {
    return `${adminKeyMaxLength[1]} length cannot exceed ${adminKeyMaxLength[2]}`;
  }

  const featureFlagKeyMaxLength = message.match(/^feature\.flags key 長度不可超過 80: (.+)$/);
  if (featureFlagKeyMaxLength) {
    return `feature.flags key length cannot exceed 80: ${featureFlagKeyMaxLength[1]}`;
  }

  const featureFlagKeyInvalidFormat = message.match(/^feature\.flags key 格式不合法: (.+)$/);
  if (featureFlagKeyInvalidFormat) {
    return `feature.flags key format is invalid: ${featureFlagKeyInvalidFormat[1]}`;
  }

  const featureFlagValueInvalidType = message.match(/^feature\.flags\.(.+) 只允許 string\/number\/boolean$/);
  if (featureFlagValueInvalidType) {
    return `feature.flags.${featureFlagValueInvalidType[1]} only allows string/number/boolean values`;
  }

  const adminAlertThreshold = message.match(/^(admin\.alert\.rules\[\d+\]\.threshold) 必須為 >= 0 的數字$/);
  if (adminAlertThreshold) {
    return `${adminAlertThreshold[1]} must be a number greater than or equal to 0`;
  }

  const adminProviderObject = message.match(/^([A-Za-z0-9._-]+) 設定必須是 object$/);
  if (adminProviderObject) {
    return `${adminProviderObject[1]} config must be an object`;
  }

  const adminProviderApiKey = message.match(/^([A-Za-z0-9._-]+) 的 apiKey 需為非空字串$/);
  if (adminProviderApiKey) {
    return `${adminProviderApiKey[1]} apiKey must be a non-empty string`;
  }

  const adminProviderBaseUrl = message.match(/^([A-Za-z0-9._-]+) 的 baseUrl 需為合法 URL$/);
  if (adminProviderBaseUrl) {
    return `${adminProviderBaseUrl[1]} baseUrl must be a valid URL`;
  }

  const adminProviderTimeoutMs = message.match(/^([A-Za-z0-9._-]+) 的 timeoutMs 需為正整數$/);
  if (adminProviderTimeoutMs) {
    return `${adminProviderTimeoutMs[1]} timeoutMs must be a positive integer`;
  }

  const providerTestInvalidResponse = message.match(/^(.+) 測試請求回應異常$/);
  if (providerTestInvalidResponse) {
    return `${providerTestInvalidResponse[1]} test request returned an invalid response`;
  }

  const providerImageInvalidResponse = message.match(/^(.+) 圖片生成回應異常$/);
  if (providerImageInvalidResponse) {
    return `${providerImageInvalidResponse[1]} image generation returned an invalid response`;
  }

  const providerMissingImage = message.match(/^(.+) 未回傳可用圖片 URL$/);
  if (providerMissingImage) {
    return `${providerMissingImage[1]} did not return a usable image URL`;
  }

  const imageOnlyProvider = message.match(/^(.+) 目前僅支援 image 任務$/);
  if (imageOnlyProvider) {
    return `${imageOnlyProvider[1]} currently supports image tasks only`;
  }

  const providerAuthFailure = message.match(/^(.+) 授權失敗，請檢查 API Key$/);
  if (providerAuthFailure) {
    return `${providerAuthFailure[1]} authorization failed. Check the API Key`;
  }

  const providerTimeout = message.match(/^([A-Za-z0-9._ -]+) 請求逾時$/);
  if (providerTimeout) {
    return `${providerTimeout[1]} request timed out`;
  }

  const providerRateLimited = message.match(/^([A-Za-z0-9._ -]+) 請求過頻，請稍後再試$/);
  if (providerRateLimited) {
    return `${providerRateLimited[1]} request rate is too high. Please try again later`;
  }

  const providerServiceError = message.match(/^([A-Za-z0-9._ -]+) 服務異常 \((\d+)\)$/);
  if (providerServiceError) {
    return `${providerServiceError[1]} service is unavailable (${providerServiceError[2]})`;
  }

  const videoOnlyProvider = message.match(/^(.+) 目前僅支援 video 任務$/);
  if (videoOnlyProvider) {
    return `${videoOnlyProvider[1]} currently supports video tasks only`;
  }

  const videoTaskFailureWithDetail = message.match(/^(.+) 影像任務建立失敗：(.+)$/);
  if (videoTaskFailureWithDetail) {
    return `${videoTaskFailureWithDetail[1]} video task creation failed: ${translateBackendMessage('en-US', videoTaskFailureWithDetail[2])}`;
  }

  const videoTaskFailure = message.match(/^(.+) 影像任務建立失敗$/);
  if (videoTaskFailure) {
    return `${videoTaskFailure[1]} video task creation failed`;
  }

  const videoTaskMissingAsset = message.match(/^(.+) 回應未帶回可用影片 URL 或 taskId$/);
  if (videoTaskMissingAsset) {
    return `${videoTaskMissingAsset[1]} did not return a usable video URL or taskId`;
  }

  const videoTaskCompletedWithoutUrl = message.match(/^(.+) 任務完成但未回傳影片 URL$/);
  if (videoTaskCompletedWithoutUrl) {
    return `${videoTaskCompletedWithoutUrl[1]} task completed but did not return a video URL`;
  }

  const videoTaskRuntimeFailureWithDetail = message.match(/^(.+) 影像任務失敗：(.+)$/);
  if (videoTaskRuntimeFailureWithDetail) {
    return `${videoTaskRuntimeFailureWithDetail[1]} video task failed: ${translateBackendMessage('en-US', videoTaskRuntimeFailureWithDetail[2])}`;
  }

  const videoTaskRuntimeFailure = message.match(/^(.+) 影像任務失敗$/);
  if (videoTaskRuntimeFailure) {
    return `${videoTaskRuntimeFailure[1]} video task failed`;
  }

  const videoTaskPollingTimeoutWithDetail = message.match(/^(.+) 任務輪詢逾時：(.+)$/);
  if (videoTaskPollingTimeoutWithDetail) {
    return `${videoTaskPollingTimeoutWithDetail[1]} task polling timed out: ${translateBackendMessage('en-US', videoTaskPollingTimeoutWithDetail[2])}`;
  }

  const videoTaskPollingTimeout = message.match(/^(.+) 任務輪詢逾時$/);
  if (videoTaskPollingTimeout) {
    return `${videoTaskPollingTimeout[1]} task polling timed out`;
  }

  return null;
}

export function normalizeLocale(input?: string | null): BackendLocale {
  if (!input) return 'zh-TW';
  const lower = input.toLowerCase();
  if (lower.startsWith('en')) return 'en-US';
  return 'zh-TW';
}

export function resolveLocaleFromHeader(acceptLanguage?: string | string[]): BackendLocale {
  if (!acceptLanguage) return 'zh-TW';
  const raw = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
  const first = raw.split(',')[0]?.trim();
  return normalizeLocale(first);
}

export function translateErrorByCode(locale: BackendLocale, code: string, fallback?: string): string {
  const byCode = locale === 'en-US' ? enUSByCode : zhTWByCode;
  return byCode[code] ?? (fallback ? translateBackendMessage(locale, fallback) : code);
}

export function translateBackendMessage(locale: BackendLocale, message: string): string {
  if (locale === 'zh-TW') return message;
  if (message.startsWith('唯一約束違規:')) {
    const detail = message.slice('唯一約束違規:'.length).trim();
    const translatedDetail = detail === '未知字段' ? 'unknown field' : detail;
    return `Unique constraint violation: ${translatedDetail}`;
  }
  return directEnUSMap[message] ?? translateDynamicBackendMessage(message) ?? message;
}
