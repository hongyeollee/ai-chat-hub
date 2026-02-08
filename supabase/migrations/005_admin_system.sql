-- NexusAI - Admin System Migration
-- Version: 005
-- Description: 관리자 역할, 사용자 오버라이드, 감사 로그 테이블 추가

-- ============================================================================
-- 1. Profiles Table Extension - Add Role Column
-- ============================================================================

-- 사용자 역할 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('user', 'admin', 'tester'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================================
-- 2. User Overrides Table (사용자별 제한 오버라이드)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 사용 방식 오버라이드 (테스터용 핵심 기능)
  -- 'daily': 일일 횟수 제한 방식 (Free 티어처럼)
  -- 'credits': 크레딧 기반 방식 (유료 티어처럼)
  -- null: 기본 티어 설정 따름
  usage_type_override TEXT CHECK (usage_type_override IN ('daily', 'credits')),

  -- 일일 제한 오버라이드 (usage_type_override = 'daily' 시 사용)
  daily_requests_override INTEGER,        -- null이면 기본값 사용
  daily_chars_override INTEGER,

  -- 크레딧 제한 오버라이드 (usage_type_override = 'credits' 시 사용)
  monthly_credits_override INTEGER,

  -- 모델 접근 오버라이드
  allowed_models TEXT[],                  -- null이면 티어 기본값

  -- 컨텍스트 오버라이드
  max_context_messages_override INTEGER,
  max_input_chars_override INTEGER,

  -- 메타 정보
  reason TEXT,                            -- 오버라이드 사유
  expires_at TIMESTAMP WITH TIME ZONE,    -- 만료일 (테스터 기간 등)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 사용자당 하나의 오버라이드만 허용
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_overrides_user_id ON user_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_overrides_expires_at ON user_overrides(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_overrides_created_by ON user_overrides(created_by);

-- ============================================================================
-- 3. Admin Audit Log Table (관리자 작업 감사 로그)
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,  -- 'grant_credits', 'set_override', 'remove_override', 'change_role'
  target_user_id UUID REFERENCES auth.users(id),
  details JSONB,         -- 상세 정보 (이전값, 새값 등)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

-- ============================================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE user_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- User Overrides policies

-- Admins can manage all overrides
CREATE POLICY "user_overrides_admin_all" ON user_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can view their own overrides
CREATE POLICY "user_overrides_select_own" ON user_overrides
  FOR SELECT
  USING (user_id = auth.uid());

-- Admin Audit Log policies

-- Admins can view all audit logs
CREATE POLICY "admin_audit_log_admin_select" ON admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert audit logs
CREATE POLICY "admin_audit_log_admin_insert" ON admin_audit_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 5. Triggers for updated_at
-- ============================================================================

-- user_overrides 테이블 updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_user_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_overrides_updated_at ON user_overrides;
CREATE TRIGGER trigger_user_overrides_updated_at
  BEFORE UPDATE ON user_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_user_overrides_updated_at();

-- ============================================================================
-- 6. Update credit_transactions type check to include 'admin_grant'
-- ============================================================================

-- 기존 CHECK 제약조건 삭제 후 새로 추가 (admin_grant 타입 포함)
DO $$
BEGIN
  -- 기존 CHECK 제약조건 삭제 시도
  ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

  -- 새 CHECK 제약조건 추가 (admin_grant 포함)
  ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
    CHECK (type IN ('monthly', 'rollover', 'purchase', 'usage', 'refund', 'admin_grant'));
EXCEPTION
  WHEN others THEN
    -- 제약조건이 없어도 무시
    NULL;
END $$;

-- ============================================================================
-- 7. Comments
-- ============================================================================

COMMENT ON TABLE user_overrides IS '사용자별 제한 오버라이드 (테스터/특수 사용자용)';
COMMENT ON TABLE admin_audit_log IS '관리자 작업 감사 로그';
COMMENT ON COLUMN profiles.role IS '사용자 역할 (user, admin, tester)';
COMMENT ON COLUMN user_overrides.usage_type_override IS '사용 방식 오버라이드 (daily: 일일 횟수, credits: 크레딧 기반)';
COMMENT ON COLUMN user_overrides.expires_at IS '오버라이드 만료일 (null이면 무기한)';
