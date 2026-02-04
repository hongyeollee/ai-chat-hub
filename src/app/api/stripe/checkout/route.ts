import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, getStripeErrorMessage } from '@/lib/stripe/client';
import { getPriceId, STRIPE_CONFIG } from '@/lib/stripe/config';
import { isWithdrawalRightCountry } from '@/types';

// POST /api/stripe/checkout - Create Stripe Checkout Session
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

    const { tier, interval, withdrawalConsent } = await request.json();

    // 유효성 검사
    if (!tier || !['light', 'pro'].includes(tier)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tier' },
        { status: 400 }
      );
    }

    if (!interval || !['monthly', 'yearly'].includes(interval)) {
      return NextResponse.json(
        { success: false, error: 'Invalid interval' },
        { status: 400 }
      );
    }

    // 프로필에서 국가 코드 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, country_code, email')
      .eq('id', user.id)
      .single();

    // EU/UK/터키 사용자는 철회권 동의 필수
    if (isWithdrawalRightCountry(profile?.country_code)) {
      if (!withdrawalConsent) {
        return NextResponse.json(
          {
            success: false,
            error: 'withdrawal_consent_required',
            message: 'EU/UK 지역 사용자는 14일 철회권 포기에 동의해야 결제가 가능합니다.',
          },
          { status: 400 }
        );
      }
    }

    const stripe = getStripe();
    const priceId = getPriceId(tier, interval);

    // 기존 Stripe 고객이 있으면 재사용
    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // 새 고객 생성
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // 프로필에 Stripe 고객 ID 저장
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Checkout 세션 생성
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: STRIPE_CONFIG.checkout.successUrl,
      cancel_url: STRIPE_CONFIG.checkout.cancelUrl,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          tier,
          interval,
          withdrawal_consent: withdrawalConsent ? 'true' : 'false',
        },
      },
      metadata: {
        supabase_user_id: user.id,
        tier,
        interval,
        withdrawal_consent: withdrawalConsent ? 'true' : 'false',
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { success: false, error: getStripeErrorMessage(error) },
      { status: 500 }
    );
  }
}
