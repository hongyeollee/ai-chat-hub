// Database types
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
  parent_message_id?: string | null;  // user 메시지 ID 참조 (같은 질문에 대한 다른 AI 응답 연결)
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
  subscription_tier: 'free' | 'pro';
  last_active_at: string | null;

  // 타임스탬프
  created_at: string;
  updated_at: string;
}

// AI types
export type AIModel = 'gpt-4o-mini' | 'gemini-2.5-flash';

export interface AIProvider {
  id: string;
  name: string;
  model: AIModel;
  icon: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    model: 'gemini-2.5-flash',
    icon: '✨',
  },
  {
    id: 'gpt',
    name: 'GPT',
    model: 'gpt-4o-mini',
    icon: '🤖',
  },
];

// Auth types
export interface EmailAuthRequest {
  email: string;
}

export interface EmailVerifyRequest {
  email: string;
  code: string;
}

// API response types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Usage limits
export const USAGE_LIMITS = {
  MAX_REQUESTS_PER_DAY: 10,
  MAX_CHARS_PER_DAY: 3000,
} as const;

// Context settings
export const CONTEXT_SETTINGS = {
  MAX_MESSAGES_FOR_CONTEXT: 16,
  SUMMARY_TRIGGER_TURNS: 12,
} as const;
