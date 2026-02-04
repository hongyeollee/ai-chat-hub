import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, getStripeErrorMessage } from '@/lib/stripe/client';
import { TIER_LIMITS, type SubscriptionTier } from '@/types';

// GET /api/subscription - Get current subscription status
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

    // 프로필에서 구독 정보 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, stripe_customer_id, country_code')
      .eq('id', user.id)
      .single();

    // 구독 상세 정보 가져오기
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // 현재 월 크레딧 정보 가져오기
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const currentMonthStr = currentMonth.toISOString().split('T')[0];

    const { data: credits } = await supabase
      .from('monthly_credits')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonthStr)
      .single();

    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    const tierConfig = TIER_LIMITS[tier];

    // 크레딧 계산
    let availableCredits = 0;
    let totalCredits = 0;
    let usedCredits = 0;

    if (credits && tierConfig.usageType === 'credits') {
      totalCredits = credits.base_credits + credits.rollover_credits + credits.purchased_credits;
      usedCredits = credits.used_credits;
      availableCredits = totalCredits - usedCredits;
    }

    return NextResponse.json({
      success: true,
      data: {
        tier,
        tierConfig: {
          name: tierConfig.name,
          description: tierConfig.description,
          maxInputChars: tierConfig.maxInputChars,
          maxContextMessages: tierConfig.maxContextMessages,
          usageType: tierConfig.usageType,
          features: tierConfig.features,
        },
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          withdrawalConsent: subscription.withdrawal_consent,
        } : null,
        credits: tierConfig.usageType === 'credits' ? {
          available: availableCredits,
          total: totalCredits,
          used: usedCredits,
          base: credits?.base_credits || 0,
          rollover: credits?.rollover_credits || 0,
          purchased: credits?.purchased_credits || 0,
        } : null,
        countryCode: profile?.country_code,
      },
    });
  } catch (error) {
    console.error('Subscription GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/subscription - Cancel subscription
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { action } = await request.json();

    if (action !== 'cancel') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    // 구독 정보 가져오기
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Stripe에서 구독 취소 (기간 종료 시 취소)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // DB 업데이트
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Subscription will be canceled at the end of the current billing period',
      },
    });
  } catch (error) {
    console.error('Subscription cancel error:', error);
    return NextResponse.json(
      { success: false, error: getStripeErrorMessage(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/subscription - Immediately cancel and request refund
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 구독 정보 가져오기
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // 즉시 취소
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

    // DB 업데이트
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        tier: 'free',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    // 프로필을 Free 티어로 변경
    await supabase
      .from('profiles')
      .update({
        subscription_tier: 'free',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Subscription canceled immediately',
      },
    });
  } catch (error) {
    console.error('Subscription delete error:', error);
    return NextResponse.json(
      { success: false, error: getStripeErrorMessage(error) },
      { status: 500 }
    );
  }
}
