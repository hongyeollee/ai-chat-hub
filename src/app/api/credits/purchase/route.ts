import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, getStripeErrorMessage } from '@/lib/stripe/client';
import { getCreditPriceId, STRIPE_CONFIG } from '@/lib/stripe/config';
import { TIER_LIMITS, type SubscriptionTier } from '@/types';

// POST /api/credits/purchase - Create checkout session for credit purchase
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

    const { quantity = 1 } = await request.json();

    // 유효성 검사
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid quantity (1-10)' },
        { status: 400 }
      );
    }

    // 프로필에서 구독 티어 및 Stripe 고객 ID 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    const tierConfig = TIER_LIMITS[tier];

    // Free 티어는 크레딧 구매 불가
    if (tier === 'free' || tierConfig.usageType !== 'credits') {
      return NextResponse.json(
        {
          success: false,
          error: 'Credit purchase is only available for paid plans',
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // 기존 Stripe 고객이 없으면 생성
    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // 티어에 맞는 크레딧 가격 ID 가져오기
    const priceId = getCreditPriceId(tier as 'light' | 'pro');

    // Checkout 세션 생성 (일회성 결제)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      success_url: `${STRIPE_CONFIG.checkout.successUrl}&credits=true`,
      cancel_url: `${STRIPE_CONFIG.checkout.cancelUrl}&credits=true`,
      metadata: {
        supabase_user_id: user.id,
        type: 'credit_purchase',
        quantity: String(quantity),
        credits_amount: String(quantity * 1000),  // 1,000 크레딧 × 수량
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
        creditsAmount: quantity * 1000,
        pricePerThousand: tierConfig.creditPurchasePrice,
        totalPrice: (tierConfig.creditPurchasePrice || 0) * quantity,
      },
    });
  } catch (error) {
    console.error('Credits purchase error:', error);
    return NextResponse.json(
      { success: false, error: getStripeErrorMessage(error) },
      { status: 500 }
    );
  }
}
