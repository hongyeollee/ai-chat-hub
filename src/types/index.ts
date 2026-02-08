// ============================================================================
// User Roles
// ============================================================================

export type UserRole = 'user' | 'admin' | 'tester';

// ============================================================================
// Subscription Tiers
// ============================================================================

export type SubscriptionTier = 'free' | 'light' | 'pro' | 'enterprise';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

// ============================================================================
// AI Models - Now derived from MODEL_REGISTRY
// ============================================================================

import {
  MODEL_REGISTRY,
  MODEL_CREDITS_MAP,
  MODEL_CATEGORIES_MAP,
  MODEL_TO_CATEGORY_MAP,
  MODEL_INFO_MAP,
  getModelCredits,
  getModelCategory,
  getEnabledModelIds,
  isValidModel,
  type ModelConfig,
  type ModelCategory,
  type AIModelId,
} from '@/config/models';

// Re-export types from config
export type { ModelCategory, AIModelId, ModelConfig };
export { getModelCredits, getModelCategory, getEnabledModelIds, isValidModel };

// AIModel type - derived from MODEL_REGISTRY
// Using string literal union for backward compatibility
export type AIModel =
  | 'gpt-4o-mini'
  | 'gemini-2.5-flash'
  | 'deepseek-v3'
  | 'mistral-small-3'
  | 'mistral-medium-3'
  | 'claude-haiku-3.5'
  | 'gpt-4o'
  | 'claude-sonnet-4.5';

// Backward compatible exports derived from MODEL_REGISTRY
export const MODEL_CREDITS: Record<AIModel, number> = MODEL_CREDITS_MAP as Record<AIModel, number>;

export const MODEL_CATEGORIES: Record<ModelCategory, AIModel[]> = MODEL_CATEGORIES_MAP as Record<ModelCategory, AIModel[]>;

export const MODEL_TO_CATEGORY: Record<AIModel, ModelCategory> = MODEL_TO_CATEGORY_MAP as Record<AIModel, ModelCategory>;

// 모델 표시 정보 (backward compatible interface)
export interface AIModelInfo {
  id: AIModel;
  name: string;
  provider: string;
  icon: string;
  credits: number;
  category: ModelCategory;
  description: string;
}

// Derive AI_MODEL_INFO from MODEL_REGISTRY
export const AI_MODEL_INFO: Record<AIModel, AIModelInfo> = Object.fromEntries(
  MODEL_REGISTRY.map((m) => [
    m.id,
    {
      id: m.id as AIModel,
      name: m.name,
      provider: m.providerName,
      icon: m.icon,
      credits: m.credits,
      category: m.category,
      description: m.description,
    },
  ])
) as Record<AIModel, AIModelInfo>;

// 기존 AI_PROVIDERS 호환성 유지
export interface AIProvider {
  id: string;
  name: string;
  model: AIModel;
  icon: string;
}

export const AI_PROVIDERS: AIProvider[] = MODEL_REGISTRY
  .filter((m) => m.enabled)
  .map((info) => ({
    id: info.id,
    name: info.name,
    model: info.id as AIModel,
    icon: info.icon,
  }));

// ============================================================================
// Tier Configuration
// ============================================================================

export type UsageType = 'daily' | 'credits';

export interface TierFeatures {
  dualResponse: boolean;           // 두 AI 동시 응답 (전 등급 가능)
  alternativeResponse: boolean;    // 다른 모델로 답변받기 (전 등급 가능)
  exportConversation: boolean;     // 대화 내보내기
}

export interface TierConfig {
  name: string;
  description: string;
  maxInputChars: number;
  maxContextMessages: number;
  usageType: UsageType;
  dailyRequests?: number;          // Free만 (일일 횟수)
  monthlyCredits?: number;         // 유료만 (월간 크레딧)
  rolloverLimit?: number;          // 이월 상한
  allowedModelCategories: ModelCategory[];
  features: TierFeatures;
  price: {
    monthly: number;               // USD
    yearly: number;                // USD
  };
  creditPurchasePrice?: number;    // 1,000 크레딧당 가격 (USD)
}

export const TIER_LIMITS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: 'Free',
    description: '서비스 체험',
    maxInputChars: 3000,
    maxContextMessages: 8,
    usageType: 'daily',
    dailyRequests: 10,
    allowedModelCategories: ['low'],
    features: {
      dualResponse: true,
      alternativeResponse: true,
      exportConversation: false,
    },
    price: {
      monthly: 0,
      yearly: 0,
    },
  },
  light: {
    name: 'Light',
    description: '가벼운 유료 사용',
    maxInputChars: 6000,
    maxContextMessages: 16,
    usageType: 'credits',
    monthlyCredits: 1500,
    rolloverLimit: 750,
    allowedModelCategories: ['low', 'medium'],
    features: {
      dualResponse: true,
      alternativeResponse: true,
      exportConversation: true,
    },
    price: {
      monthly: 4.99,
      yearly: 49.99,
    },
    creditPurchasePrice: 2.99,  // $2.99 / 1,000 크레딧
  },
  pro: {
    name: 'Pro',
    description: '업무 활용',
    maxInputChars: 15000,
    maxContextMessages: 32,
    usageType: 'credits',
    monthlyCredits: 3000,
    rolloverLimit: 1500,
    allowedModelCategories: ['low', 'medium', 'high'],
    features: {
      dualResponse: true,
      alternativeResponse: true,
      exportConversation: true,
    },
    price: {
      monthly: 9.99,
      yearly: 99.99,
    },
    creditPurchasePrice: 1.99,  // $1.99 / 1,000 크레딧
  },
  enterprise: {
    name: 'Enterprise',
    description: '팀/기업용',
    maxInputChars: 50000,
    maxContextMessages: 64,
    usageType: 'credits',
    monthlyCredits: 0,  // 협의
    rolloverLimit: 0,
    allowedModelCategories: ['low', 'medium', 'high'],
    features: {
      dualResponse: true,
      alternativeResponse: true,
      exportConversation: true,
    },
    price: {
      monthly: 0,  // 협의
      yearly: 0,
    },
  },
};

// ============================================================================
// Database Types
// ============================================================================

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  parent_message_id?: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: AIModel;
  created_at: string;
}

export interface DailyUsage {
  user_id: string;
  date_kr: string;
  request_count: number;
  char_count: number;
  updated_at: string;
}

export interface Profile {
  id: string;

  // 사용자 역할
  role: UserRole;

  // auth.users 동기화 필드
  email: string | null;
  email_confirmed_at: string | null;
  phone: string | null;
  phone_confirmed_at: string | null;
  auth_created_at: string | null;
  auth_updated_at: string | null;
  last_sign_in_at: string | null;
  auth_provider: string | null;

  // 인증 방식 및 비밀번호
  auth_method: 'email' | 'google' | 'otp_only';
  password_hash: string | null;

  // 사용자 기본 정보
  name: string | null;
  avatar_url: string | null;
  language: string;
  timezone: string;

  // 마케팅/법적 동의
  marketing_agreed: boolean;
  marketing_agreed_at: string | null;
  terms_agreed_at: string | null;
  privacy_agreed_at: string | null;

  // AI 서비스 설정
  custom_instructions: string | null;
  preferred_model: AIModel;
  memory_enabled: boolean;

  // 비즈니스/분석
  referral_source: string | null;
  subscription_tier: SubscriptionTier;
  last_active_at: string | null;

  // Stripe
  stripe_customer_id: string | null;
  country_code: string | null;  // EU/UK/터키 감지용

  // 타임스탬프
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  withdrawal_consent: boolean;           // EU 철회권 동의 여부
  withdrawal_consent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyCredits {
  id: string;
  user_id: string;
  month: string;              // YYYY-MM-01 형식
  base_credits: number;       // 기본 제공량
  rollover_credits: number;   // 이월 크레딧
  purchased_credits: number;  // 충전 크레딧
  used_credits: number;       // 사용량
  created_at: string;
  updated_at: string;
}

export type CreditTransactionType = 'monthly' | 'rollover' | 'purchase' | 'usage' | 'refund' | 'admin_grant';

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;             // 양수: 충전, 음수: 사용
  balance_after: number;      // 거래 후 잔액
  type: CreditTransactionType;
  model: AIModel | null;      // usage 시 AI 모델명
  message_id: string | null;
  description: string | null;
  created_at: string;
}

export type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  user_id: string;
  subscription_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  refund_amount: number | null;
  refund_reason: string | null;
  description: string | null;
  created_at: string;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface EmailAuthRequest {
  email: string;
}

export interface EmailVerifyRequest {
  email: string;
  code: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Usage & Context Settings
// ============================================================================

// Free 티어용 일일 제한 (기존 호환성)
export const USAGE_LIMITS = {
  MAX_REQUESTS_PER_DAY: 10,
  MAX_CHARS_PER_DAY: 3000,
} as const;

// 기본 컨텍스트 설정 (티어별로 오버라이드됨)
export const CONTEXT_SETTINGS = {
  MAX_MESSAGES_FOR_CONTEXT: 16,
  SUMMARY_TRIGGER_TURNS: 12,
} as const;

// ============================================================================
// Admin Types
// ============================================================================

export interface UserOverride {
  id: string;
  user_id: string;
  usage_type_override: 'daily' | 'credits' | null;
  daily_requests_override: number | null;
  daily_chars_override: number | null;
  monthly_credits_override: number | null;
  allowed_models: AIModel[] | null;
  max_context_messages_override: number | null;
  max_input_chars_override: number | null;
  reason: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type AdminAuditAction = 'grant_credits' | 'set_override' | 'remove_override' | 'change_role';

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: AdminAuditAction;
  target_user_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 모델 ID를 i18n 번역 키로 변환
 * next-intl은 "."을 네임스페이스 구분자로 사용하므로 "_"로 대체
 */
export function getModelTranslationKey(modelId: AIModel): string {
  return modelId.replace(/\./g, '_');
}

/**
 * 티어에서 허용되는 모델인지 확인
 */
export function isModelAllowedForTier(model: AIModel, tier: SubscriptionTier): boolean {
  const tierConfig = TIER_LIMITS[tier];
  const modelCategory = MODEL_TO_CATEGORY[model];
  return tierConfig.allowedModelCategories.includes(modelCategory);
}

/**
 * 티어에서 사용 가능한 모델 목록 반환
 */
export function getAllowedModelsForTier(tier: SubscriptionTier): AIModel[] {
  const tierConfig = TIER_LIMITS[tier];
  return tierConfig.allowedModelCategories.flatMap(
    (category) => MODEL_CATEGORIES[category]
  );
}

/**
 * 티어별 컨텍스트 메시지 수 반환
 */
export function getContextMessagesForTier(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier].maxContextMessages;
}

/**
 * 티어별 입력 글자 수 제한 반환
 */
export function getMaxInputCharsForTier(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier].maxInputChars;
}

/**
 * EU/UK/터키 국가인지 확인 (14일 철회권 적용 국가)
 */
export function isWithdrawalRightCountry(countryCode: string | null): boolean {
  if (!countryCode) return false;
  const withdrawalCountries = [
    // EU 회원국
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    // UK
    'GB',
    // 터키
    'TR',
  ];
  return withdrawalCountries.includes(countryCode.toUpperCase());
}
