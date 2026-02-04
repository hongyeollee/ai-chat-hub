import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getKoreanDate, getRemainingUsage } from '@/lib/utils/usage';
import { getUserCredits, getCurrentMonthStart } from '@/lib/utils/credits';
import { TIER_LIMITS, getAllowedModelsForTier, type SubscriptionTier } from '@/types';

// GET /api/usage/today - Get today's usage for the current user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 프로필에서 구독 티어 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    const tierConfig = TIER_LIMITS[tier];

    const dateKr = getKoreanDate();

    // Free 티어: 일일 사용량
    if (tierConfig.usageType === 'daily') {
      const { data: usage } = await supabase
        .from('daily_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('date_kr', dateKr)
        .single();

      const requestCount = usage?.request_count || 0;
      const charCount = usage?.char_count || 0;
      const remaining = getRemainingUsage(requestCount, charCount);

      return NextResponse.json({
        success: true,
        data: {
          tier,
          usageType: 'daily',
          dateKr,
          requestCount,
          charCount,
          ...remaining,
          maxInputChars: tierConfig.maxInputChars,
          maxContextMessages: tierConfig.maxContextMessages,
          allowedModels: getAllowedModelsForTier(tier),
          features: tierConfig.features,
        },
      });
    }

    // 유료 티어: 크레딧 기반
    const credits = await getUserCredits(user.id);
    const currentMonth = getCurrentMonthStart();

    return NextResponse.json({
      success: true,
      data: {
        tier,
        usageType: 'credits',
        currentMonth,
        credits: credits || {
          available: 0,
          total: 0,
          used: 0,
          base: 0,
          rollover: 0,
          purchased: 0,
        },
        maxInputChars: tierConfig.maxInputChars,
        maxContextMessages: tierConfig.maxContextMessages,
        allowedModels: getAllowedModelsForTier(tier),
        features: tierConfig.features,
        monthlyCredits: tierConfig.monthlyCredits,
        rolloverLimit: tierConfig.rolloverLimit,
      },
    });
  } catch (error) {
    console.error('Usage GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
