import {
  USAGE_LIMITS,
  TIER_LIMITS,
  MODEL_CREDITS,
  type SubscriptionTier,
  type AIModel,
  type UsageType,
} from '@/types';
import { getUserOverride } from './admin';

/**
 * 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
 */
export function getKoreanDate(): string {
  // Get current date in Korea timezone (UTC+9)
  const now = new Date();
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreaTime.toISOString().split('T')[0];
}

/**
 * Free 티어용 일일 요청 가능 여부 확인
 */
export function canMakeRequest(
  requestCount: number,
  charCount: number
): { allowed: boolean; reason?: string } {
  if (requestCount >= USAGE_LIMITS.MAX_REQUESTS_PER_DAY) {
    return {
      allowed: false,
      reason: 'daily_request_limit',
    };
  }

  if (charCount >= USAGE_LIMITS.MAX_CHARS_PER_DAY) {
    return {
      allowed: false,
      reason: 'daily_char_limit',
    };
  }

  return { allowed: true };
}

/**
 * Free 티어용 잔여 사용량 계산
 */
export function getRemainingUsage(requestCount: number, charCount: number) {
  return {
    remainingRequests: Math.max(0, USAGE_LIMITS.MAX_REQUESTS_PER_DAY - requestCount),
    remainingChars: Math.max(0, USAGE_LIMITS.MAX_CHARS_PER_DAY - charCount),
    maxRequests: USAGE_LIMITS.MAX_REQUESTS_PER_DAY,
    maxChars: USAGE_LIMITS.MAX_CHARS_PER_DAY,
  };
}

/**
 * 티어별 사용량 체크
 */
export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  usageType: 'daily' | 'credits';
  remaining?: number;
  creditsNeeded?: number;
  maxInputChars: number;
}

/**
 * 티어별 사용량 확인 (Free: 일일 횟수, 유료: 크레딧)
 */
export function checkTierUsage(
  tier: SubscriptionTier,
  model: AIModel,
  dailyRequestCount: number,
  availableCredits: number
): UsageCheckResult {
  const tierConfig = TIER_LIMITS[tier];

  if (tierConfig.usageType === 'daily') {
    // Free 티어: 일일 횟수 확인
    const maxRequests = tierConfig.dailyRequests || USAGE_LIMITS.MAX_REQUESTS_PER_DAY;

    if (dailyRequestCount >= maxRequests) {
      return {
        allowed: false,
        reason: 'daily_request_limit',
        usageType: 'daily',
        remaining: 0,
        maxInputChars: tierConfig.maxInputChars,
      };
    }

    return {
      allowed: true,
      usageType: 'daily',
      remaining: maxRequests - dailyRequestCount,
      maxInputChars: tierConfig.maxInputChars,
    };
  } else {
    // 유료 티어: 크레딧 확인
    const creditsNeeded = MODEL_CREDITS[model];

    if (availableCredits < creditsNeeded) {
      return {
        allowed: false,
        reason: 'insufficient_credits',
        usageType: 'credits',
        remaining: availableCredits,
        creditsNeeded,
        maxInputChars: tierConfig.maxInputChars,
      };
    }

    return {
      allowed: true,
      usageType: 'credits',
      remaining: availableCredits,
      creditsNeeded,
      maxInputChars: tierConfig.maxInputChars,
    };
  }
}

/**
 * 입력 글자 수 검증
 */
export function validateInputLength(
  content: string,
  tier: SubscriptionTier
): { valid: boolean; currentLength: number; maxLength: number; reason?: string } {
  const maxLength = TIER_LIMITS[tier].maxInputChars;
  const currentLength = content.length;

  if (currentLength > maxLength) {
    return {
      valid: false,
      currentLength,
      maxLength,
      reason: 'input_too_long',
    };
  }

  return { valid: true, currentLength, maxLength };
}

/**
 * 모델별 크레딧 비용 가져오기
 */
export function getModelCreditCost(model: AIModel): number {
  return MODEL_CREDITS[model];
}

/**
 * 크레딧으로 가능한 요청 횟수 계산
 */
export function calculateRequestsFromCredits(
  availableCredits: number,
  model: AIModel
): number {
  const cost = MODEL_CREDITS[model];
  return Math.floor(availableCredits / cost);
}

/**
 * 티어별 일일/월간 사용량 요약
 */
export function getUsageSummary(
  tier: SubscriptionTier,
  dailyRequestCount: number,
  availableCredits: number,
  totalCredits: number
): {
  usageType: 'daily' | 'credits';
  used: number;
  remaining: number;
  max: number;
  percentUsed: number;
} {
  const tierConfig = TIER_LIMITS[tier];

  if (tierConfig.usageType === 'daily') {
    const max = tierConfig.dailyRequests || USAGE_LIMITS.MAX_REQUESTS_PER_DAY;
    return {
      usageType: 'daily',
      used: dailyRequestCount,
      remaining: Math.max(0, max - dailyRequestCount),
      max,
      percentUsed: Math.round((dailyRequestCount / max) * 100),
    };
  } else {
    const used = totalCredits - availableCredits;
    return {
      usageType: 'credits',
      used,
      remaining: availableCredits,
      max: totalCredits,
      percentUsed: totalCredits > 0 ? Math.round((used / totalCredits) * 100) : 0,
    };
  }
}

// ============================================================================
// Override Support Functions (Admin/Tester)
// ============================================================================

export interface EffectiveLimits {
  usageType: UsageType;
  maxInputChars: number;
  maxContextMessages: number;
  dailyRequests?: number;
  monthlyCredits?: number;
  allowedModels?: AIModel[];
  hasOverride: boolean;
}

/**
 * 오버라이드 적용된 실제 제한값 가져오기
 */
export async function getEffectiveLimits(
  userId: string,
  tier: SubscriptionTier
): Promise<EffectiveLimits> {
  const tierConfig = TIER_LIMITS[tier];
  const override = await getUserOverride(userId);

  // 오버라이드가 없으면 티어 기본값 사용
  if (!override) {
    return {
      usageType: tierConfig.usageType,
      maxInputChars: tierConfig.maxInputChars,
      maxContextMessages: tierConfig.maxContextMessages,
      dailyRequests: tierConfig.usageType === 'daily' ? tierConfig.dailyRequests : undefined,
      monthlyCredits: tierConfig.usageType === 'credits' ? tierConfig.monthlyCredits : undefined,
      hasOverride: false,
    };
  }

  // 사용 방식 결정: 오버라이드 > 티어 기본값
  const usageType = override.usage_type_override ?? tierConfig.usageType;

  return {
    usageType,
    maxInputChars: override.max_input_chars_override ?? tierConfig.maxInputChars,
    maxContextMessages: override.max_context_messages_override ?? tierConfig.maxContextMessages,
    // 사용 방식에 따라 해당 제한값만 적용
    dailyRequests: usageType === 'daily'
      ? (override.daily_requests_override ?? tierConfig.dailyRequests ?? USAGE_LIMITS.MAX_REQUESTS_PER_DAY)
      : undefined,
    monthlyCredits: usageType === 'credits'
      ? (override.monthly_credits_override ?? tierConfig.monthlyCredits)
      : undefined,
    allowedModels: override.allowed_models ?? undefined,
    hasOverride: true,
  };
}

export interface UsageCheckWithOverrideResult {
  allowed: boolean;
  reason?: string;
  usageType: UsageType;
  remaining?: number;
  creditsNeeded?: number;
}

/**
 * 오버라이드 적용된 사용량 확인 (테스터 사용 방식에 따라 다르게 처리)
 */
export async function checkUsageWithOverride(
  userId: string,
  tier: SubscriptionTier,
  currentDailyRequests: number,
  availableCredits: number,
  model: AIModel
): Promise<UsageCheckWithOverrideResult> {
  const limits = await getEffectiveLimits(userId, tier);

  if (limits.usageType === 'daily') {
    // 일일 횟수 제한 방식
    const maxRequests = limits.dailyRequests ?? USAGE_LIMITS.MAX_REQUESTS_PER_DAY;

    if (currentDailyRequests >= maxRequests) {
      return {
        allowed: false,
        reason: 'daily_request_limit',
        usageType: 'daily',
        remaining: 0,
      };
    }

    return {
      allowed: true,
      usageType: 'daily',
      remaining: maxRequests - currentDailyRequests,
    };
  } else {
    // 크레딧 방식
    const creditCost = getModelCreditCost(model);

    if (availableCredits < creditCost) {
      return {
        allowed: false,
        reason: 'insufficient_credits',
        usageType: 'credits',
        remaining: availableCredits,
        creditsNeeded: creditCost,
      };
    }

    return {
      allowed: true,
      usageType: 'credits',
      remaining: availableCredits,
      creditsNeeded: creditCost,
    };
  }
}

/**
 * 오버라이드 적용된 입력 글자 수 검증
 */
export async function validateInputLengthWithOverride(
  userId: string,
  content: string,
  tier: SubscriptionTier
): Promise<{ valid: boolean; currentLength: number; maxLength: number; reason?: string }> {
  const limits = await getEffectiveLimits(userId, tier);
  const currentLength = content.length;

  if (currentLength > limits.maxInputChars) {
    return {
      valid: false,
      currentLength,
      maxLength: limits.maxInputChars,
      reason: 'input_too_long',
    };
  }

  return { valid: true, currentLength, maxLength: limits.maxInputChars };
}

/**
 * 오버라이드 적용된 모델 접근 권한 확인
 */
export async function isModelAllowedWithOverride(
  userId: string,
  model: AIModel,
  tier: SubscriptionTier
): Promise<boolean> {
  const limits = await getEffectiveLimits(userId, tier);

  // 오버라이드에 허용 모델이 지정되어 있으면 해당 모델만 허용
  if (limits.allowedModels) {
    return limits.allowedModels.includes(model);
  }

  // 오버라이드가 없으면 티어 기본 허용 모델 사용
  const { isModelAllowedForTier } = await import('@/types');
  return isModelAllowedForTier(model, tier);
}
