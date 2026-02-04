-- AI Chat Hub - Subscriptions & Credits System Migration
-- Version: 004
-- Description: 구독 시스템, 크레딧 시스템, 결제 내역 테이블 추가

-- ============================================================================
-- 1. Subscriptions Table (구독 정보)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'light', 'pro', 'enterprise')),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  withdrawal_consent BOOLEAN DEFAULT FALSE,  -- EU/UK/터키 14일 철회권 동의 여부
  withdrawal_consent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 사용자당 하나의 활성 구독만 허용
  UNIQUE (user_id)
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================================================
-- 2. Monthly Credits Table (월간 크레딧 잔액)
-- ============================================================================

CREATE TABLE IF NOT EXISTS monthly_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,  -- YYYY-MM-01 형식 (해당 월의 첫날)
  base_credits INTEGER NOT NULL DEFAULT 0,       -- 구독으로 받은 기본 제공량
  rollover_credits INTEGER DEFAULT 0,            -- 이전 달에서 이월된 크레딧
  purchased_credits INTEGER DEFAULT 0,           -- 추가 구매한 크레딧
  used_credits INTEGER DEFAULT 0,                -- 사용한 크레딧
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 사용자당 월별로 하나의 레코드만 허용
  UNIQUE (user_id, month)
);

CREATE INDEX idx_monthly_credits_user_id ON monthly_credits(user_id);
CREATE INDEX idx_monthly_credits_month ON monthly_credits(month);
CREATE INDEX idx_monthly_credits_user_month ON monthly_credits(user_id, month);

-- ============================================================================
-- 3. Credit Transactions Table (크레딧 거래 로그)
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,  -- 양수: 충전/지급, 음수: 사용
  balance_after INTEGER,    -- 거래 후 잔액 (감사/디버깅용)
  type TEXT NOT NULL CHECK (type IN ('monthly', 'rollover', 'purchase', 'usage', 'refund')),
  model TEXT,               -- AI 모델명 (usage 타입일 때)
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,  -- 어떤 메시지로 사용했는지
  description TEXT,         -- 추가 설명
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX idx_credit_transactions_user_created ON credit_transactions(user_id, created_at);

-- ============================================================================
-- 4. Payments Table (결제 내역)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded')),
  refund_amount DECIMAL(10,2),
  refund_reason TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_stripe_invoice_id ON payments(stripe_invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- ============================================================================
-- 5. Profiles Table Extension (기존 테이블 확장)
-- ============================================================================

-- Stripe 고객 ID 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- 국가 코드 컬럼 추가 (EU/UK/터키 철회권 감지용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN country_code TEXT;
  END IF;
END $$;

-- subscription_tier 컬럼의 CHECK 제약조건 업데이트 (light, enterprise 추가)
-- 기존 제약조건이 있다면 삭제 후 새로 추가
DO $$
BEGIN
  -- 기존 CHECK 제약조건 삭제 시도 (존재할 경우)
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

  -- 새 CHECK 제약조건 추가
  ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
    CHECK (subscription_tier IN ('free', 'light', 'pro', 'enterprise'));
EXCEPTION
  WHEN others THEN
    -- 제약조건이 없어도 무시
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_country_code ON profiles(country_code);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);

-- ============================================================================
-- 6. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "subscriptions_insert" ON subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "subscriptions_update" ON subscriptions
  FOR UPDATE USING (user_id = auth.uid());

-- Monthly credits policies
CREATE POLICY "monthly_credits_select" ON monthly_credits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "monthly_credits_insert" ON monthly_credits
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "monthly_credits_update" ON monthly_credits
  FOR UPDATE USING (user_id = auth.uid());

-- Credit transactions policies (읽기 전용 - 사용자가 자신의 거래 내역만 조회 가능)
CREATE POLICY "credit_transactions_select" ON credit_transactions
  FOR SELECT USING (user_id = auth.uid());

-- Payments policies (읽기 전용 - 사용자가 자신의 결제 내역만 조회 가능)
CREATE POLICY "payments_select" ON payments
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================================
-- 7. Helper Functions
-- ============================================================================

-- 현재 월의 잔여 크레딧 계산 함수
CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_credits RECORD;
  v_available INTEGER;
BEGIN
  SELECT
    base_credits,
    rollover_credits,
    purchased_credits,
    used_credits
  INTO v_credits
  FROM monthly_credits
  WHERE user_id = p_user_id
    AND month = DATE_TRUNC('month', CURRENT_DATE)::DATE
  LIMIT 1;

  IF v_credits IS NULL THEN
    RETURN 0;
  END IF;

  v_available := COALESCE(v_credits.base_credits, 0)
               + COALESCE(v_credits.rollover_credits, 0)
               + COALESCE(v_credits.purchased_credits, 0)
               - COALESCE(v_credits.used_credits, 0);

  RETURN GREATEST(v_available, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 크레딧 사용 함수
CREATE OR REPLACE FUNCTION use_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_model TEXT DEFAULT NULL,
  p_message_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_available INTEGER;
  v_balance_after INTEGER;
  v_current_month DATE;
BEGIN
  v_current_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;

  -- 현재 잔액 확인
  v_available := get_available_credits(p_user_id);

  IF v_available < p_amount THEN
    RETURN FALSE;  -- 잔액 부족
  END IF;

  -- used_credits 증가
  UPDATE monthly_credits
  SET
    used_credits = used_credits + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND month = v_current_month;

  -- 새 잔액 계산
  v_balance_after := v_available - p_amount;

  -- 거래 로그 기록
  INSERT INTO credit_transactions (
    user_id, amount, balance_after, type, model, message_id, description
  ) VALUES (
    p_user_id, -p_amount, v_balance_after, 'usage', p_model, p_message_id, p_description
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 크레딧 지급 함수 (월간, 이월, 구매, 환불)
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,  -- 'monthly', 'rollover', 'purchase', 'refund'
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_month DATE;
  v_balance_after INTEGER;
BEGIN
  v_current_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;

  -- 해당 월 레코드가 없으면 생성
  INSERT INTO monthly_credits (user_id, month, base_credits, rollover_credits, purchased_credits, used_credits)
  VALUES (p_user_id, v_current_month, 0, 0, 0, 0)
  ON CONFLICT (user_id, month) DO NOTHING;

  -- 타입에 따라 적절한 컬럼 업데이트
  CASE p_type
    WHEN 'monthly' THEN
      UPDATE monthly_credits
      SET base_credits = base_credits + p_amount, updated_at = NOW()
      WHERE user_id = p_user_id AND month = v_current_month;
    WHEN 'rollover' THEN
      UPDATE monthly_credits
      SET rollover_credits = rollover_credits + p_amount, updated_at = NOW()
      WHERE user_id = p_user_id AND month = v_current_month;
    WHEN 'purchase', 'refund' THEN
      UPDATE monthly_credits
      SET purchased_credits = purchased_credits + p_amount, updated_at = NOW()
      WHERE user_id = p_user_id AND month = v_current_month;
    ELSE
      RETURN FALSE;
  END CASE;

  -- 새 잔액 계산
  v_balance_after := get_available_credits(p_user_id);

  -- 거래 로그 기록
  INSERT INTO credit_transactions (
    user_id, amount, balance_after, type, description
  ) VALUES (
    p_user_id, p_amount, v_balance_after, p_type, p_description
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Triggers
-- ============================================================================

-- subscriptions 테이블 updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- monthly_credits 테이블 updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_monthly_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_monthly_credits_updated_at ON monthly_credits;
CREATE TRIGGER trigger_monthly_credits_updated_at
  BEFORE UPDATE ON monthly_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_credits_updated_at();

-- ============================================================================
-- 9. Initial Data Migration
-- ============================================================================

-- 기존 사용자들에게 Free 티어 구독 레코드 생성
INSERT INTO subscriptions (user_id, tier, status)
SELECT id, 'free', 'active'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- 기존 profiles의 subscription_tier가 null이면 'free'로 설정
UPDATE profiles
SET subscription_tier = 'free'
WHERE subscription_tier IS NULL;

COMMENT ON TABLE subscriptions IS '사용자 구독 정보 (Stripe 연동)';
COMMENT ON TABLE monthly_credits IS '월간 크레딧 잔액 (유료 티어용)';
COMMENT ON TABLE credit_transactions IS '크레딧 거래 로그 (감사/분석용)';
COMMENT ON TABLE payments IS '결제 내역 (Stripe 연동)';
