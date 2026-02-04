import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserCredits, getCurrentMonthStart } from '@/lib/utils/credits';
import { TIER_LIMITS, MODEL_CREDITS, type SubscriptionTier, type AIModel } from '@/types';

// GET /api/credits - Get current credits balance
export async function GET(request: NextRequest) {
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

    // Free 티어는 크레딧 대신 일일 사용량
    if (tierConfig.usageType === 'daily') {
      const today = getKoreanDate();
      const { data: usage } = await supabase
        .from('daily_usage')
        .select('request_count, char_count')
        .eq('user_id', user.id)
        .eq('date_kr', today)
        .single();

      return NextResponse.json({
        success: true,
        data: {
          usageType: 'daily',
          tier,
          daily: {
            requestsUsed: usage?.request_count || 0,
            requestsRemaining: (tierConfig.dailyRequests || 10) - (usage?.request_count || 0),
            requestsMax: tierConfig.dailyRequests || 10,
            charsUsed: usage?.char_count || 0,
            charsMax: tierConfig.maxInputChars,
          },
        },
      });
    }

    // 유료 티어는 크레딧 정보 반환
    const credits = await getUserCredits(user.id);

    // 최근 거래 내역 가져오기
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // 모델별 예상 요청 횟수 계산
    const modelEstimates = Object.entries(MODEL_CREDITS).map(([model, cost]) => ({
      model,
      credits: cost,
      estimatedRequests: credits ? Math.floor(credits.available / cost) : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        usageType: 'credits',
        tier,
        credits: credits || {
          available: 0,
          total: 0,
          used: 0,
          base: 0,
          rollover: 0,
          purchased: 0,
        },
        modelEstimates,
        recentTransactions: transactions || [],
        currentMonth: getCurrentMonthStart(),
      },
    });
  } catch (error) {
    console.error('Credits GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getKoreanDate(): string {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreaTime.toISOString().split('T')[0];
}
