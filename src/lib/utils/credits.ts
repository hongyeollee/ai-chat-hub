import { createClient } from '@/lib/supabase/server';
import {
  MODEL_CREDITS,
  TIER_LIMITS,
  type AIModel,
  type SubscriptionTier,
  type MonthlyCredits,
} from '@/types';

/**
 * 현재 월의 시작일 (YYYY-MM-01) 가져오기
 */
export function getCurrentMonthStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * 사용자의 현재 월 크레딧 정보 가져오기
 */
export async function getUserCredits(userId: string): Promise<{
  available: number;
  total: number;
  used: number;
  base: number;
  rollover: number;
  purchased: number;
} | null> {
  const supabase = await createClient();
  const currentMonth = getCurrentMonthStart();

  const { data: credits } = await supabase
    .from('monthly_credits')
    .select('*')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .single();

  if (!credits) {
    return null;
  }

  const total = credits.base_credits + credits.rollover_credits + credits.purchased_credits;
  const available = total - credits.used_credits;

  return {
    available: Math.max(available, 0),
    total,
    used: credits.used_credits,
    base: credits.base_credits,
    rollover: credits.rollover_credits,
    purchased: credits.purchased_credits,
  };
}

/**
 * 크레딧 사용 가능 여부 확인
 */
export async function canUseCredits(
  userId: string,
  model: AIModel
): Promise<{ allowed: boolean; reason?: string; creditsNeeded?: number }> {
  const credits = await getUserCredits(userId);
  const creditsNeeded = MODEL_CREDITS[model];

  if (!credits) {
    return {
      allowed: false,
      reason: 'no_credits_record',
      creditsNeeded,
    };
  }

  if (credits.available < creditsNeeded) {
    return {
      allowed: false,
      reason: 'insufficient_credits',
      creditsNeeded,
    };
  }

  return { allowed: true, creditsNeeded };
}

/**
 * 크레딧 차감
 */
export async function deductCredits(
  userId: string,
  model: AIModel,
  messageId?: string
): Promise<{ success: boolean; error?: string; remaining?: number }> {
  const supabase = await createClient();
  const currentMonth = getCurrentMonthStart();
  const creditsToDeduct = MODEL_CREDITS[model];

  // 현재 크레딧 확인
  const { data: credits } = await supabase
    .from('monthly_credits')
    .select('*')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .single();

  if (!credits) {
    return { success: false, error: 'No credits record found' };
  }

  const total = credits.base_credits + credits.rollover_credits + credits.purchased_credits;
  const available = total - credits.used_credits;

  if (available < creditsToDeduct) {
    return { success: false, error: 'Insufficient credits' };
  }

  // 크레딧 차감
  const { error: updateError } = await supabase
    .from('monthly_credits')
    .update({
      used_credits: credits.used_credits + creditsToDeduct,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('month', currentMonth);

  if (updateError) {
    console.error('Failed to deduct credits:', updateError);
    return { success: false, error: 'Failed to deduct credits' };
  }

  // 거래 로그 기록
  const newBalance = available - creditsToDeduct;
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount: -creditsToDeduct,
    balance_after: newBalance,
    type: 'usage',
    model,
    message_id: messageId || null,
    description: `Used ${model}`,
  });

  return { success: true, remaining: newBalance };
}

/**
 * 크레딧 추가 (구매, 환불 등)
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: 'purchase' | 'refund' | 'bonus',
  description?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const currentMonth = getCurrentMonthStart();

  // 현재 월 레코드가 없으면 생성
  const { data: credits } = await supabase
    .from('monthly_credits')
    .select('*')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .single();

  if (!credits) {
    // 새 레코드 생성
    const { error: insertError } = await supabase.from('monthly_credits').insert({
      user_id: userId,
      month: currentMonth,
      base_credits: 0,
      rollover_credits: 0,
      purchased_credits: amount,
      used_credits: 0,
    });

    if (insertError) {
      return { success: false, error: 'Failed to create credits record' };
    }
  } else {
    // 기존 레코드 업데이트
    const { error: updateError } = await supabase
      .from('monthly_credits')
      .update({
        purchased_credits: credits.purchased_credits + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('month', currentMonth);

    if (updateError) {
      return { success: false, error: 'Failed to add credits' };
    }
  }

  // 새 잔액 계산
  const updatedCredits = await getUserCredits(userId);

  // 거래 로그 기록
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount,
    balance_after: updatedCredits?.available || 0,
    type: type === 'bonus' ? 'purchase' : type,
    description: description || `${type} - ${amount} credits`,
  });

  return { success: true };
}

/**
 * 사용량 사용 가능 여부 확인 (Free 티어용 일일 횟수 + 유료 티어용 크레딧)
 */
export async function checkUsageAllowed(
  userId: string,
  tier: SubscriptionTier,
  model: AIModel
): Promise<{
  allowed: boolean;
  reason?: string;
  usageType: 'daily' | 'credits';
  remaining?: number;
  creditsNeeded?: number;
}> {
  const tierConfig = TIER_LIMITS[tier];

  if (tierConfig.usageType === 'daily') {
    // Free 티어: 일일 횟수 확인
    const supabase = await createClient();
    const today = getKoreanDate();

    const { data: usage } = await supabase
      .from('daily_usage')
      .select('request_count')
      .eq('user_id', userId)
      .eq('date_kr', today)
      .single();

    const requestCount = usage?.request_count || 0;
    const maxRequests = tierConfig.dailyRequests || 10;

    if (requestCount >= maxRequests) {
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
      remaining: maxRequests - requestCount,
    };
  } else {
    // 유료 티어: 크레딧 확인
    const result = await canUseCredits(userId, model);
    const credits = await getUserCredits(userId);

    return {
      allowed: result.allowed,
      reason: result.reason,
      usageType: 'credits',
      remaining: credits?.available || 0,
      creditsNeeded: result.creditsNeeded,
    };
  }
}

/**
 * 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
 */
function getKoreanDate(): string {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreaTime.toISOString().split('T')[0];
}

/**
 * 모델별 크레딧 비용 가져오기
 */
export function getModelCredits(model: AIModel): number {
  return MODEL_CREDITS[model];
}

/**
 * 크레딧으로 가능한 요청 횟수 계산
 */
export function calculateRequestsFromCredits(
  credits: number,
  model: AIModel
): number {
  const cost = MODEL_CREDITS[model];
  return Math.floor(credits / cost);
}
