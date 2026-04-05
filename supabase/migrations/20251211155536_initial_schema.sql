-- 創建用戶表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(255),
  avatar_url VARCHAR(500),
  gender VARCHAR(10),
  age INTEGER,
  relationship_status VARCHAR(20) NOT NULL DEFAULT 'single',
  language VARCHAR(10) DEFAULT 'zh',
  timezone VARCHAR(255),
  notification_enabled BOOLEAN DEFAULT true,
  privacy_level VARCHAR(20) DEFAULT 'private',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- 創建配對表
CREATE TABLE IF NOT EXISTS pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  invite_code VARCHAR(6) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending',
  pairing_type VARCHAR(20) DEFAULT 'normal',
  session_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pairings_user1_id ON pairings(user1_id);
CREATE INDEX IF NOT EXISTS idx_pairings_user2_id ON pairings(user2_id);
CREATE INDEX IF NOT EXISTS idx_pairings_status ON pairings(status);
CREATE INDEX IF NOT EXISTS idx_pairings_expires_at ON pairings(expires_at);
CREATE INDEX IF NOT EXISTS idx_pairings_session_id ON pairings(session_id);
CREATE INDEX IF NOT EXISTS idx_pairings_pairing_type ON pairings(pairing_type);

-- 創建案件表
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID NOT NULL REFERENCES pairings(id),
  title VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  sub_type VARCHAR(50),
  plaintiff_id UUID REFERENCES users(id),
  defendant_id UUID REFERENCES users(id),
  plaintiff_statement TEXT NOT NULL,
  defendant_statement TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  mode VARCHAR(20) DEFAULT 'remote',
  session_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cases_pairing_id ON cases(pairing_id);
CREATE INDEX IF NOT EXISTS idx_cases_plaintiff_id ON cases(plaintiff_id);
CREATE INDEX IF NOT EXISTS idx_cases_defendant_id ON cases(defendant_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_type ON cases(type);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_submitted_at ON cases(submitted_at);
CREATE INDEX IF NOT EXISTS idx_cases_session_id ON cases(session_id);
CREATE INDEX IF NOT EXISTS idx_cases_mode ON cases(mode);

-- 創建證據表
CREATE TABLE IF NOT EXISTS evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  file_size INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evidences_case_id ON evidences(case_id);
CREATE INDEX IF NOT EXISTS idx_evidences_user_id ON evidences(user_id);
CREATE INDEX IF NOT EXISTS idx_evidences_file_type ON evidences(file_type);

-- 創建判決表
CREATE TABLE IF NOT EXISTS judgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  judgment_content TEXT NOT NULL,
  summary TEXT,
  responsibility_ratio JSONB NOT NULL,
  ai_model VARCHAR(50) DEFAULT 'gpt-3.5-turbo',
  prompt_version VARCHAR(20) DEFAULT 'v1.0',
  user1_acceptance BOOLEAN,
  user2_acceptance BOOLEAN,
  user1_rating INTEGER,
  user2_rating INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_judgments_case_id ON judgments(case_id);
CREATE INDEX IF NOT EXISTS idx_judgments_created_at ON judgments(created_at);
CREATE INDEX IF NOT EXISTS idx_judgments_user1_acceptance ON judgments(user1_acceptance);
CREATE INDEX IF NOT EXISTS idx_judgments_user2_acceptance ON judgments(user2_acceptance);

-- 創建和好方案表
CREATE TABLE IF NOT EXISTS reconciliation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judgment_id UUID NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  plan_content TEXT NOT NULL,
  plan_type VARCHAR(50) NOT NULL,
  difficulty_level VARCHAR(20) NOT NULL,
  estimated_duration INTEGER,
  time_cost INTEGER NOT NULL,
  money_cost INTEGER NOT NULL,
  emotion_cost INTEGER NOT NULL,
  skill_requirement INTEGER NOT NULL,
  user1_selected BOOLEAN DEFAULT false,
  user2_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_plans_judgment_id ON reconciliation_plans(judgment_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_plans_difficulty_level ON reconciliation_plans(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_reconciliation_plans_plan_type ON reconciliation_plans(plan_type);

-- 創建執行記錄表
CREATE TABLE IF NOT EXISTS execution_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_plan_id UUID NOT NULL REFERENCES reconciliation_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  photos_urls TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_execution_records_reconciliation_plan_id ON execution_records(reconciliation_plan_id);
CREATE INDEX IF NOT EXISTS idx_execution_records_user_id ON execution_records(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_records_status ON execution_records(status);
CREATE INDEX IF NOT EXISTS idx_execution_records_action ON execution_records(action);

-- 創建快速體驗模式Session表
CREATE TABLE IF NOT EXISTS quick_sessions (
  id VARCHAR(100) PRIMARY KEY,
  pairing_id UUID REFERENCES pairings(id),
  case_id UUID REFERENCES cases(id),
  session_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quick_sessions_expires_at ON quick_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_quick_sessions_pairing_id ON quick_sessions(pairing_id);
CREATE INDEX IF NOT EXISTS idx_quick_sessions_case_id ON quick_sessions(case_id);

-- 創建郵件驗證表
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  type VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_code ON email_verifications(code);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_type ON email_verifications(type);;
