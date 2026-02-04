import { createClient } from '@/lib/supabase/server';
import {
  TIER_LIMITS,
  isModelAllowedForTier,
  getAllowedModelsForTier,
  getContextMessagesForTier,
  getMaxInputCharsForTier,
  type SubscriptionTier,
  type AIModel,
  type TierConfig,
} from '@/types';

/**
 * 사용자의 현재 구독 티어 가져오기
 */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  return (profile?.subscription_tier || 'free') as SubscriptionTier;
}

/**
 * 사용자의 티어 설정 가져오기
 */
export async function getUserTierConfig(userId: string): Promise<TierConfig> {
  const tier = await getUserTier(userId);
  return TIER_LIMITS[tier];
}

/**
 * 사용자가 특정 모델을 사용할 수 있는지 확인
 */
export async function canUserAccessModel(
  userId: string,
  model: AIModel
): Promise<{ allowed: boolean; reason?: string; tier: SubscriptionTier }> {
  const tier = await getUserTier(userId);
  const allowed = isModelAllowedForTier(model, tier);

  if (!allowed) {
    return {
      allowed: false,
      reason: 'model_not_allowed',
      tier,
    };
  }

  return { allowed: true, tier };
}

/**
 * 사용자가 사용 가능한 모델 목록 가져오기
 */
export async function getUserAllowedModels(userId: string): Promise<AIModel[]> {
  const tier = await getUserTier(userId);
  return getAllowedModelsForTier(tier);
}

/**
 * 사용자의 컨텍스트 메시지 수 제한 가져오기
 */
export async function getUserContextLimit(userId: string): Promise<number> {
  const tier = await getUserTier(userId);
  return getContextMessagesForTier(tier);
}

/**
 * 사용자의 입력 글자 수 제한 가져오기
 */
export async function getUserInputLimit(userId: string): Promise<number> {
  const tier = await getUserTier(userId);
  return getMaxInputCharsForTier(tier);
}

/**
 * 입력 글자 수 검증
 */
export async function validateInputLength(
  userId: string,
  content: string
): Promise<{ valid: boolean; maxLength: number; currentLength: number; reason?: string }> {
  const maxLength = await getUserInputLimit(userId);
  const currentLength = content.length;

  if (currentLength > maxLength) {
    return {
      valid: false,
      maxLength,
      currentLength,
      reason: 'input_too_long',
    };
  }

  return { valid: true, maxLength, currentLength };
}

/**
 * 사용자의 기능 사용 가능 여부 확인
 */
export async function canUserUseFeature(
  userId: string,
  feature: 'dualResponse' | 'alternativeResponse' | 'exportConversation'
): Promise<boolean> {
  const tierConfig = await getUserTierConfig(userId);
  return tierConfig.features[feature];
}

/**
 * 구독 상태 확인
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  tier: SubscriptionTier;
  status: string;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
}> {
  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  const tier = await getUserTier(userId);

  if (!subscription) {
    return {
      tier,
      status: 'active',
      isActive: true,
      cancelAtPeriodEnd: false,
      periodEnd: null,
    };
  }

  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  return {
    tier: subscription.tier as SubscriptionTier,
    status: subscription.status,
    isActive,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    periodEnd: subscription.current_period_end,
  };
}

// Re-export utility functions from types
export {
  isModelAllowedForTier,
  getAllowedModelsForTier,
  getContextMessagesForTier,
  getMaxInputCharsForTier,
};
